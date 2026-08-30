# Ascension Isometric

Browser-first 3D isometric RPG/MMO foundation built with **TypeScript + Three.js + Vite**.

The project is intentionally split so the **game and editor reuse the same engine and world runtime**. The current foundation includes the first production-oriented Asset System for importing and placing real GLB/GLTF content in the editor.

## Requirements

- Windows 10/11 for `start.bat` (manual commands also work on Linux/macOS)
- Node.js **22.12.0 or newer**
- A WebGL-capable browser
- Internet access on the first run so project dependencies can be installed

## Run on Windows

1. Download or clone the repository.
2. Extract it if you downloaded a ZIP.
3. Double-click **`start.bat`**.
4. The starter uses `npx` to run the pinned **pnpm 10.34.5** from the user cache, without requiring Administrator access or writing into `C:\Program Files\nodejs`.
5. On first run all project dependencies are installed automatically.
6. The game opens at `http://localhost:5173/`.

The editor is available at `http://localhost:5173/editor.html` or through the **Editor** button in the game header.

## Manual run

```bash
npx --yes pnpm@10.34.5 install --no-frozen-lockfile
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

## Etapa 2 — Asset System

- Importação `.glb`.
- Importação `.gltf` com resolução de `.bin` e texturas externas.
- Seleção múltipla e drag-and-drop.
- Validação de dependências GLTF com erro específico para arquivos ausentes.
- Persistência dos assets em IndexedDB.
- IDs `user/<sha256>` para deduplicação e futura sincronização.
- Thumbnail WebP gerada localmente.
- Asset Browser com busca e categorias.
- Preview 3D com reprodução da primeira animação disponível.
- Metadata de origem, licença, arquivos e animações.
- Modo de colocação no mapa com ghost, snap de 0,5 e clique para instanciar.
- Catálogo dos primeiros oito packs KayKit CC0 enviado para o projeto.

Detalhes em `docs/ASSET_SYSTEM.md` e `docs/ASSETS.md`.

## Engineering

- Strict TypeScript.
- Vite multi-page build.
- Vitest unit tests for isometric-camera, movement and asset import helpers.
- GitHub Action **Validate Ascension Isometric** runs typecheck, tests and production build.
- pnpm 10.34.5 is the project package manager.
- Engineering rules recorded in `AGENTS.md`.
- Architecture notes in `docs/ARCHITECTURE.md`.

## Validation

```bash
npx --yes pnpm@10.34.5 run ci
```

## Next milestones

1. Seleção de entidades já colocadas no mundo.
2. Gizmos profissionais de Move / Rotate / Scale.
3. Hierarchy + Inspector.
4. WorldDocument serializável, save/load/autosave e undo/redo.
5. Asset defaults: escala, rotação, pivot, collider e sombras.
6. Instant playtest usando o WorldDocument atual do editor.

## Inspiration

The architecture is informed by useful patterns observed in the MIT-licensed **World of ClaudeCraft**, especially sharing the real runtime between editor and gameplay. Ascension Isometric is being built as its own focused codebase rather than copying the full upstream project.
