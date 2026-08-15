# Issue 269 — Native account-entry smoke matrix

This runbook is the release gate for guest-data adoption. It requires human-owned provider
credentials and must run against the development Firebase project only.

## Safety gate

Before every run:

- Use the development environment and the `com.smontlouis.biblestrong.dev` app identity.
- Confirm the Firebase project shown by the local development configuration is not staging or
  production.
- Use a unique throwaway account for every new-account scenario.
- Never delete or repurpose an existing real account to simulate a new account.
- Do not include email addresses, URLs, notes, Bible references, or other authored payloads in
  screenshots, logs, or the issue comment. Record only aggregate counts and pass/fail outcomes.
- Keep the pre-entry local backup until the scenario has passed restart and remote verification.

Stop immediately if the environment or destination UID is uncertain.

## Representative guest fixture

Create locally, while signed out:

- one bookmark;
- one highlight using a custom colour;
- one note;
- one tag attached to an eligible entity;
- one link;
- one word annotation;
- one manual relation between eligible entities;
- followed-plan progress;
- one account-synchronized setting change;
- one tab group containing a Bible tab.

Also create or observe one excluded/device-owned value where practical, such as a downloaded
resource, link preview, transient verse selection, or Study tab. It must not be uploaded by the
adoption flow.

Use unique IDs or labels for the run so the destination can be checked without comparing content.

## Required matrix

| Provider | iOS | Android | Required account paths |
|---|---|---|---|
| Email/password | Pending | Pending | New registration and existing login |
| Google | Pending | Pending | First credential authentication and returning authentication |
| Apple | Pending | Not required | First credential authentication and returning authentication |

For email, repeat the new-registration scenario while the address is unverified. Verification state
must not change adoption eligibility.

## New-account scenario

For each required provider/platform cell:

1. Start with the representative signed-out fixture visible locally.
2. Create a genuinely new Firebase account through the provider flow.
3. Confirm the fixture remains visible while account entry is running.
4. Confirm normal account hydration does not begin before adoption completes.
5. Confirm the non-blocking safe-local-data message appears if the write is deliberately made
   unavailable for the recovery run.
6. Confirm completion enables normal synchronization without duplicate entities.
7. Restart the app and confirm the adopted fixture remains visible.
8. Verify in development Firestore that eligible documents use their original stable IDs under the
   authenticated UID.
9. Verify manual relations remain and system relations/projections were rebuilt without duplicates.
10. Verify Studies, previews, downloads, transient selections, and device-owned settings were not
    adopted.

## Existing-account scenario

For each required provider/platform cell:

1. Prepare a populated throwaway existing account and a distinguishable signed-out guest fixture.
2. Sign in using the existing-account provider path.
3. Confirm a best-effort local backup is attempted before replacement.
4. Confirm remote account data becomes visible and the guest fixture is not uploaded.
5. Repeat with an existing but empty remote account; emptiness must not trigger adoption.
6. Restart and confirm the account remains authoritative.

## Recovery and isolation scenarios

Run these at least once on iOS and once on Android using development Firebase:

- Interrupt connectivity during adoption, edit and delete local guest entities, then reconnect.
  Confirm replay adopts the latest state without duplicates.
- Terminate the app during a partial write, relaunch, and confirm the checkpoint resumes only for
  the same UID.
- Logout while adoption is pending. Confirm the latest local state remains journaled and a late
  writer cannot upload reset/empty state.
- Attempt to resume with another UID. Confirm no pending data is written to that UID.
- Trigger a missing/contradictory provider classification where the test harness permits it.
  Confirm neither adoption nor hydration begins, including after restart.

## Evidence record

Record one row per required provider/platform cell:

| Provider | Platform | Dev build/version | New path | Existing path | Restart | Remote IDs/counts | Recovery | Result |
|---|---|---|---|---|---|---|---|---|
| Email | iOS |  |  |  |  |  |  |  |
| Email | Android |  |  |  |  |  |  |  |
| Google | iOS |  |  |  |  |  |  |  |
| Google | Android |  |  |  |  |  |  |  |
| Apple | iOS |  |  |  |  |  |  |  |

The issue is ready to close only when all five rows pass, the recovery/isolation scenarios pass,
and no production or staging Firebase writes occurred.
