# Etapa 4 — Multi-map Projects + Real Playtest

## Objetivo

Transformar o editor de um único documento local em um projeto com múltiplos mapas e fazer o jogo consumir o mesmo WorldDocument usado pelo editor.

## Biblioteca de mapas

Os mapas são persistidos em IndexedDB (`ascension-isometric-worlds`). Cada WorldDocument v2 possui:

- `id` estável;
- nome e descrição;
- ponto de nascimento XYZ;
- ambiente (tamanho/cor do chão e cor de fundo);
- entidades;
- datas de criação/atualização.

O gerenciador **Mapas** permite criar, abrir, duplicar e excluir mapas, além de editar as configurações do mapa atual.

Documentos v1 da Etapa 3 são migrados automaticamente para v2.

## Runtime compartilhado

`WorldRuntime` é a camada comum que materializa `WorldEntityDocument` em objetos Three.js usando a mesma `AssetDatabase` do editor. O editor e o jogo deixam de ter implementações separadas para carregar os assets do mundo.

`WorldEnvironment` também é compartilhado. O editor mostra grid; o jogo não.

## Playtest

O botão **Playtest**:

1. força o save do mapa atual;
2. grava um snapshot de sessão;
3. abre `/?playtest=1`;
4. o jogo carrega exatamente esse WorldDocument;
5. o player placeholder nasce no `spawn` definido no mapa.

O runtime normal do jogo também abre o mapa atual salvo na biblioteca caso não haja sessão de playtest.

## Editor limpo

O editor não chama mais `createDemoWorld`. As antigas casas, árvores, pedras e cápsula demonstrativas não fazem parte do mapa editável. O mundo passa a ser composto somente por ambiente base + entidades do WorldDocument.
