import type { AssetCategory } from './types';

const CATEGORY_RULES: Array<[AssetCategory, RegExp]> = [
  ['characters', /(character|knight|mage|ranger|rogue|barbarian|adventurer)/i],
  ['monsters', /(skeleton|monster|enemy|creature)/i],
  ['nature', /(tree|bush|grass|rock|forest|plant|flower|mushroom)/i],
  ['buildings', /(building|house|castle|church|tower|wall|fence|bridge|tavern|barracks|mill)/i],
  ['weapons', /(sword|axe|bow|crossbow|dagger|staff|wand|shield|weapon|arrow)/i],
  ['resources', /(resource|ore|bar|nugget|stone|wood|log|plank|textile|parts)/i],
  ['tools', /(tool|hammer|pickaxe|shovel|hoe|fishing|sickle)/i],
  ['props', /(prop|crate|barrel|mug|book|quiver|cart|bench|table|chair)/i],
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
