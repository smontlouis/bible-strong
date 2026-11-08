//! State the bundle reads synchronously before it runs.
//!
//! The mobile code reads its directories, its key-value store and the archive key versions
//! synchronously, some of them when modules load. The page's `index.html` loads
//! `bsboot://localhost/bootstrap.js` as a blocking script before the bundle, and this protocol
//! answers it from the current state on every page load, reloads included.

use serde::Serialize;
use std::{borrow::Cow, collections::BTreeMap, path::PathBuf};
use tauri::{http, Manager, Runtime, UriSchemeContext};

use crate::{appearance, archive, kv::KvStore, paths::to_uri};

pub const SCHEME: &str = "bsboot";

pub struct AppDirectories {
    pub documents: PathBuf,
    pub cache: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap<'a> {
    document_directory: String,
    cache_directory: String,
    archive_key_versions: Vec<u32>,
    platform: &'static str,
    app_version: String,
    updater: bool,
    kv: &'a BTreeMap<String, String>,
}

pub fn platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(windows) {
        "windows"
    } else {
        "linux"
    }
}

/// The address `index.html` loads, which differs by webview (see `register_uri_scheme_protocol`).
pub fn bootstrap_url() -> &'static str {
    if cfg!(windows) {
        "https://bsboot.localhost/bootstrap.js"
    } else {
        "bsboot://localhost/bootstrap.js"
    }
}

pub fn initialization_script() -> String {
    format!(
        "window.__BIBLE_STRONG_BOOTSTRAP_URL__ = {};",
        serde_json::to_string(bootstrap_url()).unwrap()
    )
}

fn script<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<String, String> {
    let directories = app.state::<AppDirectories>();
    let kv = app.state::<KvStore>().snapshot()?;
    let bootstrap = Bootstrap {
        document_directory: to_uri(&directories.documents, true),
        cache_directory: to_uri(&directories.cache, true),
        archive_key_versions: archive::available_key_versions(),
        platform: platform(),
        app_version: app.package_info().version.to_string(),
        updater: cfg!(feature = "updater"),
        kv: &kv,
    };
    let json = serde_json::to_string(&bootstrap).map_err(|error| error.to_string())?;
    let ground = kv
        .get(appearance::KV_KEY)
        .and_then(|value| appearance::parse_stored(value))
        .map(|stored| appearance::page_script(&stored))
        .unwrap_or_default();
    Ok(format!("window.__BIBLE_STRONG_DESKTOP__ = {json};{ground}"))
}

pub fn handle<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Cow<'static, [u8]>> {
    let response = http::Response::builder()
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-store");
    if request.uri().path() != "/bootstrap.js" {
        return response.status(404).body(Cow::Borrowed(&[][..])).unwrap();
    }
    match script(context.app_handle()) {
        Ok(body) => response
            .header("Content-Type", "text/javascript; charset=utf-8")
            .body(Cow::Owned(body.into_bytes()))
            .unwrap(),
        Err(error) => {
            log::error!("bootstrap failed: {error}");
            // The bundle refuses to start without its state rather than starting empty.
            response
                .header("Content-Type", "text/javascript; charset=utf-8")
                .body(Cow::Owned(
                    format!(
                        "window.__BIBLE_STRONG_DESKTOP_ERROR__ = {};",
                        serde_json::to_string(&error).unwrap()
                    )
                    .into_bytes(),
                ))
                .unwrap()
        }
    }
}
