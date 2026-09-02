# Ascension Isometric

Browser-first 3D isometric RPG/MMO foundation built with **TypeScript + Three.js + Vite**. The game and editor share the same WorldDocument runtime. Quaternius is the primary stylized low-poly art direction; KayKit remains supported as a secondary library.

The staged adaptation of World of Claudecraft systems is tracked in
[`docs/WOC_PORTING_ROADMAP.md`](docs/WOC_PORTING_ROADMAP.md).

## Run

- Node.js 22.12+.
- Double-click `start.bat` on Windows.
- Game: `http://localhost:5173/`
- Editor: `http://localhost:5173/editor.html`

## v0.4 — Multi-map project + real playtest

The editor now supports multiple maps stored in IndexedDB instead of one hidden localStorage document.

- create/open/duplicate/delete maps;
- map name and description;
- spawn point XYZ;
- ground size/color and background color;
- autosave per map;
- legacy v0.3 map migration;
- JSON import/export;
- clean editor world without the old primitive demo houses/trees;
- **Playtest** launches the exact current WorldDocument in the game runtime;
- normal game runtime also resolves the current saved map;
- shared `WorldRuntime` loads the same imported GLB/GLTF/FBX assets in editor and game.

## World Editor

- WorldDocument entities;
- Hierarchy + Inspector;
- click selection and outline;
- TransformControls: G move, R rotate, S scale;
- F focus;
- Ctrl+D duplicate;
- Delete remove;
- Ctrl+Z / Ctrl+Y undo/redo;
- save/import JSON;
- Asset Browser + ZIP Package Inspector.

## Asset pipeline

- GLB;
- GLTF + BIN + referenced textures;
- FBX + textures;
- ZIP package inspection;
- format deduplication priority: GLB > GLTF > FBX;
- IndexedDB asset persistence;
- thumbnails and interactive 3D preview.

## Validation

```bash
npx --yes pnpm@10.34.5 run ci
```

GitHub Action **Validate Ascension Isometric** runs typecheck, unit tests and production build.

## Next milestones

1. Character rig/animation assignment and retargeting.
2. NPC/monster entity types and gameplay components.
3. Collision authoring and nav/walkable data.
4. Terrain/world sculpting and painting tools.
5. Server-authoritative multiplayer world synchronization.
