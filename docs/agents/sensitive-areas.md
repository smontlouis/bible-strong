# Sensitive Areas

Ask for explicit human approval before changing behavior in these areas, and document the validation performed afterward.

## Authentication And Account Data

- Firebase Auth login/register/password reset flows.
- Google Sign-In and Apple Sign-In.
- Account deletion in `src/features/profile/components/DeleteAccountModal.tsx`.
- Logout cleanup and backup behavior in `src/helpers/useInitFireAuth.tsx`.

## Cloud Sync And User Data

- Firestore sync middleware in `src/redux/firestoreMiddleware.ts`.
- Live updates and migrations in `src/helpers/useLiveUpdates.ts`, `src/helpers/useFirestoreMigration.ts`, and `src/state/useTabGroupsSync.ts`.
- User-owned notes, highlights, bookmarks, tags, studies, links, tab groups, and settings.

## Local Storage, SQLite, And Migrations

- SQLite helpers and database reset/recovery in `src/helpers/sqlite.ts`, `src/helpers/databases.ts`, and `src/helpers/biblesDb.ts`.
- Bible/resource migrations in `src/helpers/bibleMigration.ts`, `src/helpers/databaseMigration.ts`, and `src/helpers/storage.ts`.
- Download/delete flows for Bible versions and resources.
- Full local reset behavior in `src/helpers/nukeApp.ts`.

## Backup, Import, And Export

- Automatic backups in `src/helpers/AutoBackupManager.ts`.
- Settings import/export and automatic backup screens.
- Any change that can overwrite or delete user-created content.

## Build, Release, And Native Config

- `app.config.ts`, `eas.json`, Expo plugins, Firebase service file paths, bundle identifiers, package names, URL schemes, universal links, background audio mode, and EAS update channels.
- `.env*` handling and any script that reads service account keys.

## External Services

- Sentry DSN and error reporting.
- Firebase Analytics, Firestore, Remote Config, Storage, and Auth.
- DeepL translation key usage.
- Bible/resource/audio download endpoints.
- App Store / Play Store review scripts under `scripts/`.

## Safe Defaults For Agents

- Prefer tests and documentation changes before modifying sensitive flows.
- Use development Firebase config for local validation unless the user explicitly chooses staging or production.
- Do not run account deletion, destructive reset, import overwrite, production build, or release commands without explicit user intent.
