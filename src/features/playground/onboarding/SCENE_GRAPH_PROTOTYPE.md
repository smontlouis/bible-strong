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

    <OrdinarySceneContent />
  </Scene>
</SceneGraph>
```

The interface consists of:

- `Scene`: one declarative graph selected by `id`.
- `Scene.Node`: a stable identity, one root React element, a frame, optional named anchors, and
  `layout="scale" | "resize" | "position" | "auto"`.
- `Scene.Connection`: two node/anchor endpoints plus optional stroke presentation.
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
- Outgoing-only `id`: Reanimated retains its native view for the exit fade, while the React child
  unmounts at reconciliation time.
- Unwrapped content: the whole ordinary layer is keyed by scene `id`.

Each mounted node publishes stable SharedValues for x, y, width, height, scale, and rotation.
SVG lines resolve named anchors from those values on the UI thread, including center-origin scale
and rotation, so they follow the moving card without JS-frame updates.

## Constraints exposed by the prototype

- A `Scene` must be a direct `SceneGraph` child. `Scene.Node` and `Scene.Connection` must be direct
  scene children or inside fragments. React does not allow the runtime to inspect the rendered
  output of an opaque function component. Separate scene modules therefore need to export a pure
  scene-element factory, or a later registration/prepass implementation.
- Node children render under `SceneGraph`, not under scene-local context providers. App-level
  theme, i18n, Redux, and navigation providers still work. A provider declared inside one scene
  does not follow a persistent node.
- Frames are explicit design-space geometry. Intrinsic measurement, premounting the incoming
  scene, and layout-driven anchors remain unproven.
- Reanimated exit animations preserve the outgoing native view, not the outgoing React instance.
  A contract requiring effects or state to remain alive until the exit animation completes needs
  a retained outgoing descriptor in the runtime.
- Hit testing and accessibility belong to the real node content and move with its container. The
  connection layer has no pointer events. Accessibility order across overlapping nodes still
  needs device validation.
- Connections currently switch with the active scene. A future reconciler may retain outgoing
  connections until their exit completes.

## Verdict

The small public interface is viable for the two-scene onboarding slice, and it removes the
public concepts of persistent actor and slot. Before extending to all eight scenes, prototype
intrinsic measurement/premount and decide whether scene modules use pure declaration factories
or a registration pass.
