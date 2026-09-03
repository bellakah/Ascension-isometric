# Ascension Foundation

Ascension uses World of Claudecraft as its complete technical foundation.

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

## Identity transition

Public product identity is migrated independently from upstream compatibility
identifiers. Player-facing titles, application metadata, PWA labels, and other
public product-name strings may use `Ascension`, while technical identifiers
remain unchanged until a dedicated compatibility migration proves they can move
safely.

The following upstream identifiers are intentionally retained for now where they
are part of runtime compatibility or persisted state: package/application ids,
protocol names, local/session storage keys such as the `woc_*` editor/session
keys, updater/release channels, API/database identifiers, asset ids, class ids,
and other internal wire or persistence keys.

No final Ascension logo or icon set has been approved yet. Existing World of
ClaudeCraft favicons, PWA icons, loading/promotional imagery, and other upstream
visual assets therefore remain as functional fallbacks until approved Ascension
replacements are supplied. Keeping those assets does not transfer or remove the
upstream copyright, license, credit, or third-party notice obligations.

## Repository history

The pre-transplant Ascension prototype is preserved on
`archive/ascension-v0.8.0` at
`624cf2d46861c01df4de19d7217697c1163105d2`.

Upstream copyright, license, credits, and third-party notices must remain
available while their corresponding code or assets remain in the project.
