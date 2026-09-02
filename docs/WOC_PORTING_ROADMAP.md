# World of Claudecraft Porting Roadmap

This roadmap tracks the selective port of systems from
`levy-street/world-of-claudecraft` into Ascension Isometric. The reference
baseline is World of Claudecraft v0.41.2 at commit
`ce662ac6eedcd92768b9eb4f06f158d976f0e939`.

World of Claudecraft is MIT licensed. Systems are adapted to Ascension's
browser-first TypeScript and Three.js architecture instead of copying its
branding, hosted services, economy, or bundled game content.

## Porting rules

- Keep one serializable `WorldDocument` shared by game and editor.
- Keep reusable state and math independent from Three.js and the DOM.
- Port one bounded subsystem per pull request with tests and production build.
- Preserve stable IDs and migrate older Ascension documents on load.
- Apply storage and runtime limits while editing, before saved data can be
  silently truncated by validation.
- Treat multiplayer combat, inventory, quests, and economy as
  server-authoritative when their network layer is introduced.

## Delivery sequence

| Phase | Scope | Status |
| --- | --- | --- |
| 8.0 | Safe edit capacities for terrain, entities, blockers, region paste, duplication, and scatter | In progress |
| 8.1 | Pure undo history and generation-aware save lifecycle | Planned |
| 8.2 | Per-map recovery drafts and explicit dirty/saved state | Planned |
| 8.3 | Modular editor tools, placement transforms, stamping, and procedural authoring | Planned |
| 9 | Typed world entities for players, NPCs, monsters, resources, portals, and interactables | Planned |
| 10 | Deterministic simulation core with fixed ticks and seeded randomness | Planned |
| 11 | Inventory, equipment, loot, progression, classes, abilities, and combat | Planned |
| 12 | Quests, dialogue, vendors, professions, parties, guilds, chat, and mail | Planned |
| 13 | Server-authoritative authentication, persistence, interest management, and world sync | Planned |
| 14 | HUD, maps, accessibility, keyboard, gamepad, touch, audio, VFX, and performance tiers | Planned |
| 15 | Content tools, validation, deployment, moderation, telemetry, and release hardening | Planned |

## Phase 8.0 acceptance criteria

- Live edits and imported documents share the same limits.
- Bulk operations accept the ordered subset that fits and report truncation.
- No save can appear successful and then lose excess edits on its next load.
- Typecheck, unit tests, and production build pass in a clean install.
