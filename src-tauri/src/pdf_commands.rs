use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};

use tauri::State;

use crate::pdf_engine::PdfRequest;
use crate::pdf_models::{DocumentInfo, LinkAnnotation, OutlineEntry, PageTextLayer, SearchResult};

pub struct PdfState {
    pub sender: Mutex<Sender<PdfRequest>>,
    pub generation: Arc<AtomicU64>,
}

fn send_request<T>(
    state: &State<'_, PdfState>,
    request_fn: impl FnOnce(mpsc::SyncSender<Result<T, String>>) -> PdfRequest,
) -> Result<T, String> {
    let (tx, rx) = mpsc::sync_channel(1);
    let request = request_fn(tx);
    state
        .sender
        .lock()
        .map_err(|_| "PDF engine lock poisoned".to_string())?
        .send(request)
        .map_err(|_| "PDF engine disconnected".to_string())?;
    rx.recv()
        .map_err(|_| "PDF engine disconnected".to_string())?
}

#[tauri::command]
pub async fn open_document(
    path: String,
    state: State<'_, PdfState>,
) -> Result<DocumentInfo, String> {
    // Bump generation so the render thread skips stale renders queued before this.
    state.generation.fetch_add(1, Ordering::Relaxed);

    let sender = state
        .sender
        .lock()
        .map_err(|_| "PDF engine lock poisoned".to_string())?
        .clone();

    tokio::task::spawn_blocking(move || {
        let (tx, rx) = mpsc::sync_channel(1);
        sender
            .send(PdfRequest::OpenDocument { path, tx })
            .map_err(|_| "PDF engine disconnected".to_string())?;
        rx.recv()
            .map_err(|_| "PDF engine disconnected".to_string())?
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn close_document(
    path: String,
    state: State<'_, PdfState>,
) -> Result<(), String> {
    let sender = state
        .sender
        .lock()
        .map_err(|_| "PDF engine lock poisoned".to_string())?
        .clone();

    tokio::task::spawn_blocking(move || {
        let (tx, rx) = mpsc::sync_channel(1);
        sender
            .send(PdfRequest::CloseDocument { path, tx })
            .map_err(|_| "PDF engine disconnected".to_string())?;
        rx.recv()
            .map_err(|_| "PDF engine disconnected".to_string())?
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn prerender_pages(
    path: String,
    pages: Vec<u32>,
    width: i32,
    dpr: f32,
    state: State<'_, PdfState>,
) -> Result<(), String> {
    let sender = state
        .sender
        .lock()
        .map_err(|_| "PDF engine lock poisoned".to_string())?
        .clone();
    let generation = state.generation.load(Ordering::Relaxed);

    tokio::task::spawn_blocking(move || {
        let mut receivers = Vec::with_capacity(pages.len());
        for &page in &pages {
            let (tx, rx) = mpsc::sync_channel(1);
            sender
                .send(PdfRequest::RenderPage {
                    path: path.clone(),
                    page,
                    width,
                    dpr,
                    generation,
                    tx,
                })
                .map_err(|_| "PDF engine disconnected".to_string())?;
            receivers.push(rx);
        }

        // Wait for all renders to complete — results land in SharedRenderCache
        for rx in receivers {
            let _ = rx.recv();
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub fn get_outline(
    path: String,
    state: State<'_, PdfState>,
) -> Result<Vec<OutlineEntry>, String> {
    send_request(&state, |tx| PdfRequest::GetOutline {
        path,
        tx,
    })
}

#[tauri::command]
pub fn get_page_links(
    path: String,
    page: u32,
    state: State<'_, PdfState>,
) -> Result<Vec<LinkAnnotation>, String> {
    send_request(&state, |tx| PdfRequest::GetPageLinks {
        path,
        page,
        tx,
    })
}

#[tauri::command]
pub fn extract_page_text(
    path: String,
    page: u32,
    state: State<'_, PdfState>,
) -> Result<String, String> {
    send_request(&state, |tx| PdfRequest::ExtractPageText {
        path,
        page,
        tx,
    })
}

#[tauri::command]
pub fn search_document(
    path: String,
    query: String,
    state: State<'_, PdfState>,
) -> Result<Vec<SearchResult>, String> {
    send_request(&state, |tx| PdfRequest::SearchDocument {
        path,
        query,
        tx,
    })
}

#[tauri::command]
pub fn clip_pdf(
    source_path: String,
    start_page: u32,
    end_page: u32,
    output_path: String,
    state: State<'_, PdfState>,
) -> Result<(), String> {
    send_request(&state, |tx| PdfRequest::ClipPdf {
        source_path,
        start_page,
        end_page,
        output_path,
        tx,
    })
}

#[tauri::command]
pub fn get_page_text_layer(
    path: String,
    page: u32,
    state: State<'_, PdfState>,
) -> Result<PageTextLayer, String> {
    send_request(&state, |tx| PdfRequest::GetPageTextLayer {
        path,
        page,
        tx,
    })
}
