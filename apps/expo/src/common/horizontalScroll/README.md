# Horizontal control bands

Use HorizontalControlScrollView for explicitly opted-in horizontal filter/category
bands. Native is a direct re-export of React Native ScrollView, including its ref.
Web retains that ScrollView and adds useHorizontalWheel plus overflow arrows.

Vertical wheel input is translated only while the strip can move in that direction.
Horizontal/diagonal gestures, Shift, Ctrl and Meta remain native. Pixel, line and
page units are normalized. Edges and non-overflowing strips do not cancel events.
Wheel movement is immediate; arrow movement respects reduced motion. Resize and
content observers update the arrows without changing the available content width.
Listeners and observers are removed on unmount.

Currently used by SearchItemFilterBar (including Add relation), SearchFacetBar and
FilterChipRow. Do not automatically apply this to all ScrollViews or Bible reading
columns, media, galleries or other surfaces with their own gestures.
