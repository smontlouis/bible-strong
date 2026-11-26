//! Reading reminders (ADR-0119): the daily reading and the plans' readings announced at the
//! reader's chosen time, as on iOS and Android.
//!
//! The page owns the schedule, the same 28 days the mobile apps hold (`readingReminderSchedule.ts`),
//! and reconciles it through these commands like a notification library (`readingReminderDriver.desktop.ts`).
//! The system keeps it while the app is closed:
//! - macOS: `UNUserNotificationCenter`, time-interval requests. It answers only inside an app
//!   bundle, so `tauri dev` and the tests read « denied » and schedule nothing.
//! - Windows: toasts scheduled with the notifier of the app's AppUserModelID, which the installer
//!   gives the Start menu shortcut (the bundle identifier).
//! - Linux has no scheduler: the shell holds the reminders and shows each one while it runs.
//!
//! A clicked reminder opens `biblestrong://reading-reminder?payload=…`: on Windows the toast
//! launches that address, on macOS and Linux the shell hands it to the page through the inbox.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// A reminder as the page asks for it. `timestamp` is in milliseconds since the epoch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub timestamp: i64,
    pub title: String,
    pub body: String,
    pub data: BTreeMap<String, String>,
}

/// A reminder shown in the system's notification list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Shown {
    pub id: String,
    pub data: BTreeMap<String, String>,
}

const URL_PREFIX: &str = "biblestrong://reading-reminder?payload=";

/// The address a clicked reminder opens, which carries the whole reminder.
pub fn reminder_url(reminder: &Reminder) -> String {
    let payload = serde_json::to_string(reminder).unwrap_or_default();
    let encoded: String = url::form_urlencoded::byte_serialize(payload.as_bytes()).collect();
    format!("{URL_PREFIX}{encoded}")
}

/// The reminder an address of `reminder_url` carries.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn reminder_from_url(address: &str) -> Option<Reminder> {
    let encoded = address.strip_prefix(URL_PREFIX)?;
    let payload: String = url::form_urlencoded::parse(format!("p={encoded}").as_bytes())
        .find(|(key, _)| key == "p")?
        .1
        .into_owned();
    serde_json::from_str(&payload).ok()
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}

/// Starts what the system needs before a reminder is clicked: on macOS the delegate that
/// receives the click, on Linux the clock that shows the reminders. During setup.
pub fn start(app: &tauri::AppHandle) {
    platform::start(app);
}

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())?
}

/// « not-requested », « allowed » or « denied », as `ReadingNotificationPermission`.
#[tauri::command]
pub async fn reminders_permission() -> Result<String, String> {
    blocking(platform::permission).await
}

/// Asks the reader, where the system asks; then the permission, as `reminders_permission`.
#[tauri::command]
pub async fn reminders_request_permission() -> Result<String, String> {
    blocking(platform::request_permission).await
}

#[tauri::command]
pub async fn reminders_scheduled() -> Result<Vec<Reminder>, String> {
    blocking(platform::scheduled).await
}

/// Schedules the reminder, replacing one of the same id. A time already past schedules nothing.
#[tauri::command]
pub async fn reminders_schedule(reminder: Reminder) -> Result<(), String> {
    if reminder.timestamp <= now_ms() {
        return Ok(());
    }
    blocking(move || platform::schedule(&reminder)).await
}

#[tauri::command]
pub async fn reminders_cancel(id: String) -> Result<(), String> {
    blocking(move || platform::cancel(&id)).await
}

#[tauri::command]
pub async fn reminders_displayed() -> Result<Vec<Shown>, String> {
    blocking(platform::displayed).await
}

#[tauri::command]
pub async fn reminders_remove_displayed(id: String) -> Result<(), String> {
    blocking(move || platform::remove_displayed(&id)).await
}

