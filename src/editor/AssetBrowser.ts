import { AssetDatabase } from '../assets/AssetDatabase';
import { AssetImporter } from '../assets/AssetImporter';
import type { AssetCategory, AssetRecord } from '../assets/types';
import { AssetPreview } from './AssetPreview';
import { ZipImportDialog } from './ZipImportDialog';

const CATEGORIES: Array<{ value: 'all' | AssetCategory; label: string }> = [
  { value: 'all', label: 'Todas as categorias' },
  { value: 'nature', label: 'Natureza' },
  { value: 'buildings', label: 'Construções' },
  { value: 'props', label: 'Objetos' },
  { value: 'resources', label: 'Recursos' },
  { value: 'tools', label: 'Ferramentas' },
  { value: 'characters', label: 'Personagens' },
  { value: 'monsters', label: 'Monstros' },
  { value: 'weapons', label: 'Armas' },
  { value: 'animations', label: 'Animações' },
  { value: 'uncategorized', label: 'Sem categoria' },
];

const WORLD_CATEGORIES = new Set<AssetCategory>(['nature', 'buildings', 'props', 'resources', 'tools', 'uncategorized']);
const CHARACTER_CATEGORIES = new Set<AssetCategory>(['characters', 'monsters', 'weapons', 'animations']);
type AssetScope = 'world' | 'characters' | 'all';
const SCOPE_KEY = 'ascension-editor-asset-scope-v1';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function initialScope(): AssetScope {
  try {
    const value = localStorage.getItem(SCOPE_KEY);
    return value === 'characters' || value === 'all' ? value : 'world';
  } catch { return 'world'; }
}

export interface AssetBrowserOptions {
  root: HTMLElement;
  dropTarget: HTMLElement;
  onPlace(asset: AssetRecord): void;
  onStatus(message: string, tone?: 'normal' | 'success' | 'error'): void;
}

export class AssetBrowser {
  private readonly database = new AssetDatabase();
  private readonly importer = new AssetImporter(this.database);
  private readonly input: HTMLInputElement;
  private readonly zipInput: HTMLInputElement;
  private readonly grid: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly category: HTMLSelectElement;
  private readonly counter: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly preview: AssetPreview;
  private readonly zipDialog: ZipImportDialog;
  private assets: AssetRecord[] = [];
  private selected: AssetRecord | null = null;
  private scope: AssetScope = initialScope();

  constructor(private readonly options: AssetBrowserOptions) {
    options.root.innerHTML = `
      <div class="asset-browser-toolbar">
        <div class="asset-browser-left">
          <button class="editor-button compact asset-dock-toggle" type="button" title="Abrir ou recolher Asset Browser">Assets <span data-asset-collapse-label>Abrir</span></button>
          <strong>Asset Browser</strong>
          <span class="asset-counter">0 assets</span>
          <span class="art-direction-badge">Quaternius primary</span>
          <div class="asset-scope-tabs" role="tablist" aria-label="Escopo dos assets">
            <button type="button" class="asset-scope-button" data-asset-scope="world">World</button>
            <button type="button" class="asset-scope-button" data-asset-scope="characters">Characters</button>
            <button type="button" class="asset-scope-button" data-asset-scope="all">All</button>
          </div>
        </div>
        <div class="asset-browser-filters">
          <input class="asset-search" type="search" placeholder="Buscar assets..." aria-label="Buscar assets">
          <select class="asset-category" aria-label="Filtrar categoria">${CATEGORIES.map((entry) => `<option value="${entry.value}">${entry.label}</option>`).join('')}</select>
          <button class="editor-button asset-import-zip" type="button">Importar ZIP</button>
          <button class="editor-button primary asset-import" type="button">+ Importar modelo</button>
          <input class="asset-file-input" type="file" multiple accept=".glb,.gltf,.fbx,.bin,.png,.jpg,.jpeg,.webp,.tga,.bmp" hidden>
          <input class="asset-zip-input" type="file" accept=".zip,application/zip" hidden>
        </div>
      </div>
      <div class="asset-browser-body">
        <div class="asset-grid" aria-live="polite"></div>
        <aside class="asset-detail"><div class="asset-preview-wrap"><canvas class="asset-preview"></canvas></div><div class="asset-detail-content"><p class="asset-empty">Selecione um asset para visualizar.</p></div></aside>
      </div>
      <div class="asset-drop-overlay"><strong>Solte assets ou um pacote ZIP aqui</strong><span>ZIP · GLB · GLTF + BIN/texturas · FBX + texturas</span></div>`;

    this.input = this.required<HTMLInputElement>('.asset-file-input');
    this.zipInput = this.required<HTMLInputElement>('.asset-zip-input');
    this.grid = this.required<HTMLElement>('.asset-grid');
    this.search = this.required<HTMLInputElement>('.asset-search');
    this.category = this.required<HTMLSelectElement>('.asset-category');
    this.counter = this.required<HTMLElement>('.asset-counter');
    this.detail = this.required<HTMLElement>('.asset-detail-content');
    this.preview = new AssetPreview(this.required<HTMLCanvasElement>('.asset-preview'));
    this.zipDialog = new ZipImportDialog({ importer: this.importer, onStatus: options.onStatus, onImported: async (assets) => { await this.refresh(assets[0]?.id); } });

    this.required<HTMLButtonElement>('.asset-import').addEventListener('click', this.openPicker);
    this.required<HTMLButtonElement>('.asset-import-zip').addEventListener('click', this.openZipPicker);
    this.required<HTMLButtonElement>('.asset-dock-toggle').addEventListener('click', () => this.options.root.dispatchEvent(new CustomEvent('asset-dock-toggle')));
    this.options.root.querySelectorAll<HTMLButtonElement>('[data-asset-scope]').forEach((button) => button.addEventListener('click', () => {
      const scope = button.dataset.assetScope;
      this.scope = scope === 'characters' || scope === 'all' ? scope : 'world';
      try { localStorage.setItem(SCOPE_KEY, this.scope); } catch { /* best effort */ }
      this.render();
    }));
    this.input.addEventListener('change', this.handleInput);
    this.zipInput.addEventListener('change', this.handleZipInput);
    this.search.addEventListener('input', this.render);
    this.category.addEventListener('change', this.render);
    options.dropTarget.addEventListener('dragenter', this.handleDragEnter);
    options.dropTarget.addEventListener('dragover', this.handleDragOver);
    options.dropTarget.addEventListener('dragleave', this.handleDragLeave);
    options.dropTarget.addEventListener('drop', this.handleDrop);
  }

