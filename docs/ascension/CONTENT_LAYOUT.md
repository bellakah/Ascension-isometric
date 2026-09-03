# Ascension Content Layout

This document defines the canonical namespace for Ascension-authored runtime
content. It is intentionally additive: the imported World of ClaudeCraft
foundation keeps its current paths until each asset family is migrated in a
separate tested step.

## Runtime asset root

All new Ascension-owned browser/runtime assets belong under:

`public/ascension/`

Canonical categories:

- `characters/` — player/NPC character assets and character-specific media.
- `animations/` — animation clips or animation metadata owned by Ascension.
- `models/` — environment, creatures, props, equipment, structures and other
  3D models that are not character packages.
- `textures/` — world, model, terrain and shared material textures.
- `audio/` — music, ambience, voices and sound effects.
- `maps/` — Ascension-authored world/map payloads and map-specific resources.
- `ui/` — interface art, icons and other visual UI assets.
- `vfx/` — Ascension-owned visual-effect assets.
- `data/` — authored content data that is safe to serve as static runtime
  content.

## Runtime path contract

Code that needs an Ascension-owned runtime URL should use
`src/ascension/assets.ts` instead of hard-coding `/ascension/...` strings.

Example:

```ts
ascensionAssetPath('models', 'village/house-a.glb');
// /ascension/models/village/house-a.glb
```

The resolver accepts only the canonical categories above and safe relative
paths. Absolute paths, dot traversal, backslashes, query/hash suffixes and
encoded path traversal/separators are rejected. This gives future editor,
character, map and content integrations one stable boundary while leaving the
foundation's existing asset loaders untouched.

## Code boundary

When an Ascension-specific adapter or configuration module becomes necessary,
place it under `src/ascension/`. That directory is not a second game engine.
Existing systems in `src/game`, `src/sim`, `src/render`, `src/editor`, `server`
and other upstream areas must be configured or extended before a parallel
implementation is considered.

## Migration rules

1. New Ascension content goes into the Ascension namespace from day one.
2. Existing upstream files are not moved merely for cosmetic organization.
3. A referenced upstream asset is replaced only when its consumer path and
   tests are updated in the same focused change.
4. Do not overwrite upstream source assets with unrelated Ascension files;
   this keeps provenance and rollback clear.
5. Keep filenames lowercase where practical and use stable, descriptive IDs.
6. Prefer one manifest/registry integration point per asset family rather than
   hard-coded paths scattered through gameplay code.
7. Every future migration should state whether the old upstream asset remains
   required, can be archived, or can be removed.

## Current phase

Stage 2.1 establishes the shared runtime path contract. No existing model,
texture, audio, map or character loader is replaced in this stage, so current
gameplay asset resolution remains unchanged.
