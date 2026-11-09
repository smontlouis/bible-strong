//! Bible Strong for macOS, Windows and Linux (ADR-0107).
//!
//! The window shows the Expo web export. Native commands stand in for the mobile modules the
//! Offline-copy pipeline needs, so that pipeline runs unchanged in the webview.

mod appearance;
mod archive;
mod bootstrap;
mod devtools;
mod download;
mod files;
mod kv;
mod menu;
mod paths;
mod sign_in;
mod sqlite;

use std::time::Duration;
use tauri::{
    utils::config::{BackgroundThrottlingPolicy, WindowConfig},
    webview::PageLoadEvent,
    Emitter, LogicalSize, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_deep_link::DeepLinkExt;

const OPEN_URL_EVENT: &str = "desktop://open-url";
const FLUSH_EVENT: &str = "desktop://flush";

/// A new page cannot finish what the previous one started: its connections would keep their
/// locks (and, on Windows, their files), and its downloads would write for nobody.
fn release_page_resources(app: &tauri::AppHandle) {
    app.state::<sqlite::Databases>().close_all();
    app.state::<download::Downloads>().cancel_all();
    sign_in::cancel(&app.state::<sign_in::SignIn>());
}

/// The smallest window: always the wide workspace (the narrow layout starts below 768), whose
/// headers leave room for the window buttons.
const MIN_WIDTH: f64 = 800.0;
const MIN_HEIGHT: f64 = 540.0;

fn create_main_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut config = WindowConfig {
        label: "main".into(),
        url: WebviewUrl::App("index.html".into()),
        ..Default::default()
    };
    // macOS: no title bar. The window buttons sit over the sidebar's top, centred 35 points
    // from the top like the page headers (y is the top of the buttons plus 9), and the page
    // leaves them their room (`windowControls.ts` counts on the first at x 16). Set on the window
    // through its config, the position survives the title changes, which put the buttons back
    // in their default place otherwise. The title still names the window in Mission Control and
    // the Window menu.
    #[cfg(target_os = "macos")]
    {
        config.title_bar_style = tauri::TitleBarStyle::Overlay;
        config.hidden_title = true;
        config.traffic_light_position =
            Some(tauri::utils::config::LogicalPosition { x: 16.0, y: 37.0 });
    }
    let mut builder = WebviewWindowBuilder::from_config(app, &config)?;
    // The last theme's ground and appearance, so that the window is not white before the first
    // paint and its title bar matches the page.
    let stored = app.state::<kv::KvStore>().get(appearance::KV_KEY);
    if let Some(stored) = stored
        .ok()
        .flatten()
        .and_then(|value| appearance::parse_stored(&value))
    {
        builder = builder
            .background_color(stored.background)
            .theme(stored.window_theme());
    }
    let window = builder
        .title("Bible Strong")
        .inner_size(1280.0, 840.0)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .initialization_script(bootstrap::initialization_script())
        // One origin for good: changing it later would lose the webview's stored data.
        .use_https_scheme(true)
        // The workspace uses HTML drag and drop, which a native file-drop handler disables.
        .disable_drag_drop_handler()
        // A hidden window keeps installing Offline copies. macOS 14+ only: elsewhere DesktopShell
        // holds a Web Lock while the queue runs, which keeps Chromium from freezing the page.
        .background_throttling(BackgroundThrottlingPolicy::Disabled)
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Started {
                release_page_resources(window.app_handle());
            }
        })
        .build()?;
    // The saved window state is restored as it was, even below the minimum (an older version
    // allowed 760 points).
    let scale = window.scale_factor()?;
    let size = window.inner_size()?.to_logical::<f64>(scale);
    if size.width < MIN_WIDTH || size.height < MIN_HEIGHT {
        window.set_size(LogicalSize::new(
            size.width.max(MIN_WIDTH),
            size.height.max(MIN_HEIGHT),
        ))?;
    }
    Ok(())
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn app_exit(app: tauri::AppHandle) {
    app.exit(0);
}

/// The system's print dialog for the page, which prints with its print styles. WKWebView ignores
/// `window.print()`; its print operation does not.
#[tauri::command]
fn webview_print(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}

pub fn run() {
    let builder = tauri::Builder::default()
        // First, so that a second launch only hands its links to the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app)
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build());
    #[cfg(feature = "updater")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .register_uri_scheme_protocol(bootstrap::SCHEME, bootstrap::handle)
        .invoke_handler(tauri::generate_handler![
            app_exit,
            webview_print,
            appearance::window_set_appearance,
            archive::archive_unzip,
            archive::archive_extract_encrypted,
            devtools::dev_snapshot,
            download::download_start,
            download::download_cancel,
            files::fs_info,
            files::fs_delete,
            files::fs_mkdir,
            files::fs_move,
            files::fs_copy,
            files::fs_read_bytes,
            files::fs_write_string,
            files::fs_read_dir,
            files::fs_disk_space,
            files::fs_sha256,
            kv::kv_apply,
            menu::menu_set_language,
            sign_in::sign_in_start,
            sign_in::sign_in_result,
            sign_in::sign_in_cancel,
            sqlite::sqlite_open,
            sqlite::sqlite_close,
            sqlite::sqlite_all,
            sqlite::sqlite_first,
            sqlite::sqlite_run,
            sqlite::sqlite_exec,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let documents = app.path().app_data_dir()?;
            let cache = app.path().app_cache_dir()?;
            std::fs::create_dir_all(&documents)?;
            std::fs::create_dir_all(&cache)?;
            let store = kv::KvStore::open(&documents.join("desktop-kv.sqlite"))
                .map_err(std::io::Error::other)?;
            app.manage(store);
            app.manage(bootstrap::AppDirectories { documents, cache });
            app.manage(sqlite::Databases::default());
            app.manage(sign_in::SignIn::default());
            app.manage(download::Downloads::new(format!(
                "BibleStrongDesktop/{} ({})",
                app.package_info().version,
                bootstrap::platform()
            )));

            let menu = menu::build(&handle, "fr")?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| menu::forward(app, event.id().as_ref()));

            // Windows and Linux learn the scheme at run time; macOS reads it from Info.plist.
            #[cfg(any(windows, target_os = "linux"))]
            let _ = app.deep_link().register_all();
            let links = handle.clone();
            app.deep_link().on_open_url(move |event| {
                let urls: Vec<String> = event.urls().iter().map(ToString::to_string).collect();
                focus_main_window(&links);
                let _ = links.emit_to("main", OPEN_URL_EVENT, urls);
            });

            create_main_window(&handle)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Bible Strong");

    app.run(|app, event| {
        // Gives JavaScript a moment to send its last key-value writes before the process ends.
        if let RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() && app.get_webview_window("main").is_some() {
                api.prevent_exit();
                let _ = app.emit_to("main", FLUSH_EVENT, ());
                let handle = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(2));
                    handle.exit(0);
                });
            }
        }
    });
}
