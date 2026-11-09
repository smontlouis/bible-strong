// No console window next to the app on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux: WebKitGTK's DMA-BUF renderer draws a blank window with NVIDIA's driver and in some
    // Wayland sessions. The shared-memory one costs a little speed and works everywhere. Set
    // before the webview and any thread start; a reader who sets the variable keeps their choice.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    bible_strong_desktop_lib::run()
}
