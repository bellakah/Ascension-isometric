# Ascension Integration Layer

Use this directory only for Ascension-specific adapters, configuration and
composition that cannot live cleanly in authored content.

It must not become a parallel copy of the World of ClaudeCraft engine. Prefer
configuring or extending existing modules in `src/game`, `src/sim`,
`src/render`, `src/editor` and related foundation areas.

## Asset contract

`assets.ts` is the canonical boundary for URLs that point at Ascension-owned
runtime content under `public/ascension/`. Future consumers should use
`ascensionAssetPath()` or `ascensionAssetUrl()` instead of scattering literal
`/ascension/...` strings through gameplay or editor code.

The module only resolves and validates paths. It deliberately does not replace
Three.js loaders, audio loaders, map loaders or any other foundation system.
Those existing consumers can receive the resolved URL when an asset family is
migrated in a focused follow-up stage.
