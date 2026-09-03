# Ascension Identity Audit

Stage 1 records known World of ClaudeCraft identity surfaces without changing
runtime behavior. Each item below should be replaced in a focused later step,
with legal attribution preserved where required.

## High-priority visible identity

- `README.md` — upstream title, website links, screenshots and product copy.
- `package.json` — package name/description plus Electron `productName`, app
  protocol, update endpoint and related packaging identity.
- Browser/site copy and metadata — titles, descriptions, social metadata and
  links that still present World of ClaudeCraft as the product.
- `public/` branded static media — favicon/app icons, title media, whitepaper,
  promotional pages and other upstream-facing product material.
- Native/mobile/desktop packaging — bundle IDs, schemes, product names, icons,
  deep links and update channels where they identify the upstream product.

## Identity that must not be blindly renamed

The following names may be coupled to APIs, persistence, authentication,
network protocols, environment variables, release infrastructure or tests.
They must be migrated only after their consumers are located and validated:

- URLs and hostnames containing `worldofclaudecraft`.
- Deep-link protocol `worldofclaudecraft://`.
- Package/application identifiers.
- Environment-variable names and deployment configuration.
- Database/schema values or persistent identifiers.
- Telemetry, OAuth, Discord, email, wallet, store and updater configuration.

## Attribution versus branding

Upstream license, copyright notices, credits and third-party attribution are
not product-branding cleanup targets. They remain while the corresponding
upstream code/assets remain.

Files such as `LICENSE`, attribution code/data, third-party notices and source
history should not be rewritten just to remove the upstream name.

## Replacement order

Recommended order for later stages:

1. Browser-visible Ascension name/title and neutral local development copy.
2. Ascension icons/logo/theme assets.
3. Runtime content assets under `public/ascension/`.
4. Packaging identifiers and deep links after dependency audit.
5. Production hosts, auth providers and update endpoints when Ascension
   infrastructure exists.

This avoids mixing visual rebranding with infrastructure changes.
