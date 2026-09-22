# Central table at half size

Ground repair generated with the built-in imagegen tool, from a 4× map crop at
logical `(700, 365, 280, 180)`.

Prompt:

> Edit target: attached game map crop. Remove the entire central wooden round table AND its open book AND all table legs and their cast shadows completely. Reconstruct the pale cream sandstone paving underneath seamlessly, with sparse thin irregular stone joints matching the surrounding paving and circular plaza. Preserve the exact camera, framing, proportions, colors, all peripheral benches, vegetation and circular paving borders pixel-aligned. No new objects. This is a clean ground plate for a game, empty center. Output same landscape aspect ratio.

`central-table-half.webp` is the reviewed RGBA patch at 4× resolution, covering
logical `(736, 388, 200, 140)` with a 6-unit feathered edge. It includes the original
`occlusion/central-table.webp` at exactly 50% of its former logical dimensions,
scaled around `(836, 470)` then moved up 10 logical units to `(836, 460)`. The original cutout is retained;
its display bounds and depth anchor in the occlusion manifest are scaled likewise.

The tile generator applies this patch to the original normalized map before
producing both tile levels and the preview. Always pass the original full map
source to `yarn workspace @bible-strong/world tiles <source>`.
