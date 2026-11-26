//! macOS: the Service « Look Up in Bible Strong » (« Rechercher dans Bible Strong »).
//!
//! A reader selects « Jean 3:16 » or a word in any app and chooses the service from the Services
//! menu or the right-click menu of the selection. `Info.plist` declares it (`NSServices`, its
//! name translated by `ServicesMenu.strings`); the system then calls `lookUpInBibleStrong:` on the
//! app's services provider with the selection on a pasteboard. The text goes to the page through
//! the inbox: a reference opens in a tab, anything else in the search. Tauri has no API for this.

#[cfg(target_os = "macos")]
mod provider {
    use objc2::{
        define_class, msg_send, rc::Retained, runtime::AnyObject, runtime::NSObject, DefinedClass,
        MainThreadMarker, MainThreadOnly,
    };
    use objc2_app_kit::{NSApplication, NSPasteboard, NSPasteboardTypeString};
    use objc2_foundation::NSString;
    use tauri::AppHandle;

    use crate::inbox::{deliver, Delivery};

    // A selection longer than this is not something to look up.
    const MAX_TEXT_LENGTH: usize = 500;

    pub struct Ivars {
        app: AppHandle,
    }

    define_class!(
        // Safety: NSObject has no subclassing requirement; the class adds no `dealloc`.
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[name = "BibleStrongServicesProvider"]
        #[ivars = Ivars]
        struct ServicesProvider;

        impl ServicesProvider {
            /// `NSMessage` of the service in `Info.plist`.
            #[unsafe(method(lookUpInBibleStrong:userData:error:))]
            fn look_up(
                &self,
                pasteboard: &NSPasteboard,
                _user_data: Option<&NSString>,
                _error: *mut *mut AnyObject,
            ) {
                // Safety: the type is AppKit's own constant for plain text.
                let Some(text) = pasteboard.stringForType(unsafe { NSPasteboardTypeString }) else {
                    return;
                };
                let text = text.to_string();
                let text = text.trim();
                if text.is_empty() || text.chars().count() > MAX_TEXT_LENGTH {
                    return;
                }
                deliver(
                    &self.ivars().app,
                    Delivery::LookUp {
                        text: text.to_owned(),
                    },
                );
            }
        }
    );

    /// Makes the app the provider of its services. On the main thread, during setup.
    pub fn register(app: &AppHandle) {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let provider = ServicesProvider::alloc(mtm).set_ivars(Ivars { app: app.clone() });
        // Safety: `init` of NSObject.
        let provider: Retained<ServicesProvider> = unsafe { msg_send![super(provider), init] };
        let application = NSApplication::sharedApplication(mtm);
        // Safety: the provider answers the message `Info.plist` declares.
        unsafe { application.setServicesProvider(Some(&provider)) };
        // AppKit does not retain its services provider: it lives as long as the app.
        std::mem::forget(provider);
    }
}

#[cfg(target_os = "macos")]
pub use provider::register;

#[cfg(not(target_os = "macos"))]
pub fn register(_app: &tauri::AppHandle) {}
