# ZIP Asset Package Inspector

The editor can inspect a source asset pack directly from a `.zip` file without importing the whole archive into the project.

## Workflow

1. Open the editor.
2. Click **Importar ZIP** or drag a `.zip` into the editor.
3. The archive is extracted temporarily in browser memory.
4. The inspector discovers supported models and removes duplicate export formats.
5. The model catalog appears on the left.
6. Click a model to view it in the 3D preview on the right.
7. Mark individual models, use **Selecionar tudo**, or choose **Importar tudo**.
8. Only confirmed models and their required dependencies are saved to IndexedDB.

## Supported package model formats

- GLB
- GLTF + BIN + referenced textures
- FBX + texture files in the package

OBJ files are recognized while scanning, but when GLTF/FBX/GLB variants exist they are intentionally not shown as separate duplicates.

## Duplicate format policy

A source pack often ships the same model as FBX, OBJ and GLTF. The inspector groups models by filename stem and uses the best browser runtime representation:

`GLB > GLTF > FBX`

If several files with the same name exist in the preferred format in different folders, all preferred-format variants remain available. This is important for rigged/origin variants.

## Persistence

ZIP extraction itself is temporary. Imported selections are normalized into the existing Asset System and persisted in IndexedDB with:

- SHA-256 identity;
- source archive;
- source pack;
- author/license;
- category;
- main model file;
- required dependencies;
- generated thumbnail;
- detected animation clips.

This avoids storing hundreds of duplicate source files for every ZIP.
