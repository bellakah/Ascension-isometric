# Ascension Isometric

Browser-first 3D isometric RPG/MMO foundation built with **TypeScript + Three.js + Vite**.

The game and editor reuse the same engine/world runtime. Starting in **v0.2.1**, the primary visual direction is Quaternius stylized low-poly fantasy, while KayKit remains supported as a secondary library.

## Requirements

- Windows 10/11 for `start.bat`
- Node.js **22.12.0 or newer**
- A WebGL-capable browser
- Internet access on first run

## Run on Windows

1. Download or clone the repository.
2. Extract the repository ZIP.
3. Double-click **`start.bat`**.
4. Dependencies are installed automatically without Administrator access.
5. Game: `http://localhost:5173/`
6. Editor: `http://localhost:5173/editor.html`

## Editor Asset System

The editor supports:
- GLB;
- GLTF + BIN + referenced textures;
- FBX + textures;
- drag-and-drop;
- IndexedDB persistence;
- thumbnails;
- category/search filters;
- 3D preview with animation playback;
- placing assets in the world.

### ZIP Package Inspector

Use **Importar ZIP** to open a complete source pack.

The browser:
1. extracts the ZIP temporarily;
2. discovers the models;
3. hides duplicate export formats;
4. shows a searchable model list on the left;
5. shows a live 3D viewer on the right;
6. lets you select individual models, select all, or import everything;
7. persists only the models you actually confirm.

Runtime format priority is **GLB > GLTF > FBX**.

Details: `docs/ZIP_IMPORTER.md`.

## Art direction

The primary approved Quaternius library currently includes:
- Universal Base Characters;
- Universal Animation Library;
- Universal Animation Library 2;
- Fantasy Props MegaKit;
- Stylized Nature MegaKit;
- Easy Enemy Pack.

These packs are CC0. See `docs/ART_DIRECTION.md` and `docs/ASSETS.md`.

## Validation

```bash
npx --yes pnpm@10.34.5 run ci
```

GitHub Action **Validate Ascension Isometric** runs typecheck, unit tests and production build.

## Next milestones

1. Entity selection in the world.
2. Move / Rotate / Scale gizmos.
3. Hierarchy + Inspector.
4. Serializable WorldDocument.
5. Save/load/autosave and undo/redo.
6. Character rig/animation assignment and retargeting workflow.
