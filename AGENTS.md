# Ascension Isometric - engineering rules

## Git workflow
- Never develop directly on `main` after the repository bootstrap.
- Create a feature/fix branch, open a pull request, and merge only after `Validate Ascension Isometric` succeeds.
- Keep commits scoped and preserve browser compatibility.

## Architecture
- `src/engine`: rendering loop and engine infrastructure only.
- `src/camera`: camera math/controllers independent from gameplay.
- `src/world`: serializable/world construction concerns.
- `src/game`: player-facing runtime and gameplay controllers.
- `src/editor`: editor composition. The editor must reuse the same engine/world runtime as the game.
- Prefer pure modules for math/state decisions so they can be unit-tested without WebGL or DOM.

## Project direction
- Browser-first, TypeScript + Three.js.
- 3D world presented through an orthographic isometric camera.
- Future content must be data-driven instead of hardcoded into UI modules.
- GLTF/GLB is the preferred runtime 3D asset format.
- Imported assets will be registered through an asset pipeline rather than referenced ad hoc.
