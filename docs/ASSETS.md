# Approved Asset Library

Ascension Isometric uses a source-driven asset pipeline. Source ZIP packs are inspected in the editor and only selected runtime models are persisted.

## Primary art direction — Quaternius

| Pack | Primary use | Runtime formats | License |
| --- | --- | --- | --- |
| Universal Base Characters | player/NPC base bodies, hairstyles, humanoid rig | GLTF, FBX | CC0 |
| Universal Animation Library | locomotion/combat/general humanoid animation library | GLB | CC0 |
| Universal Animation Library 2 | expanded locomotion/combat/activity animation library | GLB | CC0 |
| Fantasy Props MegaKit | medieval/fantasy props, furniture, tools, containers, weapons | GLTF | CC0 |
| Stylized Nature MegaKit | trees, plants, flowers, rocks, grass and stylized environments | GLTF | CC0 |
| Easy Enemy Pack | Frog, Rat, Snake, Snake Angry, Spider and Wasp animated enemies | FBX | CC0 |

The supplied Standard archives were inspected directly. The Standard Quaternius license files declare CC0 for all packs that contain license text. The older Easy Enemy ZIP has no embedded license text, but the official Quaternius pack page identifies the pack as CC0.

### Observed source inventory

- Universal Base Characters: 18 GLTF, 18 BIN, 26 FBX and texture files.
- Universal Animation Library 2: 3 GLB and FBX equivalents.
- Fantasy Props MegaKit: 94 GLTF, 94 BIN, 94 FBX, 94 OBJ plus textures.
- Easy Enemy Pack: 6 FBX models plus OBJ/Blend sources and shared texture.
- Stylized Nature MegaKit Standard: 68 GLTF, 68 BIN, 136 FBX, 68 OBJ plus textures.
- Universal Animation Library: 2 GLB and FBX equivalents.

## Secondary library — KayKit

The previously approved KayKit packs remain compatible:
- Forest Nature Pack;
- Resource Bits;
- RPG Tools Bits;
- Fantasy Weapons Bits;
- Medieval Hexagon Pack;
- Skeletons;
- Character Animations;
- Adventurers.

KayKit is retained for utility/prototype content but is no longer the primary visual reference.

## Pipeline policy

For duplicate model exports, prefer:

1. GLB
2. GLTF + dependencies
3. FBX
4. OBJ source fallback

Every imported asset keeps:
- source pack/archive;
- author/license;
- category;
- stable SHA-256 id;
- dependencies;
- animations;
- generated thumbnail.

See `docs/ZIP_IMPORTER.md`.
