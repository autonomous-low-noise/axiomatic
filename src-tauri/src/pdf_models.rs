use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};

use lru::LruCache;
use serde::{Deserialize, Serialize};

/// Cache key for rendered page images. Shared between protocol handler and render thread.
#[derive(Debug, Hash, Eq, PartialEq, Clone)]
pub struct RenderKey {
    pub path: String,
    pub page: u32,
    pub width: i32,
    pub dpr_hundredths: u32,
}

/// Shared render cache — the protocol handler checks this BEFORE dispatching
/// to the render thread. Cache hits return instantly without blocking the main thread.
pub type SharedRenderCache = Arc<Mutex<LruCache<RenderKey, Vec<u8>>>>;

pub fn new_shared_render_cache() -> SharedRenderCache {
    Arc::new(Mutex::new(LruCache::new(NonZeroUsize::new(500).unwrap())))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentInfo {
    pub doc_id: String,
    pub page_count: u32,
    pub pages: Vec<PageDimension>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageDimension {
    pub width_pts: f32,
    pub height_pts: f32,
    pub aspect_ratio: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkAnnotation {
    pub rect: NormalizedRect,
    pub link_type: LinkType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum LinkType {
    #[serde(rename = "internal")]
    Internal { page: u32 },
    #[serde(rename = "external")]
    External { url: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextSpan {
    pub text: String,
    pub rect: NormalizedRect,
    pub char_rects: Vec<NormalizedRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageTextLayer {
    pub page: u32,
    pub spans: Vec<TextSpan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub page: u32,
    pub match_index: u32,
    pub rects: Vec<NormalizedRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineEntry {
    pub title: String,
    pub page: Option<u32>,
    pub children: Vec<OutlineEntry>,
}
