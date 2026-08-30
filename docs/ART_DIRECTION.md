# Art Direction — Quaternius Primary

Ascension Isometric adopts **Quaternius** as the primary 3D art direction starting in v0.2.1.

## Visual target

The intended world is stylized low-poly fantasy with:
- readable silhouettes from an isometric camera;
- richer proportions and textures than the initial placeholder/KayKit direction;
- cohesive fantasy props, nature, characters and enemies;
- bright but grounded materials;
- animation-friendly humanoid characters;
- enough detail to support close editor previews without losing clarity in gameplay.

## Primary library

The first approved Quaternius packs are:
- Universal Base Characters;
- Universal Animation Library;
- Universal Animation Library 2;
- Fantasy Props MegaKit;
- Stylized Nature MegaKit;
- Easy Enemy Pack.

These packs are CC0. The Universal Base Characters use a humanoid rig and are designed to work with the Universal Animation Libraries.

## Secondary compatibility library

The previously approved KayKit packs remain supported and may still be useful for prototypes, utility props and gap filling. They are no longer the visual reference for new core content.

## Runtime preference

When a model exists in several formats, the editor prefers:

1. GLB
2. GLTF
3. FBX
4. OBJ is treated as a source/fallback format and is not selected when a browser-friendly duplicate exists.

The ZIP inspector intentionally hides duplicate export formats so the artist sees one useful model entry instead of FBX/OBJ/GLTF copies of the same asset.

## Future packs

Additional packs can be added without changing the runtime architecture. The import pipeline stores source pack, author/license metadata and archive name with each imported asset.
