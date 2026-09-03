# Ascension Integration Layer

Use this directory only for Ascension-specific adapters, configuration and
composition that cannot live cleanly in authored content.

It must not become a parallel copy of the World of ClaudeCraft engine. Prefer
configuring or extending existing modules in `src/game`, `src/sim`,
`src/render`, `src/editor` and related foundation areas.

Stage 1 intentionally contains no executable integration code here, so the
existing runtime remains unchanged.
