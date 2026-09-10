# ADR-0044: Forward className through Expo UI components

- Status: Accepted
- Date: 2026-09-10

## Context

The Uniwind migration in commit `f7971bdc8` converted classes into style objects
inside shared wrappers with `useResolveClassNames`. On Web, this scans CSS rules
and computed styles at render and again during mounting. Repeating this work for
each Box and Text made list popovers noticeably slow.

## Decision

- Forward `className` directly to React Native components through the existing
  Uniwind Metro integration. On Web this uses Tailwind CSS classes; on native it
  uses Uniwind's native styles. Do not resolve classes in UI render functions.
- Merge wrapper defaults and caller classes with `twMerge`, with caller classes
  last. Keep computed values and explicit overrides in `style`.
- Keep Text's typography defaults in classes so caller classes can override them.
- Forward classes through custom components, including Link and polymorphic Box.
- Use standard `withUniwind` adapters for third-party style slots such as vector
  icons. Do not introduce custom CSS-reading or class-to-style conversion code.
- Keep theme palette generation and scoped themes as the source of CSS variables.
  Retain the Bible DOM boundary described by ADR-0040.
- Extend the styling guard to reject `useResolveClassNames` in UI components.

## Consequences

Shared interfaces use the standard styling path on both platforms. Classes stay
visible in the Web DOM; explicit styles keep their higher priority. Wrapper and
primitive tests verify forwarding, merging, refs and custom components; browser
checks verify actual computed styles and scoped themes. Popover rows use the shared primitives again; fixing performance no longer
requires replacing Box with a custom HTML implementation.