/// The system's notification settings, where the reader allows Bible Strong again.
#[tauri::command]
pub fn reminders_open_settings(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let settings = if cfg!(target_os = "macos") {
        // The legacy pane name, which macOS 13 and later still open.
        "x-apple.systempreferences:com.apple.preference.notifications"
    } else if cfg!(windows) {
        "ms-settings:notifications"
    } else {
        return Ok(());
    };
    app.opener()
        .open_url(settings, None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
mod platform {
    use std::{ptr::NonNull, sync::mpsc, time::Duration};

    use block2::RcBlock;
    use objc2::{
        define_class, msg_send,
        rc::Retained,
        runtime::{AnyObject, Bool, NSObject, NSObjectProtocol, ProtocolObject},
        AnyThread, DefinedClass,
    };
    use objc2_foundation::{NSArray, NSBundle, NSDictionary, NSError, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNAuthorizationStatus, UNMutableNotificationContent,
        UNNotification, UNNotificationPresentationOptions, UNNotificationRequest,
        UNNotificationResponse, UNNotificationSettings, UNNotificationSound,
        UNTimeIntervalNotificationTrigger, UNUserNotificationCenter,
        UNUserNotificationCenterDelegate,
    };
    use tauri::AppHandle;

    use super::{reminder_url, Reminder, Shown};
    use crate::inbox::{deliver, Delivery};

    const PAYLOAD_KEY: &str = "readingReminder";
    const ANSWER_TIMEOUT: Duration = Duration::from_secs(10);

    /// The notification centre answers only an app bundle: elsewhere it throws.
    fn center() -> Option<Retained<UNUserNotificationCenter>> {
        let bundle = NSBundle::mainBundle();
        let bundled = bundle.bundleIdentifier().is_some()
            && bundle.bundlePath().to_string().ends_with(".app");
        bundled.then(UNUserNotificationCenter::currentNotificationCenter)
    }

    fn wait<T>(receiver: mpsc::Receiver<T>) -> Result<T, String> {
        receiver
            .recv_timeout(ANSWER_TIMEOUT)
            .map_err(|_| "The notification centre timed out".to_owned())
    }

    fn payload_of(user_info: &NSDictionary) -> Option<Reminder> {
        let key = NSString::from_str(PAYLOAD_KEY);
        let key: &AnyObject = &key;
        let value = user_info.objectForKey(key)?;
        let text = value.downcast::<NSString>().ok()?;
        serde_json::from_str(&text.to_string()).ok()
    }

    pub fn permission() -> Result<String, String> {
        let Some(center) = center() else {
            return Ok("denied".into());
        };
        let (sender, receiver) = mpsc::channel();
        let answer = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
            // Safety: the settings live for the call.
            let status = unsafe { settings.as_ref() }.authorizationStatus();
            let _ = sender.send(status);
        });
        center.getNotificationSettingsWithCompletionHandler(&answer);
        Ok(match wait(receiver)? {
            UNAuthorizationStatus::NotDetermined => "not-requested",
            UNAuthorizationStatus::Denied => "denied",
            _ => "allowed",
        }
        .into())
    }

    pub fn request_permission() -> Result<String, String> {
        let Some(center) = center() else {
            return Ok("denied".into());
        };
        let (sender, receiver) = mpsc::channel();
        let answer = RcBlock::new(move |_granted: Bool, _error: *mut NSError| {
            let _ = sender.send(());
        });
        center.requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &answer,
        );
        wait(receiver)?;
        permission()
    }

    pub fn scheduled() -> Result<Vec<Reminder>, String> {
        let Some(center) = center() else {
            return Ok(Vec::new());
        };
        let (sender, receiver) = mpsc::channel();
        let answer = RcBlock::new(move |requests: NonNull<NSArray<UNNotificationRequest>>| {
            // Safety: the array lives for the call.
            let requests = unsafe { requests.as_ref() };
            let reminders: Vec<Reminder> = requests
                .iter()
                .filter_map(|request| payload_of(&request.content().userInfo()))
                .collect();
            let _ = sender.send(reminders);
        });
        center.getPendingNotificationRequestsWithCompletionHandler(&answer);
        wait(receiver)
    }

    pub fn schedule(reminder: &Reminder) -> Result<(), String> {
        let Some(center) = center() else {
            return Ok(());
        };
        let payload = serde_json::to_string(reminder).map_err(|error| error.to_string())?;
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(&reminder.title));
        content.setBody(&NSString::from_str(&reminder.body));
        content.setSound(Some(&UNNotificationSound::defaultSound()));
        let key = NSString::from_str(PAYLOAD_KEY);
        let value = NSString::from_str(&payload);
        let user_info = NSDictionary::<NSString, NSString>::from_slices(&[&*key], &[&*value]);
        // Safety: a dictionary of strings is a property list, as `userInfo` requires.
        unsafe {
            content.setUserInfo(&*(Retained::as_ptr(&user_info) as *const NSDictionary));
        }
        let seconds = (reminder.timestamp - super::now_ms()) as f64 / 1000.0;
        let trigger = UNTimeIntervalNotificationTrigger::triggerWithTimeInterval_repeats(
            seconds.max(1.0),
            false,
        );
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &NSString::from_str(&reminder.id),
            &content,
            Some(&trigger),
        );
        let (sender, receiver) = mpsc::channel();
        let answer = RcBlock::new(move |error: *mut NSError| {
            // Safety: the error, when there is one, lives for the call.
            let message =
                unsafe { error.as_ref() }.map(|error| error.localizedDescription().to_string());
            let _ = sender.send(message);
        });
        center.addNotificationRequest_withCompletionHandler(&request, Some(&answer));
        match wait(receiver)? {
            Some(message) => Err(message),
            None => Ok(()),
        }
    }

    pub fn cancel(id: &str) -> Result<(), String> {
        if let Some(center) = center() {
            let ids = NSArray::from_retained_slice(&[NSString::from_str(id)]);
            center.removePendingNotificationRequestsWithIdentifiers(&ids);
        }
        Ok(())
    }

    pub fn displayed() -> Result<Vec<Shown>, String> {
        let Some(center) = center() else {
            return Ok(Vec::new());
        };
        let (sender, receiver) = mpsc::channel();
        let answer = RcBlock::new(move |notifications: NonNull<NSArray<UNNotification>>| {
            // Safety: the array lives for the call.
            let notifications = unsafe { notifications.as_ref() };
            let shown: Vec<Shown> = notifications
                .iter()
                .filter_map(|notification| {
                    let reminder = payload_of(&notification.request().content().userInfo())?;
                    Some(Shown {
                        id: reminder.id,
                        data: reminder.data,
                    })
                })
                .collect();
            let _ = sender.send(shown);
        });
        center.getDeliveredNotificationsWithCompletionHandler(&answer);
        wait(receiver)
    }

    pub fn remove_displayed(id: &str) -> Result<(), String> {
        if let Some(center) = center() {
            let ids = NSArray::from_retained_slice(&[NSString::from_str(id)]);
            center.removeDeliveredNotificationsWithIdentifiers(&ids);
        }
        Ok(())
    }

    pub struct Ivars {
        app: AppHandle,
    }

    define_class!(
        // Safety: NSObject has no subclassing requirement; the class adds no `dealloc`.
        #[unsafe(super(NSObject))]
        #[name = "BibleStrongReminderDelegate"]
        #[ivars = Ivars]
        struct ReminderDelegate;

        unsafe impl NSObjectProtocol for ReminderDelegate {}

        unsafe impl UNUserNotificationCenterDelegate for ReminderDelegate {
            /// A reminder due while the app is in front still shows.
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                completion.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List
                    | UNNotificationPresentationOptions::Sound,));
            }

            /// The reader clicked a reminder: the page opens its reading.
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &block2::DynBlock<dyn Fn()>,
            ) {
                let user_info = response.notification().request().content().userInfo();
                if let Some(reminder) = payload_of(&user_info) {
                    deliver(
                        &self.ivars().app,
                        Delivery::Open {
                            url: reminder_url(&reminder),
                        },
                    );
                }
                completion.call(());
            }
        }
    );

    pub fn start(app: &AppHandle) {
        let Some(center) = center() else {
            return;
        };
        let delegate = ReminderDelegate::alloc().set_ivars(Ivars { app: app.clone() });
        // Safety: `init` of NSObject.
        let delegate: Retained<ReminderDelegate> = unsafe { msg_send![super(delegate), init] };
        center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        // The centre holds its delegate weakly: it lives as long as the app.
        std::mem::forget(delegate);
    }
}

