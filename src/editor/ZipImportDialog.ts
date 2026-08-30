import { AssetImporter } from '../assets/AssetImporter';
import type { AssetRecord } from '../assets/types';
import { scanAssetZip, type ZipAssetCandidate, type ZipScanResult } from '../assets/ZipAssetScanner';
import { AssetPreview } from './AssetPreview';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function candidatePreviewRecord(candidate: ZipAssetCandidate): AssetRecord {
  return {
    ...candidate.draft,
    id: `preview/${candidate.id}`,
    thumbnail: '',
    animations: [],
    createdAt: 0,
  };
}

export interface ZipImportDialogOptions {
  importer: AssetImporter;
  onImported(assets: AssetRecord[]): Promise<void> | void;
  onStatus(message: string, tone?: 'normal' | 'success' | 'error'): void;
}

export class ZipImportDialog {
  private readonly element = document.createElement('section');
  private readonly list: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly selectedCounter: HTMLElement;
  private readonly archiveSummary: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly importSelectedButton: HTMLButtonElement;
  private readonly preview: AssetPreview;
  private scan: ZipScanResult | null = null;
  private selectedIds = new Set<string>();
  private activeCandidate: ZipAssetCandidate | null = null;
  private busy = false;

  constructor(private readonly options: ZipImportDialogOptions) {
    this.element.className = 'zip-import-modal';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `
      <div class="zip-import-backdrop"></div>
      <div class="zip-import-window" role="dialog" aria-modal="true" aria-label="Importador de pacote ZIP">
        <header class="zip-import-header">
          <div>
            <span class="zip-import-eyebrow">Asset Package Inspector</span>
            <h2>Importar pacote ZIP</h2>
            <p class="zip-archive-summary">Selecione um ZIP para analisar.</p>
          </div>
          <button class="zip-close" type="button" aria-label="Fechar">×</button>
        </header>
        <div class="zip-import-toolbar">
          <input class="zip-search" type="search" placeholder="Buscar modelos no pacote..." aria-label="Buscar modelos">
          <span class="zip-selected-counter">0 selecionados</span>
          <button class="editor-button zip-select-all" type="button">Selecionar tudo</button>
          <button class="editor-button zip-select-none" type="button">Limpar seleção</button>
        </div>
        <div class="zip-import-body">
          <section class="zip-model-pane">
            <div class="zip-model-list"></div>
          </section>
          <aside class="zip-preview-pane">
            <div class="zip-preview-wrap"><canvas class="zip-preview"></canvas></div>
            <div class="zip-preview-detail"><p class="asset-empty">Clique em um modelo para visualizar.</p></div>
          </aside>
        </div>
        <footer class="zip-import-footer">
          <span class="zip-import-hint">O ZIP só é gravado na biblioteca quando você confirmar a importação.</span>
          <div>
            <button class="editor-button zip-import-all" type="button">Importar tudo</button>
            <button class="editor-button primary zip-import-selected" type="button" disabled>Importar selecionados</button>
          </div>
        </footer>
        <div class="zip-busy"><div class="zip-spinner"></div><strong>Analisando pacote…</strong><span>Extraindo e catalogando modelos no navegador.</span></div>
      </div>`;
    document.body.append(this.element);

    this.list = this.required<HTMLElement>('.zip-model-list');
    this.search = this.required<HTMLInputElement>('.zip-search');
    this.selectedCounter = this.required<HTMLElement>('.zip-selected-counter');
    this.archiveSummary = this.required<HTMLElement>('.zip-archive-summary');
    this.detail = this.required<HTMLElement>('.zip-preview-detail');
    this.importSelectedButton = this.required<HTMLButtonElement>('.zip-import-selected');
    this.preview = new AssetPreview(this.required<HTMLCanvasElement>('.zip-preview'));

    this.required<HTMLButtonElement>('.zip-close').addEventListener('click', () => this.close());
    this.required<HTMLElement>('.zip-import-backdrop').addEventListener('click', () => this.close());
    this.required<HTMLButtonElement>('.zip-select-all').addEventListener('click', () => this.selectAll());
    this.required<HTMLButtonElement>('.zip-select-none').addEventListener('click', () => this.selectNone());
    this.required<HTMLButtonElement>('.zip-import-all').addEventListener('click', () => void this.importCandidates(this.scan?.candidates ?? []));
    this.importSelectedButton.addEventListener('click', () => {
      const chosen = this.scan?.candidates.filter((candidate) => this.selectedIds.has(candidate.id)) ?? [];
      void this.importCandidates(chosen);
    });
    this.search.addEventListener('input', () => this.renderList());
    window.addEventListener('keydown', this.handleKeyDown);
  }

