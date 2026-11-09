//! The ground and the light or dark appearance of the reader's theme, so that no white shows
//! before a page paints and the title bar matches the page.
//!
//! JavaScript keeps the current theme's background and scheme in the key-value store
//! (`desktop.appearance`, written by `DesktopShell`). The next launch opens its window with that
//! color and appearance, and every page load gets it from the bootstrap script, before the
//! bundle runs.

use serde::Deserialize;
use tauri::{window::Color, Theme};

pub const KV_KEY: &str = "desktop.appearance";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Appearance {
    pub background: Color,
    pub dark: bool,
    /// The reader's theme follows the system: so does the window.
    pub follows_system: bool,
}

impl Appearance {
    pub fn window_theme(&self) -> Option<Theme> {
        window_theme(self.follows_system, self.dark)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Stored {
    background: String,
    #[serde(default)]
    scheme: Option<String>,
    #[serde(default)]
    follows_system: bool,
}

/// The title bar draws in the theme's appearance. A theme that follows the system leaves the
/// window to the system too: forced, the window would also answer the page's
/// `prefers-color-scheme`, and the theme could no longer see the system change.
fn window_theme(follows_system: bool, dark: bool) -> Option<Theme> {
    match (follows_system, dark) {
        (true, _) => None,
        (false, true) => Some(Theme::Dark),
        (false, false) => Some(Theme::Light),
    }
}

fn channel(value: &str) -> Option<u8> {
    value.trim().parse::<u8>().ok()
}

/// The palettes' color forms: `rgb(18,45,66)`, `rgba(…)` (opaque here), `#FFFAF8`, `#fff`.
pub fn parse_color(css: &str) -> Option<Color> {
    let css = css.trim();
    if let Some(hex) = css.strip_prefix('#') {
        let digits = match hex.len() {
            3 => hex.chars().flat_map(|c| [c, c]).collect::<String>(),
            6 => hex.to_string(),
            _ => return None,
        };
        let value = u32::from_str_radix(&digits, 16).ok()?;
        return Some(Color(
            (value >> 16) as u8,
            (value >> 8) as u8,
            value as u8,
            255,
        ));
    }
    let inner = css
        .strip_prefix("rgba(")
        .or_else(|| css.strip_prefix("rgb("))?
        .strip_suffix(')')?;
    let mut parts = inner.split(',');
    let color = Color(
        channel(parts.next()?)?,
        channel(parts.next()?)?,
        channel(parts.next()?)?,
        255,
    );
    // An alpha channel, if any, is ignored: the window behind the page is opaque.
    if parts.nth(1).is_some() {
        return None;
    }
    Some(color)
}

/// What `DesktopShell` stored, or nothing when it is missing or malformed.
pub fn parse_stored(value: &str) -> Option<Appearance> {
    let stored: Stored = serde_json::from_str(value).ok()?;
    Some(Appearance {
        background: parse_color(&stored.background)?,
        dark: stored.scheme.as_deref() == Some("dark"),
        follows_system: stored.follows_system,
    })
}

/// Paints the page with the stored ground before the bundle runs. Built from the parsed values
/// only, so nothing from the store reaches the script as written.
pub fn page_script(appearance: &Appearance) -> String {
    let Color(red, green, blue, _) = appearance.background;
    let scheme = if appearance.dark { "dark" } else { "light" };
    format!(
        "document.documentElement.style.backgroundColor='rgb({red}, {green}, {blue})';\
         document.documentElement.style.colorScheme='{scheme}';"
    )
}

/// The window and its webview take the theme's ground and appearance when the reader changes
/// theme.
#[tauri::command]
pub fn window_set_appearance(
    window: tauri::WebviewWindow,
    color: String,
    scheme: String,
    follows_system: bool,
) -> Result<(), String> {
    let color = parse_color(&color).ok_or_else(|| format!("Not a color: {color}"))?;
    window
        .set_background_color(Some(color))
        .map_err(|error| error.to_string())?;
    window
        .set_theme(window_theme(follows_system, scheme == "dark"))
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_palette_colors() {
        assert_eq!(parse_color("rgb(18,45,66)"), Some(Color(18, 45, 66, 255)));
        assert_eq!(
            parse_color(" rgb(0, 50, 100) "),
            Some(Color(0, 50, 100, 255))
        );
        assert_eq!(parse_color("rgba(0,0,0,0.5)"), Some(Color(0, 0, 0, 255)));
        assert_eq!(parse_color("#FFFAF8"), Some(Color(255, 250, 248, 255)));
        assert_eq!(parse_color("#fff"), Some(Color(255, 255, 255, 255)));
    }

    #[test]
    fn refuses_what_is_not_a_color() {
        for value in [
            "",
            "red",
            "#ffff",
            "rgb(300,0,0)",
            "rgb(1,2)",
            "rgb(1,2,3,4,5)",
            "rgb(1,2,3",
        ] {
            assert_eq!(parse_color(value), None, "{value}");
        }
    }

    #[test]
    fn reads_the_stored_appearance() {
        assert_eq!(
            parse_stored(r#"{"background":"rgb(18,45,66)","scheme":"dark"}"#),
            Some(Appearance {
                background: Color(18, 45, 66, 255),
                dark: true,
                follows_system: false,
            })
        );
        assert_eq!(
            parse_stored(r##"{"background":"#FFFAF8","scheme":"light"}"##).map(|a| a.dark),
            Some(false)
        );
        assert_eq!(
            parse_stored(r##"{"background":"#FFFAF8","scheme":"light","followsSystem":true}"##)
                .map(|a| a.follows_system),
            Some(true)
        );
        assert_eq!(parse_stored(r#"{"background":"red"}"#), None);
        assert_eq!(parse_stored("not json"), None);
    }

    #[test]
    fn writes_only_parsed_values_into_the_page_script() {
        let script = page_script(&Appearance {
            background: Color(18, 45, 66, 255),
            dark: true,
            follows_system: false,
        });
        assert_eq!(
            script,
            "document.documentElement.style.backgroundColor='rgb(18, 45, 66)';\
             document.documentElement.style.colorScheme='dark';"
        );
    }

    #[test]
    fn leaves_the_window_to_the_system_only_when_the_theme_follows_it() {
        assert_eq!(window_theme(false, true), Some(Theme::Dark));
        assert_eq!(window_theme(false, false), Some(Theme::Light));
        assert_eq!(window_theme(true, true), None);
        assert_eq!(window_theme(true, false), None);
    }
}
