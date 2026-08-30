# World Editor — Etapa 3

A Etapa 3 transforma os assets importados em entidades editáveis de um mapa persistente.

## WorldDocument

O editor usa `src/world/WorldDocument.ts` como fonte de verdade serializável. Cada entidade guarda:

- `id` estável;
- nome editável;
- `assetId` e nome do asset de origem;
- posição XYZ;
- rotação XYZ em radianos;
- escala XYZ;
- visibilidade.

A cena Three.js é uma representação runtime desse documento. Isso evita depender de objetos soltos dentro da scene e prepara save/load, playtest, multiplayer e edição remota.

## Persistência

O mapa atual é salvo automaticamente em `localStorage` usando a chave `ascension-isometric-world-document-v1`.

Também existem ações no topo do editor:

- **Salvar JSON**: exporta o WorldDocument atual;
- **Carregar**: importa e valida um `.json` de mapa.

Se um asset referenciado não existir mais na biblioteca IndexedDB, o editor preserva a entidade no documento e mostra um placeholder vermelho no runtime em vez de apagar dados silenciosamente.

## Seleção

Uma entidade pode ser selecionada de duas maneiras:

1. clique esquerdo diretamente no modelo no viewport;
2. clique na linha correspondente da **Hierarchy**.

A seleção recebe um contorno e o TransformControls é anexado ao root da entidade.

## Gizmos

Atalhos:

- `G`: mover;
- `R`: rotacionar;
- `S`: escalar.

Snaps atuais:

- posição: `0.5` unidade;
- rotação: `15°`;
- escala: `0.1`.

O Inspector também permite digitar valores exatos.

## Hierarchy

O painel esquerdo mostra somente entidades persistentes do WorldDocument. Ele oferece:

- busca por nome/asset;
- seleção;
- duplo clique para focar;
- duplicar;
- focar;
- excluir;
- indicação de visibilidade.

## Inspector

O painel direito permite:

- renomear entidade;
- consultar o asset de origem;
- alterar visibilidade;
- editar posição XYZ;
- editar rotação em graus;
- editar escala XYZ;
- focar, duplicar e excluir.

## Histórico

O editor mantém até 80 snapshots locais do WorldDocument.

- `Ctrl+Z`: desfazer;
- `Ctrl+Y` ou `Ctrl+Shift+Z`: refazer;
- `Ctrl+D`: duplicar selecionado;
- `Delete`: excluir selecionado;
- `F`: focar seleção;
- `Esc`: limpar seleção quando não estiver posicionando um asset.

Transformações feitas pelo gizmo entram no histórico ao finalizar o arraste, evitando criar centenas de snapshots durante um único movimento.

## Asset Browser

A Etapa 2 continua intacta. Ao usar `Colocar no mapa`, a nova instância passa por `WorldEditor.placeAsset()` e entra imediatamente no WorldDocument, Hierarchy, Inspector, autosave e undo/redo.
