import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function replaceFile(rel, replacements) {
  const abs = path.join(root, rel);
  let text = readFileSync(abs, 'utf8');
  const before = text;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  if (text !== before) writeFileSync(abs, text);
}

const publicDescription =
  'Ascension is a browser-based isometric online RPG with a persistent shared world, character progression, classes, combat, exploration, and multiplayer.';
const officialBody =
  'Ascension is an isometric online RPG currently in active development. This fork preserves the proven World of ClaudeCraft technical foundation while its public identity, art, maps, audio, and game content are replaced progressively.';

replaceFile('index.html', [
  ['World of ClaudeCraft: Classic-Style Web MMO', 'Ascension'],
  ['Embark on an epic adventure in World of ClaudeCraft, a classic-style micro-MMO playable directly in your browser. Join a persistent shared world, level up classes, and defeat enemies!', publicDescription],
  ['worldofclaudecraft.com is the official free browser MMO for the Claudemoon world. Play online with a persistent character, explore solo offline, read the wiki, and follow verified community links from this site.', officialBody],
  ['Official World of ClaudeCraft website', 'Official Ascension game'],
  ['World of Claudecraft', 'Ascension'],
  ['World of ClaudeCraft', 'Ascension'],
  ['apple-mobile-web-app-title\" content=\"ClaudeCraft', 'apple-mobile-web-app-title\" content=\"Ascension'],
]);

replaceFile('editor.html', [['Map Editor - World of ClaudeCraft', 'Ascension - World Editor']]);
replaceFile('src/ui/i18n.catalog/editor.ts', [['Map Editor - World of ClaudeCraft', 'Ascension - World Editor']]);
replaceFile('src/ui/i18n.catalog/shell.ts', [
  ['World of ClaudeCraft: Classic-Style Web MMO', 'Ascension'],
  ['Embark on an epic adventure in World of ClaudeCraft, a classic-style micro-MMO playable directly in your browser. Join a persistent shared world, level up classes, and defeat enemies!', publicDescription],
  ['worldofclaudecraft.com is the official free browser MMO for the Claudemoon world. Play online with a persistent character, explore solo offline, read the wiki, and follow verified community links from this site.', officialBody],
  ['Official World of ClaudeCraft website', 'Official Ascension game'],
  ['World of ClaudeCraft', 'Ascension'],
]);

const localeDir = path.join(root, 'src/ui/i18n.locales');
for (const name of readdirSync(localeDir)) {
  if (!name.endsWith('.ts')) continue;
  replaceFile(path.join('src/ui/i18n.locales', name), [
    ['World of ClaudeCraft', 'Ascension'],
    ['World of Claudecraft', 'Ascension'],
  ]);
}

const manifestPath = path.join(root, 'public/manifest.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.name = 'Ascension';
manifest.short_name = 'Ascension';
manifest.description = 'Ascension is a browser-based isometric online RPG.';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
