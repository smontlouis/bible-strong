//! macOS: the theme's tint over the window's sidebar material.
//!
//! The window is transparent over the system's sidebar material (`create_main_window`). The
//! theme's canvas, laid over it at the opacity `DesktopShell` chooses, is a native view between
//! the material and the webview. Painted by the page instead, WebKit redrew it whenever the page
//! added or removed an animated layer (a chapter's fade-in, a selection), and the tint flickered.
//! The page paints nothing in the shell; it shows through where it is transparent.

use tauri::window::Color;

/// The tint view, among the webview's siblings.
#[cfg(target_os = "macos")]
const TINT_IDENTIFIER: &str = "bible-strong-material-tint";

/// Sets the tint, or removes it with `None`. Runs on the main thread, after the webview exists.
#[cfg(target_os = "macos")]
pub fn set_tint(window: &tauri::WebviewWindow, tint: Option<Color>) -> tauri::Result<()> {
    use objc2::{rc::Retained, MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::{
        NSAutoresizingMaskOptions, NSBox, NSBoxType, NSColor, NSTitlePosition,
        NSUserInterfaceItemIdentification, NSView, NSWindowOrderingMode,
    };
    use objc2_foundation::{NSSize, NSString};

    window.with_webview(move |platform| {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        // Safety: `inner` is the WKWebView, an NSView, alive while the window is.
        let webview: &NSView = unsafe { &*(platform.inner() as *const NSView) };
        // Safety: called on the main thread, where AppKit gives the view hierarchy.
        let Some(container) = (unsafe { webview.superview() }) else {
            return;
        };
        let identifier = NSString::from_str(TINT_IDENTIFIER);
        for view in container.subviews().iter() {
            if view
                .identifier()
                .is_some_and(|existing| existing.isEqualToString(&identifier))
            {
                view.removeFromSuperview();
            }
        }
        let Some(Color(red, green, blue, alpha)) = tint else {
            return;
        };
        let tint_view: Retained<NSBox> =
            NSBox::initWithFrame(NSBox::alloc(mtm), container.bounds());
        tint_view.setBoxType(NSBoxType::Custom);
        tint_view.setTitlePosition(NSTitlePosition::NoTitle);
        tint_view.setBorderWidth(0.0);
        tint_view.setContentViewMargins(NSSize::new(0.0, 0.0));
        tint_view.setFillColor(&NSColor::colorWithSRGBRed_green_blue_alpha(
            f64::from(red) / 255.0,
            f64::from(green) / 255.0,
            f64::from(blue) / 255.0,
            f64::from(alpha) / 255.0,
        ));
        tint_view.setAutoresizingMask(
            NSAutoresizingMaskOptions::ViewWidthSizable
                | NSAutoresizingMaskOptions::ViewHeightSizable,
        );
        tint_view.setIdentifier(Some(&identifier));
        // Above the material, which sits at the bottom, and below the page.
        container.addSubview_positioned_relativeTo(
            &tint_view,
            NSWindowOrderingMode::Below,
            Some(webview),
        );
    })
}

#[cfg(not(target_os = "macos"))]
pub fn set_tint(_window: &tauri::WebviewWindow, _tint: Option<Color>) -> tauri::Result<()> {
    Ok(())
}
