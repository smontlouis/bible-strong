# Biblical map context

The map of the places of the Bible, drawn for a web page: the atlas of the public site and the
map screen of the application, which shows it in a DOM component. Its projection and how names
are placed belong to `@bible-strong/resource-domain/biblical-map`.

## Language

**Map unit**:
A hundredth of a degree of latitude on the projection true to scale along the 32nd parallel.
_Avoid_: Pixel, point

**View**:
The window of the map shown in the frame, in map units.
_Avoid_: Camera, viewport

**Ground**:
The land, lakes and rivers of Natural Earth on which places are drawn.
_Avoid_: Tiles, base layer

**Glide**:
The move a map keeps after a finger lifts, slowing until it stops.
_Avoid_: Scroll, fling
