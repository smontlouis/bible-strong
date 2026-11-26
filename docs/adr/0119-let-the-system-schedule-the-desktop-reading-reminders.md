# ADR-0119: Let the System Schedule the Desktop Reading Reminders

## Status

Accepted

## Context

The mobile apps remind readers of their daily reading and of their plans' readings at the time
they choose. The page builds the next 28 days of reminders (`readingReminderSchedule.ts`, at most
48) and reconciles them with what the system holds through a driver (`readingReminderReconciler.ts`);
Notifee hands them to iOS and Android, which show them while the app is closed.

The desktop app ([ADR-0107](./0107-ship-a-desktop-app-that-installs-encrypted-offline-copies.md))
had no reminders: its settings showed the browser's sentence pointing to the mobile apps. Tauri's
notification plugin shows a notification now but schedules none, so with it a reminder would only
arrive while the app runs. A reader closes a desktop app more often than a phone app.

Two deliveries were possible: timers in the running app on every system, or the system's own
scheduler where there is one.

## Decision

The system schedules the desktop reminders where it can, decided with the owner on 2026-11-26:

- **macOS**: `UNUserNotificationCenter`, one time-interval request per reminder, with the whole
  reminder in its `userInfo`. A reminder due while the app is in front still shows. A click calls
  the centre's delegate, set at launch, which hands the reminder to the page through the shell's
  inbox.
- **Windows**: toasts scheduled with the notifier of the app's AppUserModelID, the bundle
  identifier the installer gives the Start menu shortcut. A click launches the toast's
  `biblestrong://reading-reminder?payload=…` address; the shell hands the address that launched
  the app to the page through the inbox, and a running app receives it as any link.
- **Linux** has no scheduler: the shell holds the reminders and shows each one while the app runs
  (`notify-rust`), checking every 20 seconds so a reminder shows within its minute, also after the
  computer slept.

The page keeps the mobile schedule and reconciliation unchanged: a desktop driver
(`src/desktop/readingReminders.ts`) speaks to the shell's commands (`reminders.rs`), and one hook,
`useReadingReminderSchedule`, now serves the mobile and the desktop components. A clicked reminder
opens the same destination as on mobile, for the same account only. The settings show the
reminder on the desktop app, with the webview's own time field.

## Consequences

- A desktop reader gets the reminder at the chosen time with the app closed, on macOS and Windows.
- On Linux the reminders only arrive while the app runs; a reader there is told nothing more than
  on the other systems.
- `UNUserNotificationCenter` answers only an app bundle: `tauri dev` and the Rust tests read the
  permission as denied and schedule nothing. Reminders are tested on a built bundle.
- A Windows toast shows only for the identifier the installed shortcut carries: a build run outside
  the installer schedules toasts nobody sees.
- The address of a clicked reminder carries the reminder, the reader's account id included, as the
  mobile notification's data does. It stays on the computer.
