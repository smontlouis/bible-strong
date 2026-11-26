//! What the system hands the app from outside its window: text sent by the macOS Service
//! « Look Up in Bible Strong » (`services.rs`), a reading reminder the reader clicked
//! (`reminders.rs`). Either can launch the app before the page listens, so each delivery waits
//! here until the page takes it (`DesktopShell`): on its event, and once when the page loads.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

pub const EVENT: &str = "desktop://inbox";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Delivery {
    /// Text selected in another app: a reference opens in a tab, anything else in the search.
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    LookUp { text: String },
    /// A route of the workspace, such as the reading a reminder announced.
    Open { url: String },
}

#[derive(Default)]
pub struct Inbox(Mutex<Vec<Delivery>>);

impl Inbox {
    fn push(&self, delivery: Delivery) {
        if let Ok(mut items) = self.0.lock() {
            items.push(delivery);
        }
    }

    fn take(&self) -> Vec<Delivery> {
        self.0
            .lock()
            .map(|mut items| std::mem::take(&mut *items))
            .unwrap_or_default()
    }
}

/// Keeps the delivery for the page, brings the window forward and tells the page.
pub fn deliver(app: &AppHandle, delivery: Delivery) {
    if let Some(inbox) = app.try_state::<Inbox>() {
        inbox.push(delivery);
    }
    crate::focus_main_window(app);
    let _ = app.emit_to("main", EVENT, ());
}

#[tauri::command]
pub fn inbox_take(inbox: State<'_, Inbox>) -> Vec<Delivery> {
    inbox.take()
}

#[cfg(test)]
mod tests {
    use super::{Delivery, Inbox};

    #[test]
    fn hands_each_delivery_over_once_in_order() {
        let inbox = Inbox::default();
        inbox.push(Delivery::LookUp {
            text: "Jean 3:16".into(),
        });
        inbox.push(Delivery::Open {
            url: "biblestrong://daily-reading".into(),
        });
        assert_eq!(
            inbox.take(),
            vec![
                Delivery::LookUp {
                    text: "Jean 3:16".into()
                },
                Delivery::Open {
                    url: "biblestrong://daily-reading".into()
                },
            ]
        );
        assert!(inbox.take().is_empty());
    }

    #[test]
    fn speaks_the_page_s_shape() {
        let json = serde_json::to_string(&Delivery::LookUp {
            text: "amour".into(),
        })
        .unwrap();
        assert_eq!(json, r#"{"kind":"lookUp","text":"amour"}"#);
    }
}
