# Scene graph prototype

## Question

Can onboarding scenes own a complete JSX composition while the runtime keeps a node with the
same identity mounted and animates connections from the same live geometry?

This prototype answers **yes for an explicit, stage-local scene graph**. It does not yet prove
measurement of intrinsic or deeply nested layouts.

## Public interface

`SceneGraph` receives every scene declaration plus the active scene identifier. Its direct
children are configuration elements, not independently mounted React subtrees.

```tsx
<SceneGraph
  activeSceneId={sceneId}
  connectionColor={theme.colors.primary}
  metrics={metrics}
  reduceMotion={reduceMotion}
>
  <Scene id="verse-exploration">
    <Scene.Node
      id="verse-card"
      layout="scale"
      frame={{ x: -90, y: 221, width: 382, height: 294, scale: 0.5 }}
    >
      <VerseCard />
    </Scene.Node>

    <Scene.Node id="lexique" frame={{ x: 118, y: 131, width: 158, height: 72 }}>
      <LexiqueCard />
    </Scene.Node>

    <Scene.Node
      id="custom-node"
      frame={{ x: 24, y: 48, width: 120, height: 56 }}
      enterFrom={{ x: 24, y: -16 }}
      exitTo={{ x: 24, y: -16 }}
    >
      <CustomCard />
    </Scene.Node>

    <Scene.Connection
      from={{ node: 'verse-card', anchor: 'highlightedWord' }}
      to={{ node: 'lexique', anchor: 'bottom' }}
    />

    <Scene.Layer zIndex={5}>
      <OrdinarySceneControls />
    </Scene.Layer>
    <OrdinarySceneBackground />
  </Scene>
</SceneGraph>
```

The interface consists of:

- `Scene`: one declarative graph selected by `id`.
- `Scene.Node`: a stable identity, one root React element, a frame, optional named anchors,
  independently configurable `entering` and `exiting` Reanimated animations, and
  `layout="scale" | "resize" | "position" | "auto"`. Passing `false` disables either animation.
  `enterFrom` and `exitTo` are convenience offsets using the default spring. A custom `entering`
  or `exiting` animation takes precedence over its corresponding offset. Nodes may also opt into
  bounded dragging and a press interaction.
- `Scene.Connection`: two node/anchor endpoints plus optional stroke presentation.
- `Scene.Layer`: optional stacking for ordinary scene-owned content that must sit above or below
  graph nodes. It does not create persistent identity.
- Unwrapped children: ordinary React content keyed by scene and mounted/unmounted normally.

Mode semantics in the prototype:

- `scale`: preserves the first mounted width and height and animates position, rotation, opacity,
  and scale. This is the verse-card contract and prevents text reflow.
- `resize`: animates width and height and may cause content reflow.
- `position`: preserves the first width and height and ignores scale changes.
- `auto`: uses resize if the declared dimensions change; otherwise it behaves like scale.

## Reconciler and lifecycle

`SceneGraph` compiles the active declaration into node, connection, and ordinary-child
descriptors. React keys each stable node container by node `id`:

- Same `id`, same root React type: the container and child type reconcile in place, preserving
  hooks and local state while SharedValues animate to the next frame.
- Same `id`, different root React type: the container remains stable while React replaces its
  keyed inner content with a spring crossfade. The frame can therefore move and resize while one
  visual representation becomes another. Node-level entry and exit animations remain reserved
  for mount/unmount.
- Incoming-only `id`: a node container mounts with its configured `entering` animation, or the
  default delayed spring fade/translation.
- Outgoing-only `id`: React removes the node immediately and Reanimated keeps its native view
  alive until its configured `exiting` animation, or the default spring fade, completes.
- Unwrapped content: the whole ordinary layer is keyed by scene `id`.

Each mounted node publishes stable SharedValues for x, y, width, height, scale, and rotation.
SVG lines resolve named anchors from those values on the UI thread, including center-origin scale
and rotation, so they follow the moving card without JS-frame updates.

## Node interaction

Nodes can opt into constrained dragging without owning gesture state:

```tsx
<Scene.Node
  id="lexique"
  frame={...}
  draggable
  dragFriction={0.45}
  onPress={advance}
  pressScale={0.96}
>
  <LexiqueCard />
</Scene.Node>
```

`dragFriction` controls how much of the finger movement reaches the node. An optional `dragBounds`
can reference another node whose live geometry defines an allowed rectangle. Without it, dragging
is unconstrained. With bounds, resistance increases continuously as the node approaches an edge,
so the edge is never crossed or reached with an abrupt stop. Drag offsets remain separate from
authored scene positions, and connections include those offsets on the UI thread. Nodes spring
back to their authored position by default; `dragReturnToOrigin={false}` instead continues with
velocity-based decay. Its velocity also decreases with the remaining distance to an optional
bound. When a node is both draggable and pressable, a pan cancels its tap.
Every draggable node applies its `pressScale` (0.96 by default) as soon as the finger goes down,
keeps that scale throughout the pan, and springs back to 1 when the gesture ends.

