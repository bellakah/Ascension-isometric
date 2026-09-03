# Ascension Runtime Content

This is the canonical root for assets authored specifically for Ascension.

The imported World of ClaudeCraft asset tree remains in place while Ascension
content is introduced incrementally. Do not move or delete upstream assets
from this directory structure unless the same change updates every runtime
consumer and passes validation.

Runtime code should reference files through the contract in
`src/ascension/assets.ts`, which resolves URLs under `/ascension/<category>/...`
and validates that callers cannot escape the Ascension namespace.

See `docs/ascension/CONTENT_LAYOUT.md` for category ownership and migration
rules.
