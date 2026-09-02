# React Doctor mobile audit

## Scope

Command:

```bash
CI=1 npx -y react-doctor@latest apps/mobile --verbose
```

The audit covers the complete `@bible-strong/mobile` workspace, including application code,
tests, scripts, Expo DOM code, and checked-in third-party browser assets.

## Result

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Files scanned | 1,552 | 1,553 | +1 shared hook |
| Total diagnostics | 897 | 748 | -149 |
| Errors | 130 | 30 | -100 |
| Warnings | 767 | 718 | -49 |
| Performance errors | 104 | 27 | -77 |
| Bug errors | 26 | 3 | -23 |
| Accessibility warnings | 10 | 0 | -10 |

React Doctor did not produce an updated numerical score because its maintainability analysis did
not complete. The diagnostics JSON was still produced and contains all 748 reported findings.

## Confirmed fixes

- Removed state and ref mutations during render in gesture, portal, audio, migration, sync, timeline,
  and onboarding code.
- Replaced forced audio rerenders with explicit React state.
- Added cleanup or cancellation for delayed navigation, list scrolling, audio initialization, and
  new-tab expansion.
- Ensured loading indicators reset when authentication promises reject.
- Added HTTP status checks and defensive JSON validation.
- Propagated effect cleanup returns from `useDidUpdate`.
- Migrated the remaining Reanimated scheduler calls to Worklets `scheduleOnRN`.
- Replaced unstable list keys where domain identities already existed.
- Removed unused render-time helpers and dead clickable SVG APIs.
- Made relative-date rendering deterministic through a mount-time hook.
- Added length guards before prefix comparisons and parallelized independent module imports.

## Remaining errors

The remaining 30 error-level findings were reviewed by family:

| Rule family | Count | Disposition |
|---|---:|---|
| `react-hooks-js/todo` | 22 | React Compiler opt-outs caused by supported runtime patterns such as `try`/`catch`, dynamic imports, and guarded throws. They are not runtime failures. Refactor only as focused feature work. |
| `react-doctor/effect-needs-cleanup` | 3 | False positives. `InitHooks` clears its owned timer, `useTouchSelection` clears gesture timers and listeners, and `useConnection` returns platform-specific unsubscribe functions. |
| `react-hooks-js/refs` | 3 | Intentional previous-value/debounce patterns in commentary animation, `usePrevious`, and tab-group sync. Replacing them would change timing semantics; affected functions merely opt out of compiler memoization. |
| `react-hooks-js/purity` | 2 | `Date.now()` is called from user-event/analytics callbacks, not while producing JSX. Runtime-safe false positives. |

## Remaining warning families

The largest warning groups are migration-scale or advisory rather than safe mechanical fixes:

- 79 chained array iterations and 25 array lookups in loops: optimize only with profiling; many
  operate on small catalogs or scripts where combining passes would reduce clarity.
- 69 component files with additional exports: primarily Fast Refresh boundary guidance, not a
  correctness problem. Moving public helpers requires module-boundary review.
- 68 manual memoizations: do not remove globally while React Compiler deliberately skips some of
  these components. Remove only after confirming compiler coverage and measuring rerenders.
- 63 high-complexity functions and 31 large components: architectural refactors requiring focused
  tests and feature ownership, not a lint cleanup.
- 51 state updates in effects and 37 state adjustments after prop changes: many implement bridge,
  animation, sheet, or persisted-state synchronization. Review per workflow.
- 49 `Touchable*` usages: a UI migration to `Pressable` changes interaction and styling semantics
  and should be visually tested as a dedicated project.
- 45 awaits in loops: many preserve migration, SQLite, download, or publication ordering. Parallelize
  only after proving independence and resource limits.
- 35 remaining array-index keys: mostly generated text fragments, SVG decoration, or fixed visual
  sequences without a durable domain identity.
- The single security warning is inside the checked-in Quill browser bundle's HTML rendering path.
  Treat it as a dependency/editor migration concern; do not hand-edit the generated bundle.

## Validation

- Mobile TypeScript typecheck passed.
- Mobile lint passed with the existing warning baseline and no errors.
- All 272 Jest suites and 1,952 tests passed.
- Architecture, style-baseline, and domain-quality checks passed.
- React Doctor was rerun over the complete mobile workspace after the fixes.
