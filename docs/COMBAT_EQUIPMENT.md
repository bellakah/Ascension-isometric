# Etapa 6 — Equipment + Combat Animation State Machine

## Objetivo

Transformar o Character Studio em uma base de equipamento e combate reutilizável, sem prender o runtime a uma classe específica.

## CharacterPreset v2

Presets antigos v1 são migrados automaticamente. O v2 adiciona:

- `equipment.mainHand`;
- `equipment.offHand`;
- `equipment.back`;
- bone/socket por item;
- posição, rotação em graus e escala por item;
- perfil de combate;
- clips Attack 1 / Attack 2 / Attack 3 / Block.

Sockets padrão do Universal Rig:

- main hand: `hand_r`;
- off hand: `hand_l`;
- back: `spine_03`.

## Equipment runtime

Armas e escudos continuam sendo assets normais da AssetDatabase. O CharacterActor carrega o asset e o adiciona como filho do bone configurado.

Isso permite corrigir modelos com pivô diferente sem alterar o arquivo original: cada attachment possui seu próprio offset, rotação e escala.

Os slots de roupa da Etapa 5 continuam sendo usados para torso, braços, pernas, pés, headgear e acessórios. Assim o sistema já separa equipamento corporal de itens anexados a sockets.

## Perfis de combate

- unarmed;
- one-handed;
- two-handed;
- bow;
- staff.

O perfil serve como metadado e também direciona os defaults sugeridos pelo Character Studio. Os clips permanecem configuráveis.

## State machine

Estados atuais:

`locomotion -> attack-1 -> attack-2 -> attack-3 -> recover -> locomotion`

`locomotion <-> block`

Um clique durante um ataque enfileira o próximo golpe. A troca para o golpe seguinte acontece na janela de combo (~62% do clip atual). Durante ataque, o movimento é reduzido; bloqueio também reduz a velocidade.

## Controles de playtest

- WASD: mover;
- Shift: correr;
- LMB ou J: atacar / continuar combo;
- RMB ou K: defender;
- mouse wheel: zoom.

## Próximos passos naturais

- hitboxes/hurtboxes e dano real;
- alvo/targeting;
- atributos de itens;
- inventário/equipamento persistente por personagem;
- skills/cooldowns;
- inimigos com combate e aggro;
- servidor autoritativo.