The gesture detector is attached to the animated visual node rather than its stable outer
container. Scale-mode nodes therefore use their current translated, rotated, and scaled hit area;
their historical frame never blocks sibling interactions. A node's `pointerEvents` value is
propagated through the engine-owned wrappers, so `box-none` can expose underlying gestures while
keeping the node's interactive descendants available.

Node content can transition independently from its stable geometry. A `contentKey` change
crossfades the old and new child while preserving the node renderer, drag offsets, and connection
anchors. `contentEntering` and `contentExiting` stagger that replacement per node. Connections can
react to the same state through `transitionKey` and `transitionDelay`; their paths stay mounted
and attached while their opacity briefly dips.

## Constraints exposed by the prototype

- A `Scene` must be a direct `SceneGraph` child. Its markers must be direct scene children or
  inside fragments. React does not allow the runtime to inspect the rendered output of an opaque
  function component. The prototype therefore exports pure scene-element factories from each
  scene module.
- Node children render under `SceneGraph`, not under scene-local context providers. App-level
  theme, i18n, Redux, and navigation providers still work. A provider declared inside one scene
  does not follow a persistent node.
- Frames are explicit design-space geometry. Intrinsic measurement, premounting the incoming
  scene, and layout-driven anchors remain unproven.
- Hit testing and accessibility belong to the real node content and move with its container. The
  connection layer has no pointer events. Accessibility order across overlapping nodes still
  needs device validation.
- Connections currently switch with the active scene. A future reconciler may retain outgoing
  connections until their exit completes.

## Registration, mounting, and stacking

Compilation is synchronous: scene factories produce configuration elements, `SceneGraph` parses
them, React commits node renderers, then each renderer publishes its SharedValues in a layout
effect. Connections render after the registry notification. A connection with an endpoint that
has not registered yet returns `null`, so it never draws a transient line from `(0, 0)`.

The explicit-frame prototype never double-mounts node content. A future intrinsic-measurement
prepass would either mount a measurement shell without the real child or accept a documented
double mount; this decision remains open. Stable nodes use their frame `zIndex`; connections use
layer 2; ordinary content defaults to layer 1; and `Scene.Layer` explicitly places controls such
as the scene-one palette above nodes. Reanimated owns the native lifetime of exiting nodes.

## Comparison with the previous implementation

The previous `PersistentActor` had stable React ownership and protected the verse-card width, but
the screen had to render that actor outside both scenes and look up coordinates in an external
registry. Scene authors therefore needed to distinguish actors, slots, and ordinary content.

The graph runtime keeps the useful part: one stable owner renders keyed node instances and scale
mode fixes intrinsic dimensions. It moves frames, anchors, and connections into each scene
declaration and derives persistence from matching identifiers and root React types. The tradeoff
is that node children inherit runtime-level providers rather than scene-local providers, and the
current explicit frames do not yet prove intrinsic measurement or premount.

## Device validation

Validated on 2026-08-08 with the iPhone 17 Pro simulator (iOS 26.5), the installed development
client, and the current Metro bundle. Across scenes 1 through 3, the verse kept the same line
breaks (`Elle enfanta encore son frère`, `. Abel fut berger,`, `et Caïn fut laboureur.`) while
moving, rotating, scaling, and fading behind the Strong card stack. The six SVG connections ended
on their declared visual anchors. The scene-one color palette and edit control were also checked:
selecting turquoise updated the highlighted word and preserved it in later scenes. Scene 3's two
mounted Strong cards swapped front/rear roles in both swipe directions, updated pagination and
prompt state, and launched their remote pronunciation audio from the card control. Between scenes
3 and 4, the stable Strong node moved and resized while its carousel crossfaded into the Hebrew
lemma card. The three delayed occurrence connections remained attached to their live anchors and
appeared in sync with the Proverbes, Job, and Ecclésiaste cards.
Scene 4's vanité, idole, and souffle filters were then exercised in both directions on device.
Each fixed, clipped verse card now runs a local horizontal content carousel: the previous content
leaves opposite the selected filter direction while the replacement enters from that direction.
The card nodes and all three connection paths stay mounted and stationary during the swap. The
connections originate from the live draggable Hevel geometry and continue to follow it.
Between scenes 4 and 5, that same Strong node retained the `strong-stack` identity, moved from the
top lemma position to the lower-right H1892 source position, resized, rotated, and crossfaded its
content behind the incoming note.
Between scenes 5 and 6, `genesis-source`, `question-note`, `abel-source`, and `strong-stack`
retained their identities while becoming the corresponding relation-graph nodes.
Scene 5's four semantic cards were dragged independently. Its three relation chips remained
pressable inside the draggable note and triggered the spring rotation sequence on the matching
Genesis, H1893, or H1892 card. Its rotational shake follows Decaf's 80 ms Bézier impulse, three
reversed repeats, and a final half-mass spring back to rest. In scene 6, every semantic entity was
draggable and its SVG
connections followed the live position; the four labels placed between connections stayed fixed
and non-interactive.

## Verdict

The small public interface is viable for the six-scene onboarding slice, and it removes the
public concepts of persistent actor and slot. Before extending to all eight scenes, prototype
intrinsic measurement/premount and decide whether the factory-based compilation remains the
production authoring model or should be replaced by a registration pass.
