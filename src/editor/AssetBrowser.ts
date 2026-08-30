import { AssetDatabase } from '../assets/AssetDatabase';
import { AssetImporter } from '../assets/AssetImporter';
import type { AssetCategory, AssetRecord } from '../assets/types';
import { AssetPreview } from './AssetPreview';

const CATEGORIES: Array<{ value: 'all' | AssetCategory; label: string }> = [
  { value: 'all', label: 'Todas as categorias' },
  { value: 'characters', label: 'Personagens' },
  { value: 'monsters', label: 'Monstros' },
  { value: 'nature', label: 'Natureza' },
  { value: 'buildings', label: 'Construções' },
  { value: 'weapons', label: 'Armas' },
  { value: 'resources', label: 'Recursos' },
  { value: 'tools', label: 'Ferramentas' },
  { value: 'props', label: 'Objetos' },
  { value: 'uncategorized', label: 'Sem categoria' },
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
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
  private readonly grid: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly category: HTMLSelectElement;
  private readonly counter: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly preview: AssetPreview;
  private assets: AssetRecord[] = [];
  private selected: AssetRecord | null = null;

  constructor(private readonly options: AssetBrowserOptions) {
    options.root.innerHTML = `
      <div class="asset-browser-toolbar">
        <div>
          <strong>Asset Browser</strong>
          <span class="asset-counter">0 assets</span>
        </div>
        <div class="asset-browser-filters">
          <input class="asset-search" type="search" placeholder="Buscar assets..." aria-label="Buscar assets">
          <select class="asset-category" aria-label="Filtrar categoria">
            ${CATEGORIES.map((entry) => `<option value="${entry.value}">${entry.label}</option>`).join('')}
          </select>
          <button class="editor-button primary asset-import" type="button">+ Importar asset</button>
          <input class="asset-file-input" type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp" hidden>
        </div>
      </div>
      <div class="asset-browser-body">
        <div class="asset-grid" aria-live="polite"></div>
        <aside class="asset-detail">
          <div class="asset-preview-wrap"><canvas class="asset-preview"></canvas></div>
          <div class="asset-detail-content"><p class="asset-empty">Selecione um asset para visualizar.</p></div>
        </aside>
      </div>
      <div class="asset-drop-overlay"><strong>Solte os arquivos aqui</strong><span>GLB ou GLTF + BIN + texturas</span></div>`;

    this.input = this.required<HTMLInputElement>('.asset-file-input');
    this.grid = this.required<HTMLElement>('.asset-grid');
    this.search = this.required<HTMLInputElement>('.asset-search');
    this.category = this.required<HTMLSelectElement>('.asset-category');
    this.counter = this.required<HTMLElement>('.asset-counter');
    this.detail = this.required<HTMLElement>('.asset-detail-content');
    this.preview = new AssetPreview(this.required<HTMLCanvasElement>('.asset-preview'));

    this.required<HTMLButtonElement>('.asset-import').addEventListener('click', this.openPicker);
    this.input.addEventListener('change', this.handleInput);
    this.search.addEventListener('input', this.render);
    this.category.addEventListener('change', this.render);
    options.dropTarget.addEventListener('dragenter', this.handleDragEnter);
    options.dropTarget.addEventListener('dragover', this.handleDragOver);
    options.dropTarget.addEventListener('dragleave', this.handleDragLeave);
    options.dropTarget.addEventListener('drop', this.handleDrop);
  }

  async initialize(): Promise<void> {
    await this.refresh();
  }

  dispose(): void {
    this.preview.dispose();
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
      if (fresh) await this.select(fresh);
      else this.clearSelection();
    }
  }

  private render = (): void => {
    const query = this.search.value.trim().toLowerCase();
    const category = this.category.value;
    const filtered = this.assets.filter((asset) => {
      const matchesText = !query || `${asset.name} ${asset.source} ${asset.category}`.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || asset.category === category;
      return matchesText && matchesCategory;
    });

    if (filtered.length === 0) {
      this.grid.innerHTML = `<div class="asset-grid-empty"><strong>Nenhum asset encontrado.</strong><span>Importe um .glb ou selecione .gltf + .bin + texturas juntos.</span></div>`;
      return;
    }

    this.grid.innerHTML = '';
    for (const asset of filtered) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `asset-card${this.selected?.id === asset.id ? ' selected' : ''}`;
      card.innerHTML = `
        <img src="${asset.thumbnail}" alt="Preview de ${escapeHtml(asset.name)}">
        <span class="asset-card-name">${escapeHtml(asset.name)}</span>
        <span class="asset-card-meta">${asset.category} · ${asset.format.toUpperCase()}</span>`;
      card.addEventListener('click', () => void this.select(asset));
      card.addEventListener('dblclick', () => this.options.onPlace(asset));
      this.grid.append(card);
    }
  };

  private async select(asset: AssetRecord): Promise<void> {
    this.selected = asset;
    this.render();
    const animationText = asset.animations.slice(0, 4).map(escapeHtml).join(' · ');
    this.detail.innerHTML = `
      <div class="asset-detail-title"><strong>${escapeHtml(asset.name)}</strong><span>${asset.format.toUpperCase()}</span></div>
      <dl class="asset-metadata">
        <div><dt>Categoria</dt><dd>${asset.category}</dd></div>
        <div><dt>Origem</dt><dd>${escapeHtml(asset.source)}</dd></div>
        <div><dt>Licença</dt><dd>${escapeHtml(asset.license)}</dd></div>
        <div><dt>Arquivos</dt><dd>${asset.files.length}</dd></div>
        <div><dt>Animações</dt><dd>${asset.animations.length}</dd></div>
      </dl>
      ${asset.animations.length > 0 ? `<p class="asset-animation-list">${animationText}${asset.animations.length > 4 ? '…' : ''}</p>` : ''}
      <div class="asset-detail-actions">
        <button class="editor-button primary asset-place" type="button">Colocar no mapa</button>
        <button class="editor-button danger asset-delete" type="button">Excluir</button>
      </div>`;
    this.detail.querySelector<HTMLButtonElement>('.asset-place')?.addEventListener('click', () => this.options.onPlace(asset));
    this.detail.querySelector<HTMLButtonElement>('.asset-delete')?.addEventListener('click', () => void this.deleteSelected());
    try {
      await this.preview.show(asset);
    } catch (error) {
      this.options.onStatus(`Falha no preview de ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private clearSelection(): void {
    this.selected = null;
    this.preview.clear();
    this.detail.innerHTML = '<p class="asset-empty">Selecione um asset para visualizar.</p>';
    this.render();
  }

  private async import(files: FileList | File[]): Promise<void> {
    if (files.length === 0) return;
    this.options.onStatus(`Importando ${files.length} arquivo(s)...`);
    const result = await this.importer.importFiles(files);
    if (result.imported.length > 0) {
      await this.refresh(result.imported[0]?.id);
      this.options.onStatus(`${result.imported.length} asset(s) importado(s) e salvo(s) no navegador.`, 'success');
    }
    if (result.failures.length > 0) {
      const details = result.failures.map((failure) => `${failure.file}: ${failure.reason}`).join(' | ');
      this.options.onStatus(details, 'error');
    }
  }

  private async deleteSelected(): Promise<void> {
    if (!this.selected) return;
    const asset = this.selected;
    if (!window.confirm(`Excluir ${asset.name} da biblioteca local?`)) return;
    await this.database.delete(asset.id);
    this.clearSelection();
    await this.refresh();
    this.options.onStatus(`${asset.name} removido da biblioteca local.`);
  }

  private openPicker = (): void => this.input.click();

  private handleInput = (): void => {
    const files = this.input.files;
    if (files) void this.import(files);
    this.input.value = '';
  };

  private handleDragEnter = (event: DragEvent): void => {
    event.preventDefault();
    this.options.root.classList.add('drag-active');
  };

  private handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.options.root.classList.add('drag-active');
  };

  private handleDragLeave = (event: DragEvent): void => {
    if (event.relatedTarget && this.options.dropTarget.contains(event.relatedTarget as Node)) return;
    this.options.root.classList.remove('drag-active');
  };

  private handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    this.options.root.classList.remove('drag-active');
    if (event.dataTransfer?.files) void this.import(event.dataTransfer.files);
  };

  private required<T extends Element>(selector: string): T {
    const element = this.options.root.querySelector<T>(selector);
    if (!element) throw new Error(`Asset Browser element not found: ${selector}`);
    return element;
  }
}
