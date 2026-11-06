# Expo app (`@bible-strong/expo`)

The Bible Strong app for iOS, Android and the Web: Expo SDK 58, React Native 0.88, React 19 with the React Compiler, Expo Router (routes in `app/`), Redux Toolkit with Redux Persist on MMKV, Jotai, SQLite, Firebase (Auth, Firestore sync, Remote Config, Storage) and Uniwind for styles. The Bible text is drawn by an Expo DOM component, `src/features/bible/BibleDOM/`.

## Read first

- This app's `CONTEXT.md` and the root `CONTEXT-MAP.md`.
- The ADRs of the area you touch under `../../docs/adr/`, among them 0040 (Uniwind and the Bible DOM boundary), 0044 (class forwarding), 0086 (surfaces) and 0098 (reader intents).
- `../../docs/architecture.md`, `source-tree.md`, `data-models.md` and `conventions.md` for structure and data.
- `../../docs/agents/validation.md` for checks, `smoke-tests.md` for device paths, and `sensitive-areas.md` before touching auth, sync, storage, backup, native config or build identity.
- The chapter « The app » of `../../design-system/project/README.md` before designing or restyling a screen.

## Commands

Run them here, or from the root with `yarn workspace @bible-strong/expo <script>`.

| Task | Command |
| --- | --- |
| Metro for the dev client | `yarn start` (root: `yarn dev:expo`) |
| Web, on port 9090 | `yarn web` |
| Typecheck, including the generated theme CSS | `yarn typecheck` |
| Lint | `yarn lint` |
| Tests | `yarn test`; before saying tests pass, run the whole suite with `node_modules/.bin/jest` (about 80 s) |
| Theme CSS after a palette edit | `yarn themes:generate`, then `yarn themes:check` |
| i18n extraction | `yarn i18n` |
| Style guard for UI changes (root) | `yarn agents:styles:check` |

Use `yarn expo …`, never `npx expo …`. A JavaScript change reaches the device through Metro; native builds (dev client, production) and OTA updates are the owner's call.

## Code rules

- **React Compiler is on.** Don't write `useMemo`, `useCallback` or `memo()`.
- **`react-hooks/exhaustive-deps` warnings:** never add the missing dependencies, it changes when effects run. Add `// eslint-disable-next-line react-hooks/exhaustive-deps`.
- **Keep `==` and `!=`.** Some comparisons mix strings and numbers on purpose (verse numbers, book ids). Add `// eslint-disable-next-line eqeqeq`.
- **State.** Redux for user data synced with Firestore (`src/redux/firestoreMiddleware.ts` syncs actions when signed in) and for persistent settings; Jotai for tabs and ephemeral UI state (`src/state/tabs.ts`).
- **Bible text.** The DOM document has its own Web styling boundary and receives serializable props (ADR-0040, ADR-0004). Never move it to nested React Native `<Text>`: it was tried and failed on layout and selection. A native rewrite would go through SwiftUI/UIKit and the Expo Modules API.
- **i18n.** `useTranslation()` from `react-i18next`, strings in `i18n/locales/{fr,en}/translation.json`, every key in both languages. The app runs i18next 19: plurals are `key` plus `key_plural`; `key_one` and `key_other` are never read.

## Layout and styles

Keep `Box`, `HStack` and `VStack` for React Native layout. Use Uniwind `className` for static styles and `style` for calculated values. `HStack` defaults to `flex-row`, `VStack` to `flex-col`; caller classes may override those defaults. Native props and refs are forwarded, including through the animated variants. Merge class lists with `twMerge` from `~common/ui/classNames`, which understands Uniwind border-curve utilities without confusing them with border colors.

```tsx
<Box className="flex-1 bg-reverse p-4">
  <HStack className="items-center gap-3">
    <Text className="text-link font-bold">Example</Text>
  </HStack>
</Box>
```

Legacy shorthand props (`p`, `bg`, `row`, `fontSize`, etc.) are no longer accepted by `Box` or `Text`. For computed theme colors, use the value helpers in `~themes/colorValues`, and `useTheme` from `~themes/ThemeProvider` when a consumer needs JavaScript values. Do not add Emotion or `styled` wrappers.

When a computed value replaces a class in one state only, put both values in `style` or omit the key: a `style` key set to `undefined` wins over the class and wipes its value.

Theme palettes live in `src/themes/`; `global.css` is generated from them. Never edit generated palette values by hand.

### Forward classes

Pass `className` through shared UI wrappers to the underlying React Native component; Uniwind's Metro integration handles native styles and direct Web CSS. Do not call `useResolveClassNames` inside UI components. Use `twMerge` for wrapper defaults, with caller classes last, and keep computed values in `style`. Custom components such as `Link` must forward classes. Use `withUniwind` for third-party style slots (see `src/common/ui/classNameIcons.ts`). See ADR-0044.

### Surfaces

Pages, cards, rows, radii and shadows follow the chapter « The app » of `../../design-system/project/README.md` (ADR-0086). A hub or settings page sits on `bg-canvas`, set on its root `Container`, `SafeAreaBox` or `FormSheetScreen`, with its content in `ListSection`, `ListRow` and `Card`; a continuous list runs full width on the page ground. A page that scrolls runs to the bottom edge: the shared `ScrollView`, `FlatList` and `SectionList` pad their content with `usePageBottomInset()`, a raw scroll view does it itself, and only a page with fixed bottom content passes `reserveBottom` to its container. On a tablet the sidebar button sits over every page's top left: build a page header with `Header` or `FiltersHeader`, or pad a header of its own with `useWorkspaceHeaderInset()`. Take radii from `radii` and the one shadow from `floatingShadow` in `~common/ui/surfaces`. `yarn agents:styles:check` refuses new departures; when a change removes some, lower `scripts/agents-surface-baseline.json` with `node scripts/agents-surface-lint.mjs --update-baseline`.

## Animations

The app runs Reanimated 4.

- Prefer Reanimated CSS transitions (`transitionProperty`, `transitionDuration` and `transitionTimingFunction` in `style`) for changes driven by state. Keep `useSharedValue` and `useAnimatedStyle` for gestures, scroll and multi-step interpolations.
- Read and write shared values with `.get()` and `.set()`, never `.value`, and never during render.
- Animate `transform` and `opacity` rather than layout properties, and clamp interpolations with `Extrapolation.CLAMP`.

## Testing on a device

- Simulators and the Android emulator are driven with argent; issue work runs in `/issue` lanes (`../../docs/agents/orchestration.md`).
- In the simulator, App Check fails, so the study assistant, dictation and Offline copies can't be exercised for real, and the keyboard is AZERTY.
- `src/features/entityListQuery/__tests__/highlightsQuery-test.ts` is flaky in the full Jest run. When it is the only failure, rerun it alone and rerun the suite before blaming a change.

## Agent skills

Issues and PRDs are tracked in GitHub Issues for `smontlouis/bible-strong` (`../../docs/agents/issue-tracker.md`), with the triage labels of `../../docs/agents/triage-labels.md`. Domain docs: `../../docs/agents/domain.md`.
