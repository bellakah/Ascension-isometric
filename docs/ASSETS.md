# Initial Asset Library

The following archives were supplied for Ascension Isometric and are the project's first approved asset packs.

All eight archives include a Kay Lousberg `License.txt` declaring **Creative Commons Zero (CC0)**. They may be used, modified and redistributed in personal, educational and commercial projects. Attribution is optional, although crediting **Kay Lousberg — www.kaylousberg.com** is appreciated by the author.

## Approved packs

| Pack | Version | Primary use in Ascension | Browser-friendly source formats |
| --- | --- | --- | --- |
| KayKit Forest Nature Pack | 1.0 | trees, bushes, vegetation, rocks and natural world props | GLTF + BIN |
| KayKit Resource Bits | 1.0 | ores, bars, crafting resources, barrels and gatherable/resource props | GLTF + BIN |
| KayKit RPG Tools Bits | 1.0 | tools, crafting stations and RPG interaction props | GLTF + BIN |
| KayKit Fantasy Weapons Bits | 1.0 | swords, axes, bows, shields and other equipment | GLTF + BIN |
| KayKit Medieval Hexagon Pack | 1.0 | buildings, settlements and medieval world structures | GLTF + BIN |
| KayKit Character Pack: Skeletons | 1.1 | monsters/enemies and skeleton equipment | GLTF + BIN, GLB animations |
| KayKit Character Animations | 1.1 | reusable character movement, combat, ranged, tool and simulation animation sets | GLB |
| KayKit Adventurers Character Pack | 2.0 | player characters, NPCs and class/equipment prototypes | GLTF + BIN, GLB animations |

## Inspection summary

The supplied archives contain multiple export formats for many of the same models. We will **not import every duplicate format into the runtime**.

Our canonical browser pipeline will prioritize:

1. `.glb` when the pack already provides it, especially rigged characters and animation libraries.
2. `.gltf` + `.bin` + referenced textures when GLB is not supplied.
3. `.fbx` and `.obj` only as editor-import/conversion sources when needed later.

This keeps the shipped browser build smaller and avoids maintaining duplicate copies of the same model.

### Supplied archive inventory

| Archive | Approx. ZIP size | Relevant contents observed |
| --- | ---: | --- |
| `KayKit_Forest_Nature_Pack_1.0_FREE.zip` | 6.14 MB | 105 GLTF, 105 BIN, 210 FBX plus OBJ and textures |
| `KayKit_ResourceBits_1.0_FREE.zip` | 8.13 MB | 76 GLTF, 76 BIN, 152 FBX plus OBJ and textures |
| `KayKit_RPGToolsBits_1.0_FREE.zip` | 3.71 MB | 49 GLTF, 49 BIN, 98 FBX plus OBJ and textures |
| `KayKit_FantasyWeaponsBits_1.0_FREE.zip` | 3.22 MB | 31 GLTF, 31 BIN, 62 FBX plus OBJ and textures |
| `KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip` | 33.62 MB | 221 GLTF, 221 BIN, 442 FBX plus OBJ and textures |
| `KayKit_Skeletons_1.1_FREE.zip` | 7.80 MB | character/equipment models plus GLB animation files |
| `KayKit_Character_Animations_1.1.zip` | 14.17 MB | 16 GLB animation libraries plus FBX equivalents |
| `KayKit_Adventurers_2.0_FREE.zip` | 12.42 MB | characters/equipment plus GLB movement/general animations |

## Asset-pipeline policy

The source ZIP archives are treated as **source material**, not as runtime web assets. During the Asset System milestone we will ingest selected models, preserve source/license metadata, generate thumbnails and normalize paths/metadata for the editor.

Expected metadata per imported asset:

- stable asset id;
- source pack and version;
- author/source;
- license;
- canonical runtime file;
- texture dependencies;
- animation clips, when present;
- bounds/default scale;
- collider defaults;
- category and tags;
- thumbnail.

The editor and game must both resolve assets through the same registry rather than hard-coded file paths.