#[cfg(windows)]
mod platform {
    use std::sync::OnceLock;

    use tauri::{AppHandle, Manager};
    use windows::{
        core::HSTRING,
        Data::Xml::Dom::XmlDocument,
        Foundation::DateTime,
        UI::Notifications::{
            NotificationSetting, ScheduledToastNotification, ToastNotificationManager,
            ToastNotifier,
        },
    };

    use super::{reminder_from_url, reminder_url, Reminder, Shown};

    const GROUP: &str = "reading";
    // 100-nanosecond intervals between 1601-01-01 and 1970-01-01.
    const EPOCH_TICKS: i64 = 116_444_736_000_000_000;

    static APP_ID: OnceLock<String> = OnceLock::new();

    fn app_id() -> HSTRING {
        HSTRING::from(APP_ID.get().map(String::as_str).unwrap_or_default())
    }

    fn notifier() -> Result<ToastNotifier, String> {
        ToastNotificationManager::CreateToastNotifierWithId(&app_id())
            .map_err(|error| error.to_string())
    }

    /// A toast's tag holds 64 characters: a longer reminder id (a plan with a long id) is
    /// shortened to a hash of itself, the same for scheduling and cancelling.
    fn tag(id: &str) -> HSTRING {
        if id.chars().count() <= 64 {
            return HSTRING::from(id);
        }
        use sha2::{Digest, Sha256};
        let digest = hex::encode(Sha256::digest(id.as_bytes()));
        HSTRING::from(format!("reading:{}", &digest[..40]))
    }

