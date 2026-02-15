mod commands;
mod db;
mod models;
mod pdf_commands;
mod pdf_engine;
mod pdf_models;
mod pdf_protocol;

use commands::DbState;
use pdf_commands::PdfState;
use pdf_models::new_shared_render_cache;
use pdfium_render::prelude::*;
use std::sync::atomic::AtomicU64;
use std::sync::{mpsc, Arc, Mutex};
use tauri::Manager;

fn pdfium_lib_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "libpdfium.dylib"
    } else if cfg!(target_os = "windows") {
        "pdfium.dll"
    } else {
        "libpdfium.so"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<pdf_engine::PdfRequest>();
    let tx_protocol = Mutex::new(tx.clone());
    let generation = Arc::new(AtomicU64::new(0));
    let gen_protocol = Arc::clone(&generation);
    let gen_render = Arc::clone(&generation);
    let render_cache = new_shared_render_cache();
    let cache_protocol = Arc::clone(&render_cache);
    let cache_render = Arc::clone(&render_cache);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .register_uri_scheme_protocol("pdfium", move |_ctx, request| {
            pdf_protocol::handle(&tx_protocol, &gen_protocol, &cache_protocol, request)
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_data = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db_path = app_data.join("axiomatic.db");
            let conn = db::init_db(&db_path).expect("failed to init database");
            app.manage(DbState(Mutex::new(conn)));

            // Find PDFium shared library
            let lib_name = pdfium_lib_name();
            let lib_path = app
                .path()
                .resource_dir()
                .map(|d| d.join(lib_name))
                .ok()
                .filter(|p| p.exists())
                .or_else(|| {
                    // Development fallback paths
                    [
                        std::path::PathBuf::from("resources").join(lib_name),
                        std::path::PathBuf::from("src-tauri/resources").join(lib_name),
                    ]
                    .into_iter()
                    .find(|p| p.exists())
                })
                .unwrap_or_else(|| {
                    log::warn!(
                        "PDFium library ({}) not found — PDF rendering will fail. \
                         Download from https://github.com/bblanchon/pdfium-binaries",
                        lib_name
                    );
                    std::path::PathBuf::from(lib_name)
                });

            log::info!("Loading PDFium from {:?}", lib_path);

            // Initialize PDFium eagerly so it's available to both the
            // render thread and the open_document command handler.
            let bindings = Pdfium::bind_to_library(&lib_path)
                .map_err(|e| {
                    log::error!("Failed to bind to PDFium library at {:?}: {:?}", lib_path, e);
                    format!("Failed to bind to PDFium: {:?}", e)
                })?;
            let pdfium: &'static Pdfium = Box::leak(Box::new(Pdfium::new(bindings)));
            log::info!("PDFium initialized");

            // Spawn the PDF render thread.
            // pdfium is 'static (leaked) — cast to usize so the closure is Send.
            let pdfium_addr = pdfium as *const Pdfium as usize;
            std::thread::spawn(move || {
                let pdfium: &'static Pdfium = unsafe { &*(pdfium_addr as *const Pdfium) };
                pdf_engine::run(rx, pdfium, gen_render, cache_render);
            });

            app.manage(PdfState {
                sender: Mutex::new(tx),
                generation,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_directories,
            commands::add_directory,
            commands::remove_directory,
            commands::list_textbooks,
            commands::rename_textbook,
            commands::delete_textbook,
            commands::detect_os_theme,
            commands::read_file_bytes,
            commands::get_note,
            commands::set_note,
            commands::list_notes_for_book,
            commands::delete_note,
            commands::save_note_image,
            commands::get_note_image,
            commands::export_notes_for_book,
            commands::migrate_notes_from_json,
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            commands::update_tag_color,
            commands::tag_book,
            commands::untag_book,
            commands::list_book_tags_all,
            commands::open_url,
            commands::list_highlights,
            commands::create_highlight,
            commands::delete_highlight,
            commands::delete_highlight_group,
            pdf_commands::open_document,
            pdf_commands::close_document,
            pdf_commands::get_outline,
            pdf_commands::get_page_links,
            pdf_commands::extract_page_text,
            pdf_commands::search_document,
            pdf_commands::clip_pdf,
            pdf_commands::get_page_text_layer,
            pdf_commands::prerender_pages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
