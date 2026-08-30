# Asset System — Etapa 2

A Etapa 2 transforma o editor em uma biblioteca de conteúdo reutilizável para assets 3D.

## Formatos suportados

### GLB
Selecione ou arraste um ou vários arquivos `.glb`. Cada GLB é tratado como um asset independente.

### GLTF com arquivos externos
Selecione o `.gltf` junto com todos os arquivos referenciados por ele, normalmente `.bin` e texturas `.png/.jpg/.webp`.

O importador lê `buffers[].uri` e `images[].uri` do GLTF, valida se todos os arquivos necessários foram fornecidos e mostra uma mensagem específica caso algo esteja ausente.

## Persistência local

Assets importados são armazenados em IndexedDB no navegador. Isso permite recarregar o editor e continuar usando a biblioteca sem importar novamente.

O identificador do asset usa SHA-256 do arquivo principal no formato `user/<sha256>`, preparando a futura sincronização com servidor sem depender do nome do arquivo.

## Asset Browser

O dock inferior do editor oferece:

- importação por botão ou drag-and-drop;
- busca por nome/origem/categoria;
- filtros por categoria;
- thumbnail WebP gerada no navegador;
- preview 3D separado;
- reprodução automática da primeira animação disponível no preview;
- metadata de formato, origem, licença, arquivos e animações;
- exclusão da biblioteca local;
- modo `Colocar no mapa`.

## Colocação no mapa

Ao clicar em `Colocar no mapa`, o editor carrega o modelo e mostra um ghost transparente sobre o plano do mundo.

- mouse move: posiciona o ghost;
- snap atual: 0,5 unidade;
- clique esquerdo: cria uma instância real;
- `Esc`: cancela o modo de colocação.

Transform gizmos, seleção, edição de rotação/escala e persistência das instâncias entram na etapa seguinte.

## KayKit

Os oito packs enviados inicialmente ficam registrados em `officialPacks.ts`. O importador reconhece caminhos/nome KayKit e marca a origem/licença como CC0 quando consegue identificar o pack.

Prioridade de runtime:

1. GLB para personagens e arquivos autocontidos;
2. GLTF + BIN + texturas para cenários/props;
3. FBX/OBJ permanecem como formatos-fonte e não são carregados diretamente no navegador nesta etapa.
