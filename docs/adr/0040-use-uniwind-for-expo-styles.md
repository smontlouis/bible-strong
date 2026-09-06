# ADR-0040: Use Uniwind for Expo styles

- Status: Accepted
- Date: 2026-09-06

## Context

The Expo app shares its interface across iOS, Android and Web. Emotion provided both
native styled components and the theme context. We want Tailwind classes while
preserving Bible Strong's layouts, reading typography, eight palettes and animations.
The Bible DOM document has its own Web rendering boundary and receives serializable
settings, including colors; it cannot inherit a native React context.

## Decision

- Replace direct Emotion dependencies with Uniwind and Tailwind CSS v4.
- Keep `Box`, `HStack` and `VStack`. Use `className` for static styles, with row and
  column defaults on the two stack components. Native props, refs, explicit styles
  and existing animated exports remain available.
- Preserve exact legacy measurements using pixel utilities rather than rounding
  them to a new spacing or typography scale. Omit Tailwind Preflight so it does not
  reset React Native Web or embedded DOM styles.
- Keep the palette modules in `apps/expo/src/themes/` as the source of truth.
  `scripts/generate-theme-css.cjs` derives `global.css`; Metro refreshes this file at
  startup. `themes:check` detects stale generated CSS. After editing a palette,
  run `themes:generate` (or restart Metro).
- Use a local React theme context for reader fonts, navigation, icons and other
  consumers that need JavaScript values. Scope Uniwind to the matching palette,
  including nested Playground previews.
- Preserve the existing Bible DOM settings bridge. The document continues to use
  its existing Web styles and the same palette values. Adopting Tailwind inside
  that document is a separate change, not a prerequisite for sharing colors.
- Use HeroUI Dropdown in the Web-only `MenuView` adapter to replace the previous
  no-op implementation. Preserve the shared action contract and native adapters.
  Scope menu CSS to the adapter and pass palette values into portaled popovers;
  do not import global HeroUI resets or replace the application's theme.

## Consequences

Static primitive usages and former Emotion wrappers use Uniwind classes. Computed
styles retain their calculations and explicit `style` overrides take precedence.
Legacy style props have been removed from `Box` and `Text`, including spread-based
callers. `Box` adds no layout defaults; existing screens declare their clipping
and border curve explicitly. `Text` retains only application typography defaults.
Use `className` for fixed or finite conditional variants and native `style` for
calculated values. Color resolution and alpha replacement are plain value helpers,
not a component-prop compatibility layer. Type-level regression checks reject the
old primitive API. Nested style arrays are flattened recursively at Link boundaries.

Web export and representative browser checks validate this migration. Native
runtime verification remains necessary before a mobile release.