  async open(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.element.classList.add('open', 'busy');
    this.element.setAttribute('aria-hidden', 'false');
    this.archiveSummary.textContent = `Analisando ${file.name}…`;
    this.preview.clear();
    this.detail.innerHTML = '<p class="asset-empty">Preparando catálogo do pacote…</p>';
    this.scan = null;
    this.activeCandidate = null;
    this.selectedIds.clear();
    this.updateSelectionState();

    try {
      const scan = await scanAssetZip(file);
      this.scan = scan;
      this.archiveSummary.textContent =
        `${scan.archiveName} · ${scan.source} · ${scan.license} · ${scan.candidates.length} modelos · ` +
        `${scan.totalFiles} arquivos · ${scan.hiddenDuplicateFormats} formatos duplicados ocultos`;
      this.renderList();
      const first = scan.candidates[0];
      if (first) await this.showCandidate(first);
      else this.detail.innerHTML = '<p class="asset-empty">Nenhum GLB, GLTF ou FBX utilizável foi encontrado neste ZIP.</p>';
      this.options.onStatus(`${scan.candidates.length} modelos encontrados em ${scan.archiveName}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.archiveSummary.textContent = `Falha ao analisar ${file.name}`;
      this.list.innerHTML = `<div class="zip-empty"><strong>Não foi possível abrir o ZIP.</strong><span>${escapeHtml(message)}</span></div>`;
      this.options.onStatus(`Falha ao abrir ZIP: ${message}`, 'error');
    } finally {
      this.busy = false;
      this.element.classList.remove('busy');
      this.updateSelectionState();
    }
  }

  close(): void {
    if (this.busy) return;
    this.element.classList.remove('open');
    this.element.setAttribute('aria-hidden', 'true');
    this.preview.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.preview.dispose();
    this.element.remove();
  }

  private renderList(): void {
    const scan = this.scan;
    if (!scan) return;
    const query = this.search.value.trim().toLowerCase();
    const filtered = scan.candidates.filter((candidate) =>
      !query || `${candidate.draft.name} ${candidate.path} ${candidate.draft.category} ${candidate.draft.format}`
        .toLowerCase()
        .includes(query),
    );

    if (filtered.length === 0) {
      this.list.innerHTML = '<div class="zip-empty"><strong>Nenhum modelo encontrado.</strong><span>Tente outro termo de busca.</span></div>';
      return;
    }

    this.list.innerHTML = '';
    for (const candidate of filtered) {
      const row = document.createElement('div');
      row.className = `zip-model-row${this.activeCandidate?.id === candidate.id ? ' active' : ''}`;
      row.dataset.id = candidate.id;
      row.innerHTML = `
        <label class="zip-check" title="Selecionar para importação">
          <input type="checkbox" ${this.selectedIds.has(candidate.id) ? 'checked' : ''}>
          <span></span>
        </label>
        <button class="zip-model-main" type="button">
          <span class="zip-model-name">${escapeHtml(candidate.draft.name)}</span>
          <span class="zip-model-path">${escapeHtml(candidate.path)}</span>
        </button>
        <span class="zip-format">${candidate.draft.format.toUpperCase()}</span>
        <span class="zip-category">${candidate.draft.category}</span>`;
      row.querySelector<HTMLInputElement>('input')?.addEventListener('change', (event) => {
        const input = event.currentTarget as HTMLInputElement;
        if (input.checked) this.selectedIds.add(candidate.id);
        else this.selectedIds.delete(candidate.id);
        this.updateSelectionState();
      });
      row.querySelector<HTMLButtonElement>('.zip-model-main')?.addEventListener('click', () => void this.showCandidate(candidate));
      this.list.append(row);
    }
  }

  private async showCandidate(candidate: ZipAssetCandidate): Promise<void> {
    this.activeCandidate = candidate;
    this.renderList();
    const draft = candidate.draft;
    this.detail.innerHTML = `
      <div class="zip-detail-title">
        <div><strong>${escapeHtml(draft.name)}</strong><span>${draft.format.toUpperCase()}</span></div>
        <button class="editor-button zip-toggle-current" type="button">${this.selectedIds.has(candidate.id) ? 'Remover seleção' : 'Selecionar'}</button>
      </div>
      <dl class="asset-metadata zip-metadata">
        <div><dt>Categoria</dt><dd>${draft.category}</dd></div>
        <div><dt>Origem</dt><dd>${escapeHtml(draft.source)}</dd></div>
        <div><dt>Licença</dt><dd>${escapeHtml(draft.license)}</dd></div>
        <div><dt>Dependências</dt><dd>${Math.max(0, draft.files.length - 1)}</dd></div>
        <div><dt>Caminho</dt><dd title="${escapeHtml(candidate.path)}">${escapeHtml(candidate.path)}</dd></div>
      </dl>`;
    this.detail.querySelector<HTMLButtonElement>('.zip-toggle-current')?.addEventListener('click', () => {
      if (this.selectedIds.has(candidate.id)) this.selectedIds.delete(candidate.id);
      else this.selectedIds.add(candidate.id);
      this.updateSelectionState();
      void this.showCandidate(candidate);
    });

    try {
      await this.preview.show(candidatePreviewRecord(candidate));
    } catch (error) {
      this.detail.insertAdjacentHTML(
        'beforeend',
        `<p class="zip-preview-error">Preview indisponível: ${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`,
      );
    }
  }

  private selectAll(): void {
    if (!this.scan) return;
    for (const candidate of this.scan.candidates) this.selectedIds.add(candidate.id);
    this.updateSelectionState();
    this.renderList();
  }

  private selectNone(): void {
    this.selectedIds.clear();
    this.updateSelectionState();
    this.renderList();
  }

  private updateSelectionState(): void {
    const count = this.selectedIds.size;
    this.selectedCounter.textContent = `${count} selecionado${count === 1 ? '' : 's'}`;
    this.importSelectedButton.disabled = count === 0 || this.busy;
  }

  private async importCandidates(candidates: readonly ZipAssetCandidate[]): Promise<void> {
    if (this.busy || candidates.length === 0) return;
    this.busy = true;
    this.element.classList.add('importing');
    this.updateSelectionState();
    const imported: AssetRecord[] = [];
    const failures: string[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      this.options.onStatus(`Importando ${index + 1}/${candidates.length}: ${candidate.draft.name}…`);
      this.required<HTMLElement>('.zip-import-hint').textContent =
        `Importando ${index + 1} de ${candidates.length}: ${candidate.draft.name}`;
      try {
        imported.push(await this.options.importer.importDraft(candidate.draft));
      } catch (error) {
        failures.push(`${candidate.draft.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.busy = false;
    this.element.classList.remove('importing');
    this.required<HTMLElement>('.zip-import-hint').textContent =
      failures.length > 0
        ? `${imported.length} importados · ${failures.length} falharam`
        : `${imported.length} asset(s) importado(s) com sucesso.`;
    this.updateSelectionState();

    if (imported.length > 0) {
      await this.options.onImported(imported);
      this.options.onStatus(`${imported.length} asset(s) do ZIP foram adicionados à biblioteca.`, 'success');
    }
    if (failures.length > 0) this.options.onStatus(failures.slice(0, 3).join(' | '), 'error');
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.element.classList.contains('open')) this.close();
  };

  private required<T extends Element>(selector: string): T {
    const element = this.element.querySelector<T>(selector);
    if (!element) throw new Error(`ZIP importer element not found: ${selector}`);
    return element;
  }
}
