import { readFileSync, writeFileSync } from 'node:fs';

function replaceRequired(path, from, to) {
  const before = readFileSync(path, 'utf8');
  if (!before.includes(from)) throw new Error(`${path}: expected branding text not found: ${from}`);
  const after = before.split(from).join(to);
  writeFileSync(path, after);
  return (before.length - before.split(from).join('').length) / from.length;
}

// Public HTML shells: only public product-name/description strings. Keep upstream
// URLs and visual files as documented fallbacks until Ascension owns approved
// domain/logo assets.
for (const path of ['index.html', 'play.html']) {
  replaceRequired(path, 'content="ClaudeCraft"', 'content="Ascension"');
  replaceRequired(path, 'World of ClaudeCraft: Classic-Style Web MMO', 'Ascension: Isometric Browser RPG');
  replaceRequired(path, 'World of ClaudeCraft', 'Ascension');
  replaceRequired(path, 'World of Claudecraft', 'Ascension');
}

// Runtime English catalog. This is deliberately scoped to the player-facing
// shell catalog; technical ids, storage keys, protocol names and package ids are
// not touched.
replaceRequired('src/ui/i18n.catalog/shell.ts', 'World of ClaudeCraft', 'Ascension');
replaceRequired('src/ui/i18n.catalog/shell.ts', 'World of Claudecraft', 'Ascension');
replaceRequired('src/ui/i18n.catalog/shell.ts', 'ClaudeCraft', 'Ascension');
replaceRequired(
  'src/ui/i18n.catalog/shell.ts',
  'worldofclaudecraft.com is the official free browser MMO for the Claudemoon world. Play online with a persistent character, explore solo offline, read the wiki, and follow verified community links from this site.',
  'Ascension is an isometric multiplayer RPG built on the World of ClaudeCraft technical foundation. Official Ascension web and community links will be published here when approved.',
);

replaceRequired('src/ui/i18n.catalog/editor.ts', "docTitle: 'Map Editor - World of ClaudeCraft'", "docTitle: 'Map Editor - Ascension'");

console.log('Ascension identity stage 1 transformations applied.');
