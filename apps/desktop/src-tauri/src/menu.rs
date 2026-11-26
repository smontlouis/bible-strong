//! The native menu bar.
//!
//! Items that drive the workspace carry the web app's own chords (`keymap.ts`) and only tell
//! JavaScript which shortcut to run, so one action never has two implementations. The Edit
//! menu also gives macOS its clipboard and undo key equivalents inside the webview. The Bible
//! menu's shortcuts are bare keys (arrows, letters): a native key equivalent would take them
//! from every text field, so its items carry none. The desktop app follows the system's
//! conventions for its tabs (⌘T, ⌘W, ⌃⇥) and its search (⌘F), so closing the window takes ⇧⌘W.
//!
//! The page sends what the menu lists of the workspace (`useDesktopMenu.ts`): its language, the
//! tabs of the active group for the Window menu, and the last passages read for File › Open
//! Recent. The menu is rebuilt from it whenever it changes.

use serde::Deserialize;
use tauri::{
    menu::{
        AboutMetadataBuilder, CheckMenuItem, Menu, MenuBuilder, MenuItem, PredefinedMenuItem,
        SubmenuBuilder,
    },
    AppHandle, Emitter, Manager, Runtime,
};

pub const EVENT: &str = "desktop://menu";

struct Labels {
    file: &'static str,
    edit: &'static str,
    view: &'static str,
    bible: &'static str,
    window: &'static str,
    help: &'static str,
    settings: &'static str,
    new_tab: &'static str,
    close_tab: &'static str,
    palette: &'static str,
    downloads: &'static str,
    print: &'static str,
    sidebar: &'static str,
    text_larger: &'static str,
    text_smaller: &'static str,
    text_actual_size: &'static str,
    find: &'static str,
    previous_tab: &'static str,
    next_tab: &'static str,
    close_window: &'static str,
    previous_chapter: &'static str,
    next_chapter: &'static str,
    go_to_verse: &'static str,
    presentation: &'static str,
    compare: &'static str,
    shortcuts: &'static str,
    tour: &'static str,
    website: &'static str,
    support: &'static str,
    check_updates: &'static str,
    open_recent: &'static str,
    no_recents: &'static str,
    clear_recents: &'static str,
}

const FRENCH: Labels = Labels {
    file: "Fichier",
    edit: "Édition",
    view: "Présentation",
    bible: "Bible",
    window: "Fenêtre",
    help: "Aide",
    settings: "Réglages…",
    new_tab: "Nouvel onglet",
    close_tab: "Fermer l'onglet",
    palette: "Rechercher une action…",
    downloads: "Téléchargements",
    print: "Imprimer…",
    sidebar: "Afficher ou masquer la barre latérale",
    text_larger: "Agrandir le texte",
    text_smaller: "Réduire le texte",
    text_actual_size: "Taille réelle",
    find: "Rechercher…",
    previous_tab: "Onglet précédent",
    next_tab: "Onglet suivant",
    close_window: "Fermer la fenêtre",
    previous_chapter: "Chapitre précédent",
    next_chapter: "Chapitre suivant",
    go_to_verse: "Aller au verset…",
    presentation: "Texte, Strong ou interlinéaire",
    compare: "Comparer les versets sélectionnés",
    shortcuts: "Raccourcis clavier",
    tour: "Revoir la découverte",
    website: "Site de Bible Strong",
    support: "Nous contacter",
    check_updates: "Rechercher les mises à jour…",
    open_recent: "Passages récents",
    no_recents: "Aucun passage récent",
    clear_recents: "Effacer le menu",
};

const ENGLISH: Labels = Labels {
    file: "File",
    edit: "Edit",
    view: "View",
    bible: "Bible",
    window: "Window",
    help: "Help",
    settings: "Settings…",
    new_tab: "New Tab",
    close_tab: "Close Tab",
    palette: "Search Actions…",
    downloads: "Downloads",
    print: "Print…",
    sidebar: "Show or Hide Sidebar",
    text_larger: "Make Text Bigger",
    text_smaller: "Make Text Smaller",
    text_actual_size: "Actual Size",
    find: "Find…",
    previous_tab: "Previous Tab",
    next_tab: "Next Tab",
    close_window: "Close Window",
    previous_chapter: "Previous Chapter",
    next_chapter: "Next Chapter",
    go_to_verse: "Go to Verse…",
    presentation: "Text, Strong or Interlinear",
    compare: "Compare Selected Verses",
    shortcuts: "Keyboard Shortcuts",
    tour: "Replay the Introduction",
    website: "Bible Strong Website",
    support: "Contact Us",
    check_updates: "Check for Updates…",
    open_recent: "Open Recent",
    no_recents: "No Recent Passages",
    clear_recents: "Clear Menu",
};

/// A tab of the active group, as the Window menu lists it.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MenuTab {
    pub id: String,
    pub title: String,
    pub active: bool,
}

/// A passage read recently, as File › Open Recent lists it.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MenuRecent {
    pub id: String,
    pub label: String,
}

/// What the menu shows of the workspace (`desktopMenuState.ts`).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct MenuState {
    pub language: String,
    pub tabs: Vec<MenuTab>,
    pub recents: Vec<MenuRecent>,
}

