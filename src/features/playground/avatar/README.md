# Bible Strong avatar prototype

This development-only playground reproduces the geometry and motion model exposed by the public
GrokBot browser bundle, then renders it with React Native SVG.

## What the source actually does

The large apparent changes in gaze are not produced by moving two capsules around a sphere. The
source contains 25 authored expressions. Every expression is a pair of compatible 48-point SVG
rings, so any two expressions can morph point by point.

Three user reference captures map directly to expression indexes:

- `0`: narrow oblique eyes at the top-right;
- `3`: round eyes at the far left;
- `1`: elongated eyes near the bottom.

The runtime then layers independent signals over those authored contours:

1. `expression` selects the two SVG rings and morphs to them with a damped spring;
2. `gaze` adds a small, smoothed translation (about ±13.2 × ±8.4 source units);
3. `turn` (in radians) projects the eye centers around the silhouette with sine/cosine depth
   compression;
4. `eyeScale` is capped so the two eyes cannot overlap;
5. every transformed point is checked against the head outline to keep the eyes inside it;
6. a blink scales the eyes vertically over 320 ms, with a faster close than reopen.

The head is the source's slightly organic solid path. Bible Strong variants only change the flat
fill colors; there is no gradient, border, highlight, halo, or shadow.

## Component contract

`BibleStrongAvatar` exposes `expression`, `gaze`, `turn`, `eyeScale`, `blinkKey`,
`autoBlink`, `variant`, and `size`. Older semantic props remain temporarily available while the
future Bible Strong state mapping is designed.

## Run

```bash
yarn start
```

Open `/playground?playground=avatar` in a development build, or use the Avatar entry shown only in
the development More menu. The route redirects home when `__DEV__` is false.
