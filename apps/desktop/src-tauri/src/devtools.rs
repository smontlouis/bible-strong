//! Development builds only: a picture of the page, for checks run where the screen cannot be
//! captured. The app's own page asks for it and the image lands in the app's cache
//! (`dev-snapshots/<name>.png`); nothing listens on the network. Release builds refuse it.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn snapshot_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("A snapshot name is letters, digits, - and _".into());
    }
    let directory = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("dev-snapshots");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(format!("{name}.png")))
}

#[cfg(all(debug_assertions, target_os = "macos"))]
async fn capture(app: &AppHandle) -> Result<Vec<u8>, String> {
    use block2::RcBlock;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::WKWebView;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;

    let window = app.get_webview_window("main").ok_or("no main window")?;
    let (sender, receiver) = oneshot::channel::<Option<Vec<u8>>>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    window
        .with_webview(move |platform| unsafe {
            let webview: &WKWebView = &*(platform.inner() as *const WKWebView);
            let handler = RcBlock::new(move |image: *mut NSImage, _error: *mut NSError| {
                let png = image.as_ref().and_then(|image| {
                    let tiff = image.TIFFRepresentation()?;
                    let representation = NSBitmapImageRep::imageRepWithData(&tiff)?;
                    representation
                        .representationUsingType_properties(
                            NSBitmapImageFileType::PNG,
                            &NSDictionary::new(),
                        )
                        .map(|data| data.to_vec())
                });
                if let Some(sender) = sender.lock().unwrap().take() {
                    let _ = sender.send(png);
                }
            });
            webview.takeSnapshotWithConfiguration_completionHandler(None, &handler);
        })
        .map_err(|error| error.to_string())?;
    receiver
        .await
        .map_err(|_| "dropped".to_string())?
        .ok_or_else(|| "snapshot failed".to_string())
}

#[cfg(not(all(debug_assertions, target_os = "macos")))]
async fn capture(_app: &AppHandle) -> Result<Vec<u8>, String> {
    Err("Snapshots exist in macOS development builds only".into())
}

#[tauri::command]
pub async fn dev_snapshot(app: AppHandle, name: String) -> Result<String, String> {
    let path = snapshot_path(&app, &name)?;
    let png = capture(&app).await?;
    std::fs::write(&path, png).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}