/// Text from the workspace, shown as it is: Windows and Linux read `&` as the mark of a mnemonic.
fn literal(text: &str) -> String {
    if cfg!(target_os = "macos") {
        text.to_owned()
    } else {
        text.replace('&', "&&")
    }
}

pub fn build<R: Runtime>(app: &AppHandle<R>, state: &MenuState) -> tauri::Result<Menu<R>> {
    let labels = if state.language == "en" {
        &ENGLISH
    } else {
        &FRENCH
    };
    let item = |id: &str, label: &str, accelerator: Option<String>| {
        MenuItem::with_id(app, id, label, true, accelerator.as_deref())
    };

    let mut recent = SubmenuBuilder::new(app, labels.open_recent);
    if state.recents.is_empty() {
        recent = recent.item(&MenuItem::with_id(
            app,
            "recents:none",
            labels.no_recents,
            false,
            None::<&str>,
        )?);
    }
    for passage in &state.recents {
        recent = recent.item(&item(
            &format!("recent:{}", passage.id),
            &literal(&passage.label),
            None,
        )?);
    }
    let recent = recent
        .separator()
        .item(&MenuItem::with_id(
            app,
            "recents:clear",
            labels.clear_recents,
            !state.recents.is_empty(),
            None::<&str>,
        )?)
        .build()?;

    let file = SubmenuBuilder::new(app, labels.file)
        .item(&item(
            "shortcut:newTab",
            labels.new_tab,
            Some("CmdOrCtrl+T".into()),
        )?)
        .item(&item(
            "shortcut:closeTab",
            labels.close_tab,
            Some("CmdOrCtrl+W".into()),
        )?)
        .separator()
        .item(&recent)
        .separator()
        .item(&item(
            "shortcut:palette",
            labels.palette,
            Some("CmdOrCtrl+K".into()),
        )?)
        .item(&item("navigate:/downloads", labels.downloads, None)?)
        .separator()
        .item(&item("print:", labels.print, Some("CmdOrCtrl+P".into()))?);
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
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&item(
            "shortcut:find",
            labels.find,
            Some("CmdOrCtrl+F".into()),
        )?);

    let view = SubmenuBuilder::new(app, labels.view)
        .item(&item(
            "shortcut:sidebar",
            labels.sidebar,
            Some("CmdOrCtrl+B".into()),
        )?)
        .separator()
        // The reader's text size setting, as Mac reading apps do (`DesktopShell`).
        .item(&item(
            "text:larger",
            labels.text_larger,
            Some("CmdOrCtrl+=".into()),
        )?)
        .item(&item(
            "text:smaller",
            labels.text_smaller,
            Some("CmdOrCtrl+-".into()),
        )?)
        .item(&item(
            "text:reset",
            labels.text_actual_size,
            Some("CmdOrCtrl+0".into()),
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?);

    let bible = SubmenuBuilder::new(app, labels.bible)
        .item(&item(
            "shortcut:previousChapter",
            labels.previous_chapter,
            None,
        )?)
        .item(&item("shortcut:nextChapter", labels.next_chapter, None)?)
        .item(&item("shortcut:goToVerse", labels.go_to_verse, None)?)
        .separator()
        .item(&item("shortcut:strongMode", labels.presentation, None)?)
        .separator()
        .item(&item("shortcut:compare", labels.compare, None)?);

    let mut window = SubmenuBuilder::new(app, labels.window)
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&item(
            "shortcut:previousTab",
            labels.previous_tab,
            Some("Ctrl+Shift+Tab".into()),
        )?)
        .item(&item(
            "shortcut:nextTab",
            labels.next_tab,
            Some("Ctrl+Tab".into()),
        )?)
        .separator()
        // ⌘W closes a tab, as in a browser: the window takes ⇧⌘W.
        .item(&item(
            "window:close",
            labels.close_window,
            Some("CmdOrCtrl+Shift+W".into()),
        )?);
    // The open tabs of the active group, the active one checked, as a browser lists its tabs.
    if !state.tabs.is_empty() {
        window = window.separator();
        for tab in &state.tabs {
            window = window.item(&CheckMenuItem::with_id(
                app,
                format!("tab:{}", tab.id),
                literal(&tab.title),
                true,
                tab.active,
                None::<&str>,
            )?);
        }
    }

    let mut help = SubmenuBuilder::new(app, labels.help)
        .item(&item(
            "navigate:/keyboard-shortcuts",
            labels.shortcuts,
            None,
        )?)
        .item(&item("onboarding:replay", labels.tour, None)?)
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
        .item(&bible.build()?)
        .item(&window.build()?)
        .item(&help.build()?)
        .build()
}

pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if id == "window:close" {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.close();
        }
        return;
    }
    let _ = app.emit_to("main", EVENT, id);
}

#[tauri::command]
pub fn menu_update(app: AppHandle, state: MenuState) -> Result<(), String> {
    let menu = build(&app, &state).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::literal;

    #[test]
    fn keeps_an_ampersand_of_the_workspace_literal() {
        let expected = if cfg!(target_os = "macos") {
            "Notes & études"
        } else {
            "Notes && études"
        };
        assert_eq!(literal("Notes & études"), expected);
    }
}
