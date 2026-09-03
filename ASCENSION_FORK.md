# Ascension Foundation

Ascension uses World of ClaudeCraft as its complete technical foundation.

## Upstream baseline

- Repository: `levy-street/world-of-claudecraft`
- Version: `0.41.2`
- Commit: `ce662ac6eedcd92768b9eb4f06f158d976f0e939`
- License: MIT

## Product direction

The existing engine, deterministic simulation, browser client, world editor,
server, persistence, networking, combat, inventory, quests, social systems,
tooling, and tests are retained.

Ascension replaces the product identity, characters, animations, models,
textures, audio, maps, interface art, lore, progression, and authored content.
New work must configure or extend an existing upstream system before creating
a parallel replacement.

## Working boundaries

To keep upstream code maintainable while Ascension is being authored:

- Treat existing imported World of ClaudeCraft code and assets as the
  `upstream foundation` until a deliberate replacement is approved.
- Put new Ascension-owned runtime assets under `public/ascension/`.
- Put Ascension-specific integration code under `src/ascension/` when code is
  actually required; do not duplicate an existing upstream subsystem there.
- Keep authored Ascension data separate from generic engine/runtime code.
- Replace upstream identity and content incrementally, with tests between
  steps. Do not mass-rename paths that are still referenced at runtime.
- Keep upstream copyright, license, credits, and third-party notices available
  for every retained upstream component.

The detailed asset layout is documented in
`docs/ascension/CONTENT_LAYOUT.md`. Known product-identity replacement points
are tracked in `docs/ascension/IDENTITY_AUDIT.md`.

## Repository history

The pre-transplant Ascension prototype is preserved on
`archive/ascension-v0.8.0` at
`624cf2d46861c01df4de19d7217697c1163105d2`.

Upstream copyright, license, credits, and third-party notices must remain
available while their corresponding code or assets remain in the project.
