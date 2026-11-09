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

/// macOS: the window is transparent over the system's sidebar material (`create_main_window`),
/// tinted with the theme by a native view (`material.rs`). The page lets both through where it
/// marks `data-window-material`, so the shell paints no ground of its own there.
pub const WINDOW_MATERIAL: bool = cfg!(target_os = "macos");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Appearance {
    pub background: Color,
    pub dark: bool,
    /// The reader's theme follows the system: so does the window.
    pub follows_system: bool,
    /// The theme's tint over the window's material, translucent.
    pub tint: Option<Color>,
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
    #[serde(default)]
    tint: Option<String>,
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

/// A translucent color: `rgba(14, 21, 33, 0.65)`, its alpha kept.
pub fn parse_tint(css: &str) -> Option<Color> {
    let inner = css.trim().strip_prefix("rgba(")?.strip_suffix(')')?;
    let mut parts = inner.split(',');
    let red = channel(parts.next()?)?;
    let green = channel(parts.next()?)?;
    let blue = channel(parts.next()?)?;
    let alpha = parts.next()?.trim().parse::<f64>().ok()?;
    if parts.next().is_some() || !(0.0..=1.0).contains(&alpha) {
        return None;
    }
    Some(Color(red, green, blue, (alpha * 255.0).round() as u8))
}

/// What `DesktopShell` stored, or nothing when it is missing or malformed.
pub fn parse_stored(value: &str) -> Option<Appearance> {
    let stored: Stored = serde_json::from_str(value).ok()?;
    Some(Appearance {
        background: parse_color(&stored.background)?,
        dark: stored.scheme.as_deref() == Some("dark"),
        follows_system: stored.follows_system,
        tint: stored.tint.as_deref().and_then(parse_tint),
    })
}

/// Marks the page, before the bundle runs, to let the window's material through.
pub fn material_script(material: bool) -> &'static str {
    if material {
        "document.documentElement.setAttribute('data-window-material','');"
    } else {
        ""
    }
}

/// Paints the page with the stored ground before the bundle runs, or over a material only sets
/// its scheme. Built from the parsed values only, so nothing from the store reaches the script
/// as written.
pub fn page_script(appearance: &Appearance, material: bool) -> String {
    let scheme = if appearance.dark { "dark" } else { "light" };
    if material {
        return format!("document.documentElement.style.colorScheme='{scheme}';");
    }
    let Color(red, green, blue, _) = appearance.background;
    format!(
        "document.documentElement.style.backgroundColor='rgb({red}, {green}, {blue})';\
         document.documentElement.style.colorScheme='{scheme}';"
    )
}

/// The window and its webview take the theme's ground and appearance when the reader changes
/// theme, and on macOS its tint over the material.
#[tauri::command]
pub fn window_set_appearance(
    window: tauri::WebviewWindow,
    color: String,
    scheme: String,
    follows_system: bool,
    tint: Option<String>,
) -> Result<(), String> {
    let color = parse_color(&color).ok_or_else(|| format!("Not a color: {color}"))?;
    if WINDOW_MATERIAL {
        crate::material::set_tint(&window, tint.as_deref().and_then(parse_tint))
            .map_err(|error| error.to_string())?;
    } else {
        window
            .set_background_color(Some(color))
            .map_err(|error| error.to_string())?;
    }
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
                tint: None,
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
        let appearance = Appearance {
            background: Color(18, 45, 66, 255),
            dark: true,
            follows_system: false,
            tint: None,
        };
        assert_eq!(
            page_script(&appearance, false),
            "document.documentElement.style.backgroundColor='rgb(18, 45, 66)';\
             document.documentElement.style.colorScheme='dark';"
        );
    }

    #[test]
    fn paints_no_ground_over_the_material() {
        let appearance = Appearance {
            background: Color(18, 45, 66, 255),
            dark: true,
            follows_system: false,
            tint: None,
        };
        assert_eq!(
            page_script(&appearance, true),
            "document.documentElement.style.colorScheme='dark';"
        );
        assert_eq!(
            material_script(true),
            "document.documentElement.setAttribute('data-window-material','');"
        );
        assert_eq!(material_script(false), "");
    }

    #[test]
    fn reads_the_tint_with_its_alpha() {
        assert_eq!(
            parse_tint("rgba(14, 21, 33, 0.65)"),
            Some(Color(14, 21, 33, 166))
        );
        assert_eq!(
            parse_tint("rgba(244,247,255,0.4)"),
            Some(Color(244, 247, 255, 102))
        );
        for value in [
            "rgb(1,2,3)",
            "rgba(1,2,3)",
            "rgba(1,2,3,2)",
            "rgba(1,2,3,0.5,1)",
            "#fff",
        ] {
            assert_eq!(parse_tint(value), None, "{value}");
        }
        assert_eq!(
            parse_stored(
                r#"{"background":"rgb(14,21,33)","scheme":"dark","tint":"rgba(14, 21, 33, 0.65)"}"#
            )
            .and_then(|appearance| appearance.tint),
            Some(Color(14, 21, 33, 166))
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
