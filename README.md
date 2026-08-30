# Ascension Isometric

Browser-first 3D isometric RPG/MMO foundation built with **TypeScript + Three.js + Vite**.

The project is intentionally split so the **game and editor reuse the same engine and world runtime**. The current `v0.1` foundation is the first vertical slice; the next milestones add the GLB asset pipeline and real world-editing tools.

## Requirements

- Windows 10/11 for `start.bat` (manual commands also work on Linux/macOS)
- Node.js **22.12.0 or newer**
- A WebGL-capable browser

## Run on Windows

1. Download or clone the repository.
2. Extract it if you downloaded a ZIP.
3. Double-click **`start.bat`**.
4. The starter checks Node.js/npm, downloads the project-pinned **pnpm 10.34.5** into the current user's npm cache using `npx`, and installs all project dependencies automatically.
5. No Administrator permission and no global pnpm installation are required.
6. The game opens at `http://localhost:5173/`.

On the first run, internet access is required to download pnpm and the JavaScript dependencies. Later runs reuse the local npm/pnpm caches and only synchronize dependency changes.

The editor is available at `http://localhost:5173/editor.html` or through the **Editor** button in the game header.

### Why the starter does not use `corepack enable`

`corepack enable` tries to create command shims such as `pnpm.CMD` beside the Node.js installation. On Windows installations under `C:\Program Files\nodejs`, a normal user may receive an `EPERM: operation not permitted` error. `start.bat` therefore runs the pinned pnpm through `npx`, which writes only to the user's npm cache and the project directory.

## Manual run

Windows/Linux/macOS users can also run:

```bash
npx --yes pnpm@10.34.5 install --frozen-lockfile
npx --yes pnpm@10.34.5 run dev
```

## Foundation v0.1

### Game
- Real Three.js WebGL renderer.
- Orthographic isometric camera using the classic ~35.264° elevation.
- Responsive viewport and DPR cap.
- Lighting and soft shadows.
- Placeholder low-poly world proving the render pipeline.
- Movable player placeholder with WASD.
- Camera follow and mouse-wheel zoom.

### Editor
- Separate `/editor.html` entry point.
- Reuses the same `Engine`, `IsometricCamera`, and world factory as the game.
- Orthographic isometric viewport.
- Right-mouse drag to pan.
- Mouse wheel to zoom.
- Q/E rotates the view by 90°.
- Browser context menu disabled inside the viewport.

### Engineering
- Strict TypeScript.
- Vite multi-page build.
- Vitest unit tests for isometric-camera and movement math.
- GitHub Action **Validate Ascension Isometric** runs typecheck, tests and production build.
- pnpm 10.34.5 is the project package manager.
- Engineering rules recorded in `AGENTS.md`.
- Architecture notes in `docs/ARCHITECTURE.md`.
- Initial KayKit asset packs recorded in `docs/ASSETS.md`.

## Validation

```bash
npx --yes pnpm@10.34.5 run ci
```

## Next milestones

1. GLB/GLTF asset registry and drag/drop import.
2. Asset Browser with thumbnails and metadata.
3. Entity selection and transform gizmos.
4. Hierarchy + Inspector.
5. Serializable WorldDocument, save/load/autosave and undo/redo.
6. Instant playtest using the editor's current world document.

## Inspiration

The architecture is informed by useful patterns observed in the MIT-licensed **World of ClaudeCraft**, especially sharing the real runtime between editor and gameplay. Ascension Isometric is being built as its own focused codebase rather than copying the full upstream project.