  async initialize(): Promise<void> { await this.refresh(); }

  dispose(): void {
    this.preview.dispose(); this.zipDialog.dispose();
    this.options.dropTarget.removeEventListener('dragenter', this.handleDragEnter);
    this.options.dropTarget.removeEventListener('dragover', this.handleDragOver);
    this.options.dropTarget.removeEventListener('dragleave', this.handleDragLeave);
    this.options.dropTarget.removeEventListener('drop', this.handleDrop);
  }

  private async refresh(preferredId?: string): Promise<void> {
    this.assets = await this.database.list();
    this.counter.textContent = `${this.assets.length} asset${this.assets.length === 1 ? '' : 's'}`;
    this.render();
    const preferred = preferredId ? this.assets.find((asset) => asset.id === preferredId) : undefined;
    if (preferred) await this.select(preferred);
    else if (this.selected) {
      const fresh = this.assets.find((asset) => asset.id === this.selected?.id);
      if (fresh) await this.select(fresh); else this.clearSelection();
    }
  }

  private render = (): void => {
    const query = this.search.value.trim().toLowerCase();
    const category = this.category.value;
    this.options.root.querySelectorAll<HTMLElement>('[data-asset-scope]').forEach((button) => button.classList.toggle('active', button.dataset.assetScope === this.scope));
    const filtered = this.assets.filter((asset) => {
      const matchesText = !query || `${asset.name} ${asset.source} ${asset.category} ${asset.sourceArchive ?? ''}`.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || asset.category === category;
      const matchesScope = this.scope === 'all' || (this.scope === 'world' ? WORLD_CATEGORIES.has(asset.category) : CHARACTER_CATEGORIES.has(asset.category));
      return matchesText && matchesCategory && matchesScope;
    });

    if (filtered.length === 0) {
      this.grid.innerHTML = `<div class="asset-grid-empty"><strong>Nenhum asset encontrado neste escopo.</strong><span>Troque World / Characters / All ou ajuste busca e categoria.</span></div>`;
      return;
    }
    this.grid.innerHTML = '';
    for (const asset of filtered) {
      const card = document.createElement('button'); card.type = 'button'; card.className = `asset-card${this.selected?.id === asset.id ? ' selected' : ''}`;
      card.innerHTML = `<img src="${asset.thumbnail}" alt="Preview de ${escapeHtml(asset.name)}"><span class="asset-card-name">${escapeHtml(asset.name)}</span><span class="asset-card-meta">${asset.category} · ${asset.format.toUpperCase()}</span>`;
      card.addEventListener('click', () => void this.select(asset)); card.addEventListener('dblclick', () => this.options.onPlace(asset)); this.grid.append(card);
    }
  };

