import type { AssetCategory } from './types';

const CATEGORY_RULES: Array<[AssetCategory, RegExp]> = [
  ['animations', /(animation|animlib|ual1|ual2|mannequin)/i],
  ['characters', /(character|superhero|hairstyle|hair_|eyebrow|knight|mage|ranger|rogue|barbarian|adventurer)/i],
  ['monsters', /(skeleton|monster|enemy|creature|frog|rat|snake|spider|wasp)/i],
  ['nature', /(nature|tree|bush|grass|rock|pebble|forest|plant|flower|mushroom|fern|clover)/i],
  ['buildings', /(building|house|castle|church|tower|wall|fence|bridge|tavern|barracks|mill)/i],
  ['weapons', /(sword|axe|bow|crossbow|dagger|staff|wand|shield|weapon|arrow)/i],
  ['resources', /(resource|ore|bar|nugget|stone|wood|log|plank|textile|parts)/i],
  ['tools', /(tool|hammer|pickaxe|shovel|hoe|fishing|sickle)/i],
  ['props', /(prop|anvil|bag|banner|bed|book|bottle|bucket|crate|barrel|mug|quiver|cart|bench|table|chair|cauldron|chest|potion)/i],
];

export function inferAssetCategory(value: string): AssetCategory {
  return CATEGORY_RULES.find(([, rule]) => rule.test(value))?.[0] ?? 'uncategorized';
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

export function normalizedFileKey(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1]?.toLowerCase() ?? normalized.toLowerCase();
}

export function assetFileAliases(value: string): string[] {
  const key = normalizedFileKey(value);
  const aliases = new Set<string>([key]);
  const duplicatedExtension = key.match(/^(.*)_(png|jpg|jpeg|webp)\.(png|jpg|jpeg|webp)$/i);
  if (duplicatedExtension && duplicatedExtension[2]?.toLowerCase() === duplicatedExtension[3]?.toLowerCase()) {
    aliases.add(`${duplicatedExtension[1]}.${duplicatedExtension[3].toLowerCase()}`);
  } else {
    const normalExtension = key.match(/^(.*)\.(png|jpg|jpeg|webp)$/i);
    if (normalExtension) aliases.add(`${normalExtension[1]}_${normalExtension[2].toLowerCase()}.${normalExtension[2].toLowerCase()}`);
  }
  return [...aliases];
}

export function normalizeArchivePath(value: string): string {
  const input = value.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const part of input.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

export function archiveDirname(value: string): string {
  const normalized = normalizeArchivePath(value);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

export function resolveArchiveDependency(entryPath: string, uri: string): string {
  const cleanUri = decodeURIComponent(uri.split('?')[0] ?? uri);
  const base = archiveDirname(entryPath);
  return normalizeArchivePath(base ? `${base}/${cleanUri}` : cleanUri);
}

export function collectExternalGltfUris(gltfText: string): string[] {
  const json = JSON.parse(gltfText) as {
    buffers?: Array<{ uri?: string }>;
    images?: Array<{ uri?: string }>;
  };
  const uris = [
    ...(json.buffers ?? []).map((entry) => entry.uri),
    ...(json.images ?? []).map((entry) => entry.uri),
  ];

  return [...new Set(uris.filter((uri): uri is string => Boolean(uri) && !uri!.startsWith('data:')))];
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
