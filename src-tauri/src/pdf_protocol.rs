use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;

use tauri::http::{Request, Response};

use crate::pdf_engine::PdfRequest;
use crate::pdf_models::{RenderKey, SharedRenderCache};

/// Handle a `pdfium://` protocol request.
///
/// **Fast path**: check the shared render cache first. If the page was already
/// rendered at this size, return the cached JPEG immediately — no render thread
/// involvement, no main-thread blocking.
///
/// **Slow path** (cache miss): dispatch to the render thread and block until
/// the response is ready (this blocks the main thread on WebKitGTK).
///
/// URL format: `pdfium://localhost/render?path={encoded}&page={n}&width={px}&dpr={ratio}`
pub fn handle(
    sender: &Mutex<Sender<PdfRequest>>,
    generation: &AtomicU64,
    cache: &SharedRenderCache,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let uri = request.uri().to_string();
    let params = parse_query_params(&uri);

    let path = match params.get("path") {
        Some(p) => percent_decode(p),
        None => return error_response(400, "Missing 'path' parameter"),
    };
    let page: u32 = match params.get("page").and_then(|p| p.parse().ok()) {
        Some(p) if p >= 1 => p,
        _ => return error_response(400, "Missing or invalid 'page' parameter"),
    };
    let width: i32 = match params.get("width").and_then(|w| w.parse().ok()) {
        Some(w) if w > 0 => w,
        _ => return error_response(400, "Missing or invalid 'width' parameter"),
    };
    let dpr: f32 = params
        .get("dpr")
        .and_then(|d| d.parse().ok())
        .unwrap_or(1.0);

    let key = RenderKey {
        path: path.clone(),
        page,
        width,
        dpr_hundredths: (dpr * 100.0) as u32,
    };

    // ---- FAST PATH: return cached bytes without touching the render thread ----
    {
        let mut cache_lock = cache.lock().unwrap();
        if let Some(bytes) = cache_lock.get(&key) {
            return Response::builder()
                .status(200)
                .header("Content-Type", "image/jpeg")
                .header("Cache-Control", "max-age=3600, immutable")
                .body(bytes.clone())
                .unwrap();
        }
    }

    // ---- SLOW PATH: dispatch to render thread and block ----
    let gen = generation.load(Ordering::Relaxed);

    let (tx, rx) = mpsc::sync_channel(1);

    {
        let sender = match sender.lock() {
            Ok(s) => s,
            Err(_) => return error_response(500, "PDF engine lock poisoned"),
        };
        if sender
            .send(PdfRequest::RenderPage {
                path,
                page,
                width,
                dpr,
                generation: gen,
                tx,
            })
            .is_err()
        {
            return error_response(500, "PDF engine disconnected");
        }
    }

    match rx.recv() {
        Ok(Ok(jpeg_bytes)) => Response::builder()
            .status(200)
            .header("Content-Type", "image/jpeg")
            .header("Cache-Control", "max-age=3600, immutable")
            .body(jpeg_bytes)
            .unwrap(),
        Ok(Err(e)) => error_response(500, &e),
        Err(_) => error_response(500, "PDF engine disconnected"),
    }
}

fn error_response(status: u16, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .body(message.as_bytes().to_vec())
        .unwrap()
}

fn parse_query_params(uri: &str) -> HashMap<String, String> {
    let query = uri.split('?').nth(1).unwrap_or("");
    query
        .split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|param| {
            let mut parts = param.splitn(2, '=');
            let key = parts.next()?;
            let value = parts.next().unwrap_or("");
            Some((key.to_string(), value.to_string()))
        })
        .collect()
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut iter = input.bytes();
    while let Some(b) = iter.next() {
        match b {
            b'%' => {
                let hi = iter.next().unwrap_or(b'0');
                let lo = iter.next().unwrap_or(b'0');
                if let (Some(h), Some(l)) = (hex_val(hi), hex_val(lo)) {
                    bytes.push(h * 16 + l);
                } else {
                    bytes.push(b'%');
                    bytes.push(hi);
                    bytes.push(lo);
                }
            }
            b'+' => bytes.push(b' '),
            _ => bytes.push(b),
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}