    fn escape(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
    }

    fn launch_of(content: Option<XmlDocument>) -> Option<Reminder> {
        let launch = content?
            .DocumentElement()
            .ok()?
            .GetAttribute(&HSTRING::from("launch"))
            .ok()?;
        reminder_from_url(&launch.to_string())
    }

    pub fn start(app: &AppHandle) {
        let _ = APP_ID.set(app.config().identifier.clone());
    }

    pub fn permission() -> Result<String, String> {
        let enabled = notifier()
            .and_then(|notifier| notifier.Setting().map_err(|error| error.to_string()))
            .map(|setting| setting == NotificationSetting::Enabled)
            .unwrap_or(false);
        Ok(if enabled { "allowed" } else { "denied" }.into())
    }

    /// Windows asks nothing: the reader turns notifications off in the system's settings.
    pub fn request_permission() -> Result<String, String> {
        permission()
    }

    pub fn scheduled() -> Result<Vec<Reminder>, String> {
        let toasts = notifier()?
            .GetScheduledToastNotifications()
            .map_err(|error| error.to_string())?;
        Ok(toasts
            .into_iter()
            .filter(|toast| toast.Group().is_ok_and(|group| group == GROUP))
            .filter_map(|toast| launch_of(toast.Content().ok()))
            .collect())
    }

    pub fn schedule(reminder: &Reminder) -> Result<(), String> {
        cancel(&reminder.id)?;
        let xml = format!(
            r#"<toast activationType="protocol" launch="{}"><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual></toast>"#,
            escape(&reminder_url(reminder)),
            escape(&reminder.title),
            escape(&reminder.body),
        );
        let document = XmlDocument::new().map_err(|error| error.to_string())?;
        document
            .LoadXml(&HSTRING::from(xml))
            .map_err(|error| error.to_string())?;
        let when = DateTime {
            UniversalTime: EPOCH_TICKS + reminder.timestamp * 10_000,
        };
        let toast = ScheduledToastNotification::CreateScheduledToastNotification(&document, when)
            .map_err(|error| error.to_string())?;
        toast
            .SetTag(&tag(&reminder.id))
            .map_err(|error| error.to_string())?;
        toast
            .SetGroup(&HSTRING::from(GROUP))
            .map_err(|error| error.to_string())?;
        notifier()?
            .AddToSchedule(&toast)
            .map_err(|error| error.to_string())
    }

    pub fn cancel(id: &str) -> Result<(), String> {
        let notifier = notifier()?;
        let toasts = notifier
            .GetScheduledToastNotifications()
            .map_err(|error| error.to_string())?;
        let wanted = tag(id);
        for toast in toasts {
            if toast.Tag().is_ok_and(|existing| existing == wanted) {
                notifier
                    .RemoveFromSchedule(&toast)
                    .map_err(|error| error.to_string())?;
            }
        }
        Ok(())
    }

    pub fn displayed() -> Result<Vec<Shown>, String> {
        let history = ToastNotificationManager::History().map_err(|error| error.to_string())?;
        let toasts = history
            .GetHistoryWithId(&app_id())
            .map_err(|error| error.to_string())?;
        Ok(toasts
            .into_iter()
            .filter_map(|toast| {
                let reminder = launch_of(toast.Content().ok())?;
                Some(Shown {
                    id: reminder.id,
                    data: reminder.data,
                })
            })
            .collect())
    }

