# Etapa 7 — Terrain & World Authoring

A v0.7.0 recentra o projeto no World Editor. A referência de produto é o fluxo de authoring do World of Claudecraft (documento único, ferramentas independentes, brush por stroke, grounding e blockers), adaptado à arquitetura Three.js do Ascension.

## WorldDocument v3

Mapas v1/v2 são migrados automaticamente. O documento agora persiste `terrain`, `water`, `blockers` e propriedades de grounding/collision das entidades.

### Terrain

- resolução configurável (default 64 segmentos);
- `heightStamps`: Raise, Lower, Smooth e Flatten;
- `paintStamps`: blend de quatro layers;
- cada drag completo é uma única entrada de Undo;
- objetos `grounded` são reassentados após sculpt.

## Ferramentas

- Select / Move / Rotate / Scale;
- Raise;
- Lower;
- Smooth;
- Flatten;
- Paint;
- Erase terrain edit;
- Water;
- Spawn;
- Blocker;
- Asset placement.

## Terrain Materials

O editor possui uma biblioteca IndexedDB separada para materiais de terreno. O botão **Importar ZIP** reconhece conjuntos PBR comuns por nome de arquivo:

- color / albedo / diffuse;
- normal_gl (preferido) ou normal;
- roughness;
- ambient_occlusion / AO;
- height / displacement.

Exemplo suportado diretamente: `grass_01_1k.zip`, contendo `grass_01_color_1k.png`, `grass_01_normal_gl_1k.png`, `grass_01_roughness_1k.png`, `grass_01_ambient_occlusion_1k.png` e `grass_01_height_1k.png`.

Na v0.7, o blend visual usa o color/albedo map no shader de terrain e preserva os demais mapas PBR no banco para evolução do shader sem exigir reimportação.

## Grounding

Cada entidade possui:

- `grounded`;
- `groundOffset`;
- botão **Snap to Ground** no Inspector.

Props groundeds acompanham o heightfield quando o terreno é esculpido.

## Collision

Cada entidade possui `none`, `auto` ou `radius`. O editor possui layer **Collision Debug** para visualizar footprints e blocker walls. Blockers são segmentos invisíveis no jogo.

O Playtest usa o mesmo WorldDocument: o jogador acompanha a altura do terrain, respeita limites do mapa, footprints de props e blocker segments.

## Água e spawn

Água é map-wide nesta etapa (enabled, level, color, opacity). O spawn é colocado visualmente clicando no terreno; o runtime recalcula sua altura pela superfície.
