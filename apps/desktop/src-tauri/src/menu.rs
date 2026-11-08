//! The native menu bar.
//!
//! Items that drive the workspace carry the web app's own chords (`keymap.ts`) and only tell
//! JavaScript which shortcut to run, so one action never has two implementations. The Edit
//! menu also gives macOS its clipboard and undo key equivalents inside the webview.

use tauri::{
    menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
};

pub const EVENT: &str = "desktop://menu";

struct Labels {
    file: &'static str,
    edit: &'static str,
    view: &'static str,
    window: &'static str,
    help: &'static str,
    settings: &'static str,
    new_tab: &'static str,
    close_tab: &'static str,
    palette: &'static str,
    downloads: &'static str,
    sidebar: &'static str,
    shortcuts: &'static str,
    website: &'static str,
    support: &'static str,
    check_updates: &'static str,
}

const FRENCH: Labels = Labels {
    file: "Fichier",
    edit: "Édition",
    view: "Présentation",
    window: "Fenêtre",
    help: "Aide",
    settings: "Réglages…",
    new_tab: "Nouvel onglet",
    close_tab: "Fermer l'onglet",
    palette: "Rechercher une action…",
    downloads: "Téléchargements",
    sidebar: "Afficher ou masquer la barre latérale",
    shortcuts: "Raccourcis clavier",
    website: "Site de Bible Strong",
    support: "Nous contacter",
    check_updates: "Rechercher les mises à jour…",
};

const ENGLISH: Labels = Labels {
    file: "File",
    edit: "Edit",
    view: "View",
    window: "Window",
    help: "Help",
    settings: "Settings…",
    new_tab: "New Tab",
    close_tab: "Close Tab",
    palette: "Search Actions…",
    downloads: "Downloads",
    sidebar: "Show or Hide Sidebar",
    shortcuts: "Keyboard Shortcuts",
    website: "Bible Strong Website",
    support: "Contact Us",
    check_updates: "Check for Updates…",
};

/// ⌃ on a Mac, Alt elsewhere: the workspace family of `keymap.ts`.
fn workspace(key: &str) -> String {
    if cfg!(target_os = "macos") {
        format!("Ctrl+{key}")
    } else {
        format!("Alt+{key}")
    }
}

pub fn build<R: Runtime>(app: &AppHandle<R>, language: &str) -> tauri::Result<Menu<R>> {
    let labels = if language == "en" { &ENGLISH } else { &FRENCH };
    let item = |id: &str, label: &str, accelerator: Option<String>| {
        MenuItem::with_id(app, id, label, true, accelerator.as_deref())
    };

    let file = SubmenuBuilder::new(app, labels.file)
        .item(&item(
            "shortcut:newTab",
            labels.new_tab,
            Some(workspace("T")),
        )?)
        .item(&item(
            "shortcut:closeTab",
            labels.close_tab,
            Some(workspace("W")),
        )?)
        .separator()
        .item(&item(
            "shortcut:palette",
            labels.palette,
            Some("CmdOrCtrl+K".into()),
        )?)
        .item(&item("navigate:/downloads", labels.downloads, None)?);
    #[cfg(not(target_os = "macos"))]
    let file = file
        .separator()
        .item(&item(
            "navigate:/more",
            labels.settings,
            Some("Ctrl+,".into()),
        )?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?);

    let edit = SubmenuBuilder::new(app, labels.edit)
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?);

    let view = SubmenuBuilder::new(app, labels.view)
        .item(&item(
            "shortcut:sidebar",
            labels.sidebar,
            Some("CmdOrCtrl+B".into()),
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?);

    let window = SubmenuBuilder::new(app, labels.window)
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?);

    let mut help = SubmenuBuilder::new(app, labels.help)
        .item(&item(
            "navigate:/keyboard-shortcuts",
            labels.shortcuts,
            None,
        )?)
        .separator()
        .item(&item(
            "open:https://bible-strong.app",
            labels.website,
            None,
        )?)
        .item(&item("navigate:/support", labels.support, None)?);
    if cfg!(feature = "updater") {
        help = help
            .separator()
            .item(&item("updates:check", labels.check_updates, None)?);
    }

    // Only macOS adds the application menu in front of the others.
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        let about = AboutMetadataBuilder::new()
            .website(Some("https://bible-strong.app"))
            .build();
        let app_menu = SubmenuBuilder::new(app, "Bible Strong")
            .item(&PredefinedMenuItem::about(app, None, Some(about))?)
            .separator()
            .item(&item(
                "navigate:/more",
                labels.settings,
                Some("Cmd+,".into()),
            )?)
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        menu = menu.item(&app_menu);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = AboutMetadataBuilder::new;
    menu.item(&file.build()?)
        .item(&edit.build()?)
        .item(&view.build()?)
        .item(&window.build()?)
        .item(&help.build()?)
        .build()
}

pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
    let _ = app.emit_to("main", EVENT, id);
}

#[tauri::command]
pub fn menu_set_language(app: AppHandle, language: String) -> Result<(), String> {
    let menu = build(&app, &language).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}
