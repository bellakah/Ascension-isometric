# Asset System

The Ascension editor stores reusable 3D assets independently from world placement data.

## Supported runtime formats

- GLB
- GLTF + BIN + referenced textures
- FBX + external/embedded textures

The loader uses the same Three.js runtime for editor preview and world placement.

## Loose-file import

Use **+ Importar modelo** for individual GLB files, GLTF bundles selected with their dependencies, or FBX files selected with their textures.

## ZIP package import

Use **Importar ZIP** for complete downloaded asset packs.

The ZIP Package Inspector:
- extracts the archive temporarily in memory;
- identifies GLB, GLTF and FBX models;
- resolves GLTF dependency paths inside the archive;
- handles known duplicated image-extension aliases used by some exported GLTF files;
- hides lower-priority FBX/OBJ duplicates when GLB/GLTF exists;
- provides a searchable list on the left;
- provides an interactive 3D viewer on the right;
- supports individual checkbox selection;
- supports Select All, Clear Selection, Import Selected and Import All;
- persists only confirmed models.

See `docs/ZIP_IMPORTER.md`.

## Persistence

Imported assets are stored in IndexedDB using `user/<sha256>` identity. Records preserve:
- source archive;
- official source pack id when recognized;
- author/source;
- license;
- category;
- entry model;
- required supporting files;
- thumbnail;
- animation clip names.

## Preview

The 3D preview supports:
- drag to orbit;
- mouse wheel zoom;
- automatic slow orbit after idle;
- automatic playback of the first detected animation.

## World placement

The existing placement tool loads the same persisted asset record. Models can be placed with a transparent ghost and 0.5-unit snap.

Entity selection, transform gizmos and WorldDocument persistence are the next editor milestone.
