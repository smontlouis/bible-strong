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
- `Scene.Node`: a stable identity, one root React element, a frame, optional named anchors, and
  `layout="scale" | "resize" | "position" | "auto"`.
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
- Same `id`, different root React type: the container remains stable and keyed inner content uses
  a fade-through.
- Incoming-only `id`: a node container mounts with an entry fade.
- Outgoing-only `id`: the reconciler retains its descriptor and React instance while opacity
  animates out, then removes it after the exit duration.
- Unwrapped content: the whole ordinary layer is keyed by scene `id`.

Each mounted node publishes stable SharedValues for x, y, width, height, scale, and rotation.
SVG lines resolve named anchors from those values on the UI thread, including center-origin scale
and rotation, so they follow the moving card without JS-frame updates.

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
as the scene-one palette above nodes. Exiting unique nodes retain their previous z-index.

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

Validated on 2026-08-07 with the iPhone 17 Pro simulator (iOS 26.5), the installed development
client, and the current Metro bundle. Across scene 1 to scene 2, the verse kept the same line
breaks (`Elle enfanta encore son frère`, `. Abel fut berger,`, `et Caïn fut laboureur.`) while
moving, rotating, and scaling. The six SVG connections ended on their declared visual anchors,
and a second transition added no new Reanimated warnings or runtime errors. The scene-one color
palette and edit control were also checked after introducing explicit scene layers.

## Verdict

The small public interface is viable for the two-scene onboarding slice, and it removes the
public concepts of persistent actor and slot. Before extending to all eight scenes, prototype
intrinsic measurement/premount and decide whether the factory-based compilation remains the
production authoring model or should be replaced by a registration pass.
