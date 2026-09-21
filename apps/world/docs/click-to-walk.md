# Click and tap navigation

Click or briefly tap walkable ground to move there. A small illustrated downward arrow marks the destination; the route itself stays invisible. A new destination replaces the route. Water, blocked footprints and disconnected ground display only an illustrated red cross, without a text message.

Hold for 200 ms or drag with one pointer to steer directly, like a joystick on the map. Pointer distance from the avatar controls speed: a 15-pixel dead zone stops movement, and 120 pixels reaches normal maximum walking speed. This distance is measured in CSS pixels independently of camera zoom. Releasing or cancelling the pointer stops steering. No line or marker is drawn during held steering. A second finger cancels steering and starts pinch zoom. Direct steering uses ordinary collisions; automatic obstacle avoidance remains the behavior of short clicks/taps.

Arrow keys, WASD/ZQSD or touching the joystick cancel the route and pointer steering. Opening a dialog, editing navigation, changing spawn, returning to the plaza or leaving the window cancels them too. Dragging, long presses and multi-touch zoom do not set automatic destinations. Existing menu travel continues to use its separate arrival behavior.

`Pathfinder` builds an 8-unit grid lazily in the original map coordinate system. A* explores eight neighbors, checking whole edges with the same `canStand` footprint rules as manual movement. Spatial buckets and cached cells/edges avoid scanning all polygons on every search. Endpoints connect to nearby visible grid points; line-of-sight simplification removes unnecessary turns without cutting through obstacles. Recreate the planner whenever the navigation document changes.

`WalkingRoute` follows the result using the existing movement speed and collision solver. It limits each step to the remaining waypoint distance, stops precisely at arrival, and cancels if it becomes stuck. Paths stay local; multiplayer receives the resulting ordinary movement updates.

Validation covers obstacle clearance, disconnected ground, manual cancellation, exact arrival, tap/pinch separation and all six destinations on the saved navigation document. Very narrow passages that have no valid grid point may be reported unreachable; the authored island bridges are covered by tests.
