# Terrain Material Layer Stack — v0.7.2

O terreno do Ascension usa uma pilha dinâmica de Material Layers. Materiais PBR importados ficam na biblioteca local (IndexedDB); layers são referências configuráveis dentro de cada WorldDocument.

## WorldDocument v4

- até 16 layers por terreno;
- cada layer possui ID estável;
- paint stamps referenciam `layerId`, nunca índice;
- mapas v1/v2/v3 são migrados automaticamente;
- reordenar layers não retargeta pintura existente.

Uma layer guarda nome, material, fallback/tint, tiling, rotação, opacidade, visibilidade, lock, solo, fill e metadados de normal/roughness.

## Painting

A pintura é avaliada como máscaras independentes por layer e depois composta na ordem da stack. `LMB` pinta a layer ativa; `Shift+LMB` adiciona um stroke de erase apenas nessa layer. Isso revela máscaras inferiores sem apagar strokes de outras layers.

## Material Library

ZIPs de material continuam reconhecendo Color/Albedo, Normal GL, Roughness, AO e Height. A biblioteca permite vários ZIPs e o mesmo material pode ser reutilizado por várias layers sem duplicar seus blobs.

O renderer 7.2 usa um `DataArrayTexture` WebGL2 para Albedo e quatro atributos `vec4` de pesos, suportando 16 layers sem criar `uTex0..uTex15`. Normal/Roughness/AO/Height permanecem preservados e os multiplicadores da layer já fazem parte do documento para evolução PBR posterior.

## Operações de layer

- adicionar;
- selecionar para pintura;
- drag-and-drop para reordenar;
- renomear;
- ocultar/mostrar;
- lock;
- solo;
- duplicar;
- substituir material sem perder máscara;
- Fill;
- Clear;
- Show Mask;
- excluir layer + seus próprios strokes.