    pub fn remove_displayed(id: &str) -> Result<(), String> {
        let history = ToastNotificationManager::History().map_err(|error| error.to_string())?;
        history
            .RemoveGroupedTagWithId(&tag(id), &HSTRING::from(GROUP), &app_id())
            .map_err(|error| error.to_string())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use std::{
        sync::{Mutex, OnceLock},
        time::Duration,
    };

    use tauri::AppHandle;

    use super::{now_ms, reminder_url, Reminder, Shown};
    use crate::inbox::{deliver, Delivery};

    // The clock looks again often enough for a reminder to show within its minute, also after
    // the computer slept.
    const TICK: Duration = Duration::from_secs(20);

    static PENDING: Mutex<Vec<Reminder>> = Mutex::new(Vec::new());
    static APP: OnceLock<AppHandle> = OnceLock::new();

    fn show(reminder: Reminder) {
        let Some(app) = APP.get().cloned() else {
            return;
        };
        std::thread::spawn(move || {
            let shown = notify_rust::Notification::new()
                .appname("Bible Strong")
                .summary(&reminder.title)
                .body(&reminder.body)
                .action("default", &reminder.title)
                .show();
            if let Ok(handle) = shown {
                handle.wait_for_action(|action| {
                    if action == "default" {
                        deliver(
                            &app,
                            Delivery::Open {
                                url: reminder_url(&reminder),
                            },
                        );
                    }
                });
            }
        });
    }

    pub fn start(app: &AppHandle) {
        let _ = APP.set(app.clone());
        tauri::async_runtime::spawn(async {
            loop {
                tokio::time::sleep(TICK).await;
                let now = now_ms();
                let due: Vec<Reminder> = match PENDING.lock() {
                    Ok(mut pending) => {
                        let (due, later) = pending
                            .drain(..)
                            .partition(|reminder| reminder.timestamp <= now);
                        *pending = later;
                        due
                    }
                    Err(_) => Vec::new(),
                };
                for reminder in due {
                    show(reminder);
                }
            }
        });
    }

    pub fn permission() -> Result<String, String> {
        Ok("allowed".into())
    }

    pub fn request_permission() -> Result<String, String> {
        permission()
    }

    pub fn scheduled() -> Result<Vec<Reminder>, String> {
        Ok(PENDING
            .lock()
            .map(|pending| pending.clone())
            .unwrap_or_default())
    }

    pub fn schedule(reminder: &Reminder) -> Result<(), String> {
        let mut pending = PENDING.lock().map_err(|error| error.to_string())?;
        pending.retain(|existing| existing.id != reminder.id);
        pending.push(reminder.clone());
        Ok(())
    }

    pub fn cancel(id: &str) -> Result<(), String> {
        let mut pending = PENDING.lock().map_err(|error| error.to_string())?;
        pending.retain(|existing| existing.id != id);
        Ok(())
    }

    pub fn displayed() -> Result<Vec<Shown>, String> {
        Ok(Vec::new())
    }

    pub fn remove_displayed(_id: &str) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{reminder_from_url, reminder_url, Reminder};

    #[test]
    fn a_clicked_reminder_carries_the_whole_reminder() {
        let reminder = Reminder {
            id: "reading:daily:2026-11-27".into(),
            timestamp: 1_795_766_400_000,
            title: "Lecture du jour & méditation".into(),
            body: "« Jean 3 » t'attend".into(),
            data: [
                ("kind".to_owned(), "meditation".to_owned()),
                ("date".to_owned(), "2026-11-27".to_owned()),
                ("owner".to_owned(), "uid=1&x".to_owned()),
            ]
            .into_iter()
            .collect(),
        };
        let url = reminder_url(&reminder);
        assert!(url.starts_with("biblestrong://reading-reminder?payload="));
        assert!(!url.contains(' ') && !url.contains('&') && !url.contains('"'));
        assert_eq!(reminder_from_url(&url), Some(reminder));
    }

    #[test]
    fn ignores_other_addresses() {
        assert_eq!(reminder_from_url("biblestrong://bible/LSG/JHN/3"), None);
        assert_eq!(
            reminder_from_url("biblestrong://reading-reminder?payload=nope"),
            None
        );
    }
}
