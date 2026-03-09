use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc;

use crossbeam_channel::Sender;

static PROTOCOL_INFLIGHT: AtomicUsize = AtomicUsize::new(0);
const MAX_PROTOCOL_THREADS: usize = 4;

use tauri::http::{Request, Response};

use crate::pdf_engine::PdfRequest;
use crate::pdf_models::{RenderKey, SharedRenderCache};

/// Handle a `pdfium://` protocol request asynchronously.
///
/// **Fast path**: check the shared render cache first. If the page was already
/// rendered at this size, return the cached JPEG immediately via `responder` —
/// no render thread involvement, no main-thread blocking.
///
/// **Slow path** (cache miss): dispatch to the render thread, spawn a
/// short-lived thread to `recv()` and call `responder.respond()`. The main
/// thread returns immediately — no freeze, no timeout, no 503.
///
/// URL format: `pdfium://localhost/render?path={encoded}&page={n}&width={px}&dpr={ratio}`
pub fn handle_async(
    sender: &Sender<PdfRequest>,
    generation: &AtomicU64,
    cache: &SharedRenderCache,
    request: Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let uri = request.uri().to_string();
    let params = parse_query_params(&uri);

    let path = match params.get("path") {
        Some(p) => percent_decode(p),
        None => { responder.respond(error_response(400, "Missing 'path' parameter")); return; }
    };
    let page: u32 = match params.get("page").and_then(|p| p.parse().ok()) {
        Some(p) if p >= 1 => p,
        _ => { responder.respond(error_response(400, "Missing or invalid 'page' parameter")); return; }
    };
    let width: i32 = match params.get("width").and_then(|w| w.parse().ok()) {
        Some(w) if w > 0 => w,
        _ => { responder.respond(error_response(400, "Missing or invalid 'width' parameter")); return; }
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
            responder.respond(jpeg_response(bytes.clone()));
            return;
        }
    }

    // ---- SLOW PATH: dispatch to render thread, respond from spawned thread ----
    if PROTOCOL_INFLIGHT.load(Ordering::Relaxed) >= MAX_PROTOCOL_THREADS {
        responder.respond(error_response(503, "render busy"));
        return;
    }

    let gen = generation.load(Ordering::Relaxed);

    let (tx, rx) = mpsc::sync_channel(1);

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
        responder.respond(error_response(500, "PDF engine disconnected"));
        return;
    }

    PROTOCOL_INFLIGHT.fetch_add(1, Ordering::Relaxed);
    std::thread::spawn(move || {
        let result = match rx.recv() {
            Ok(Ok(jpeg_bytes)) => jpeg_response(jpeg_bytes),
            Ok(Err(e)) => error_response(500, &e),
            Err(_) => error_response(500, "PDF engine disconnected"),
        };
        PROTOCOL_INFLIGHT.fetch_sub(1, Ordering::Relaxed);
        responder.respond(result);
    });
}

fn jpeg_response(bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("Content-Type", "image/jpeg")
        .header("Cache-Control", "max-age=3600, immutable")
        .body(bytes)
        .unwrap()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_query_params_basic() {
        let uri = "pdfium://localhost/render?path=foo&page=1&width=800&dpr=2";
        let params = parse_query_params(uri);
        assert_eq!(params.get("path").unwrap(), "foo");
        assert_eq!(params.get("page").unwrap(), "1");
        assert_eq!(params.get("width").unwrap(), "800");
        assert_eq!(params.get("dpr").unwrap(), "2");
    }

    #[test]
    fn test_parse_query_params_empty() {
        let uri = "pdfium://localhost/render";
        let params = parse_query_params(uri);
        assert!(params.is_empty());
    }

    #[test]
    fn test_parse_query_params_missing_value() {
        let uri = "pdfium://localhost/render?page=";
        let params = parse_query_params(uri);
        assert_eq!(params.get("page").unwrap(), "");
    }

    #[test]
    fn test_percent_decode_paths() {
        assert_eq!(
            percent_decode("%2Fhome%2Fuser%2Ftest.pdf"),
            "/home/user/test.pdf"
        );
    }

    #[test]
    fn test_percent_decode_plus_to_space() {
        assert_eq!(percent_decode("hello+world"), "hello world");
    }

    #[test]
    fn test_error_response_status_and_body() {
        let resp = error_response(404, "not found");
        assert_eq!(resp.status(), 404);
        assert_eq!(resp.body(), b"not found");
    }

    #[test]
    fn test_jpeg_response_headers() {
        let resp = jpeg_response(vec![1, 2, 3]);
        assert_eq!(resp.status(), 200);
        assert_eq!(
            resp.headers().get("Content-Type").unwrap(),
            "image/jpeg"
        );
        assert_eq!(
            resp.headers().get("Cache-Control").unwrap(),
            "max-age=3600, immutable"
        );
        assert_eq!(resp.body(), &vec![1, 2, 3]);
    }

    #[test]
    fn test_render_key_dpr_hundredths_precision() {
        use crate::pdf_models::RenderKey;

        let key1 = RenderKey {
            path: "a.pdf".into(),
            page: 1,
            width: 800,
            dpr_hundredths: (1.0_f32 * 100.0) as u32,
        };
        assert_eq!(key1.dpr_hundredths, 100);

        let key2 = RenderKey {
            path: "a.pdf".into(),
            page: 1,
            width: 800,
            dpr_hundredths: (1.5_f32 * 100.0) as u32,
        };
        assert_eq!(key2.dpr_hundredths, 150);

        let key3 = RenderKey {
            path: "a.pdf".into(),
            page: 1,
            width: 800,
            dpr_hundredths: (2.0_f32 * 100.0) as u32,
        };
        assert_eq!(key3.dpr_hundredths, 200);

        // Different DPR → different keys
        assert_ne!(key1, key2);
        assert_ne!(key2, key3);
    }

    #[test]
    fn test_percent_decode_invalid_hex_passthrough() {
        // Invalid hex digits — preserved as-is
        assert_eq!(percent_decode("%ZZ"), "%ZZ");
        assert_eq!(percent_decode("%GH"), "%GH");

        // Truncated percent at end — consumes next 2 bytes (unwrap_or(b'0'))
        // "abc%" has no following bytes, so hi=b'0', lo=b'0' → 0x00
        assert_eq!(percent_decode("abc%"), "abc\0");

        // Mixed valid and invalid
        assert_eq!(percent_decode("%2Fhome%ZZtest"), "/home%ZZtest");
    }

    #[test]
    fn test_parse_query_params_special_chars() {
        // Encoded special chars in values
        let uri = "pdfium://localhost/render?path=%2Fhome%2Fuser%2Fmy+book.pdf&page=1&tag=math%26science";
        let params = parse_query_params(uri);
        // parse_query_params does NOT decode — it returns raw query values
        assert_eq!(params.get("path").unwrap(), "%2Fhome%2Fuser%2Fmy+book.pdf");
        assert_eq!(params.get("page").unwrap(), "1");
        assert_eq!(params.get("tag").unwrap(), "math%26science");

        // Multiple '=' in value — only splits on first
        let uri2 = "pdfium://localhost/render?expr=a%3Db%3Dc";
        let params2 = parse_query_params(uri2);
        assert_eq!(params2.get("expr").unwrap(), "a%3Db%3Dc");
    }
}
