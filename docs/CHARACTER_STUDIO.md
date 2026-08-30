# Etapa 5 — Character Studio

## Pacotes oficiais

A direção de personagem usa quatro pacotes Quaternius CC0:

- Universal Base Characters;
- Modular Character Outfits - Fantasy;
- Universal Animation Library;
- Universal Animation Library 2.

A inspeção dos arquivos Standard confirma que Base Characters, outfits e as duas bibliotecas compartilham o mesmo rig de 65 joints (`root`, `pelvis`, `spine_01`, `Head`, membros e mãos).

O pack de outfits informa explicitamente que foi criado para o Universal Base Character. Ao vestir roupas, a recomendação do autor é manter apenas a cabeça do base character para evitar clipping e geometria invisível desnecessária.

## CharacterPreset

Presets são persistidos em IndexedDB e guardam:

- base character;
- gênero;
- modo `full` ou `head-only`;
- cabelo;
- outfit completo ou peças modulares;
- bibliotecas de animação;
- clips Idle / Walk / Run.

Um preset pode ser marcado como personagem ativo. O runtime do jogo lê esse mesmo preset no playtest e no jogo normal.

## Character Studio

O botão **Personagem** abre o Character Studio.

Fluxo recomendado:

1. importar os quatro ZIPs pelo Asset Browser;
2. escolher `Superhero_Male_FullBody` ou `Superhero_Female_FullBody`;
3. escolher outfit completo ou combinar Body/Arms/Legs/Feet/Headgear/Accessory;
4. usar cabelo da pasta `Rigged to Head Bone`;
5. selecionar UAL1 e/ou UAL2 sem `_RM`;
6. escolher Idle, Walk e Run;
7. salvar e usar no jogo.

UAL1 é a melhor fonte inicial de locomoção porque inclui `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop` e `Sprint_Loop`. UAL2 amplia o catálogo com combate, escudo, farm e outras ações.

## Animação modular

Cada peça rigada possui sua própria instância de skeleton, mas os nomes de bones são idênticos. O CharacterActor cria um AnimationMixer por peça e aplica o mesmo AnimationClip a cada uma. Assim corpo, outfit, partes modulares e cabelo rigado permanecem sincronizados.

O runtime usa as bibliotecas sem root motion. A posição do personagem continua sendo autoritativamente atualizada pelo PlayerController, evitando movimento duplicado.

## Head-only

Quando existe roupa e `baseMode = head-only`, o runtime reduz o mesh principal do base character aos triângulos influenciados por `Head` / `neck_01`, mantendo olhos/sobrancelhas. Isso segue a recomendação do pack de outfits sem exigir reexport manual em Blender.

## Runtime

- WASD: andar;
- Shift: correr;
- Idle / Walk / Run fazem cross-fade;
- fallback para cápsula caso nenhum preset ativo exista;
- assets ausentes geram warning sem derrubar o mapa.

## Próximos passos

- ataques e skills dirigidos por Animation State Machine;
- sockets para armas;
- equipamento trocado em runtime;
- criação de personagem para jogador;
- classes e aparência persistidas no backend;
- hitboxes/colliders do personagem.