  private async select(asset: AssetRecord): Promise<void> {
    this.selected = asset; this.render();
    const animationText = asset.animations.slice(0, 4).map(escapeHtml).join(' · ');
    this.detail.innerHTML = `<div class="asset-detail-title"><strong>${escapeHtml(asset.name)}</strong><span>${asset.format.toUpperCase()}</span></div><dl class="asset-metadata"><div><dt>Categoria</dt><dd>${asset.category}</dd></div><div><dt>Origem</dt><dd>${escapeHtml(asset.source)}</dd></div><div><dt>Licença</dt><dd>${escapeHtml(asset.license)}</dd></div><div><dt>Pacote</dt><dd>${escapeHtml(asset.sourceArchive ?? 'Importação avulsa')}</dd></div><div><dt>Arquivos</dt><dd>${asset.files.length}</dd></div><div><dt>Animações</dt><dd>${asset.animations.length}</dd></div></dl>${asset.animations.length > 0 ? `<p class="asset-animation-list">${animationText}${asset.animations.length > 4 ? '…' : ''}</p>` : ''}<div class="asset-detail-actions"><button class="editor-button primary asset-place" type="button">Colocar no mapa</button><button class="editor-button danger asset-delete" type="button">Excluir</button></div>`;
    this.detail.querySelector<HTMLButtonElement>('.asset-place')?.addEventListener('click', () => this.options.onPlace(asset));
    this.detail.querySelector<HTMLButtonElement>('.asset-delete')?.addEventListener('click', () => void this.deleteSelected());
    try { await this.preview.show(asset); } catch (error) { this.options.onStatus(`Falha no preview de ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  }

  private clearSelection(): void { this.selected = null; this.preview.clear(); this.detail.innerHTML = '<p class="asset-empty">Selecione um asset para visualizar.</p>'; this.render(); }

  private async importLoose(files: File[]): Promise<void> {
    if (files.length === 0) return; this.options.onStatus(`Importando ${files.length} arquivo(s)...`);
    const result = await this.importer.importFiles(files);
    if (result.imported.length > 0) { await this.refresh(result.imported[0]?.id); this.options.onStatus(`${result.imported.length} asset(s) importado(s) e salvo(s) no navegador.`, 'success'); }
    if (result.failures.length > 0) this.options.onStatus(result.failures.map((failure) => `${failure.file}: ${failure.reason}`).join(' | '), 'error');
  }

  private async handleFiles(files: File[]): Promise<void> {
    const zipFiles = files.filter((file) => /\.zip$/i.test(file.name)); const looseFiles = files.filter((file) => !/\.zip$/i.test(file.name));
    if (looseFiles.length > 0) await this.importLoose(looseFiles); if (zipFiles.length > 0) await this.zipDialog.open(zipFiles[0]!);
    if (zipFiles.length > 1) this.options.onStatus('Abra um ZIP por vez para revisar e selecionar os modelos antes da importação.');
  }

  private async deleteSelected(): Promise<void> {
    if (!this.selected) return; const asset = this.selected; if (!window.confirm(`Excluir ${asset.name} da biblioteca local?`)) return;
    await this.database.delete(asset.id); this.clearSelection(); await this.refresh(); this.options.onStatus(`${asset.name} removido da biblioteca local.`);
  }

  private openPicker = (): void => this.input.click();
  private openZipPicker = (): void => this.zipInput.click();
  private handleInput = (): void => { const files = this.input.files; if (files) void this.handleFiles([...files]); this.input.value = ''; };
  private handleZipInput = (): void => { const file = this.zipInput.files?.[0]; if (file) void this.zipDialog.open(file); this.zipInput.value = ''; };
  private handleDragEnter = (event: DragEvent): void => { event.preventDefault(); this.options.root.classList.add('drag-active'); };
  private handleDragOver = (event: DragEvent): void => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; this.options.root.classList.add('drag-active'); };
  private handleDragLeave = (event: DragEvent): void => { if (event.relatedTarget && this.options.dropTarget.contains(event.relatedTarget as Node)) return; this.options.root.classList.remove('drag-active'); };
  private handleDrop = (event: DragEvent): void => { event.preventDefault(); this.options.root.classList.remove('drag-active'); if (event.dataTransfer?.files) void this.handleFiles([...event.dataTransfer.files]); };
  private required<T extends Element>(selector: string): T { const element = this.options.root.querySelector<T>(selector); if (!element) throw new Error(`Asset Browser element not found: ${selector}`); return element; }
}
