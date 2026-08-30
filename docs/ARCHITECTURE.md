# Ascension Isometric architecture

## Foundation v0.1

The first vertical slice deliberately keeps the stack small: TypeScript, Three.js, Vite and Vitest.

Both entry points share the same engine and demo-world factory:

```text
index.html       editor.html
    |                |
src/game        src/editor
     \              /
       Engine + Camera
             |
          World
```

The game currently provides a movable placeholder player and an orthographic isometric follow camera. The editor provides a free isometric viewport with pan, zoom and 90-degree camera rotation.

## Non-negotiable seams

1. The editor must render the real game world/runtime, not a visual approximation.
2. World data should become serializable documents; rendering must consume those documents rather than own them.
3. Asset import will normalize metadata and use GLTF/GLB as the preferred runtime format.
4. Browser APIs must be isolated from deterministic/core logic where practical.
5. Multiplayer will be added after the local game loop and content pipeline are stable; server authority must not require replacing the renderer/world architecture.

## Next technical milestones

- Asset registry and GLB drag/drop import.
- Selection, transform gizmos and hierarchy/inspector.
- World document schema + save/load/autosave.
- Undo/redo command history.
- Playtest handoff from editor to game using the same world document.
