import './terrain-layer-stack.css';
import { TerrainMaterialDatabase, type TerrainMaterialRecord } from '../world/TerrainMaterialDatabase';
import type { EditorWorldLayer } from '../world/WorldEnvironment';
import type { TerrainLayerDocument, WorldDocument } from '../world/WorldDocument';
import type { WorldAuthoringTool, WorldEditor } from './WorldEditor';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
function num(value: string, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
const LAYER_LABELS: Record<EditorWorldLayer, string> = { terrain: 'Terrain', objects: 'Objects', water: 'Water', spawn: 'Spawn', collision: 'Collision Debug', grid: 'Grid' };
const TERRAIN_TOOLS: Array<{ tool: WorldAuthoringTool; label: string; icon: string }> = [
  { tool: 'raise', label: 'Raise', icon: '△' }, { tool: 'lower', label: 'Lower', icon: '▽' }, { tool: 'smooth', label: 'Smooth', icon: '≈' },
  { tool: 'flatten', label: 'Flatten', icon: '═' }, { tool: 'paint', label: 'Paint', icon: '●' }, { tool: 'erase', label: 'Erase', icon: '⌫' },
];
const WORLD_TOOLS: Array<{ tool: WorldAuthoringTool; label: string; icon: string }> = [
  { tool: 'water', label: 'Water', icon: '≈' }, { tool: 'spawn', label: 'Spawn', icon: '✦' }, { tool: 'blocker', label: 'Blocker', icon: '▰' },
];

export interface WorldAuthoringPanelRoots { terrain: HTMLElement; world: HTMLElement; layers: HTMLElement; }

export class WorldAuthoringPanel {
  private readonly materials = new TerrainMaterialDatabase();
  private materialRecords: TerrainMaterialRecord[] = [];
  private readonly previewUrls = new Map<string, string>();
  private attachImportedToLayerId: string | null = null;
  private selectedLayerId = '';
  private currentTool: WorldAuthoringTool = 'select';
  private currentDocument: WorldDocument | null = null;

  constructor(private readonly roots: WorldAuthoringPanelRoots, private readonly editor: WorldEditor, private readonly onStatus: (message: string, tone?: 'normal' | 'success' | 'error') => void) {
    Object.values(roots).forEach((root) => root.classList.add('world-authoring-panel'));
  }

  async initialize(): Promise<void> { this.materialRecords = await this.materials.list(); }

  render(tool: WorldAuthoringTool, document: WorldDocument): void {
    this.currentTool = tool; this.currentDocument = document;
    if (!document.terrain.layers.some((layer) => layer.id === this.selectedLayerId)) this.selectedLayerId = this.editor.brushSettings.paintLayerId || document.terrain.layers[0]?.id || '';
    this.renderTerrain(document); this.renderWorld(document); this.renderLayers();
    this.bindTerrain(document); this.bindWorld(document); this.bindLayers();
  }

  dispose(): void {
    for (const url of this.previewUrls.values()) URL.revokeObjectURL(url); this.previewUrls.clear();
    Object.values(this.roots).forEach((root) => { root.innerHTML = ''; });
  }

  private renderTerrain(document: WorldDocument): void {
    const brush = this.editor.brushSettings; const selected = document.terrain.layers.find((layer) => layer.id === this.selectedLayerId) ?? document.terrain.layers[0];
    this.roots.terrain.innerHTML = `
      <div class="panel-heading"><div><strong>Terrain</strong><span>${escapeHtml(this.toolLabel(this.currentTool))}</span></div><span class="terrain-layer-count">${document.terrain.layers.length}/16 layers</span></div>
      <div class="authoring-scroll terrain-professional">
        <section class="authoring-section"><div class="authoring-section-title"><h3>Ferramentas</h3><span>sculpt & paint</span></div><div class="authoring-tool-grid">${TERRAIN_TOOLS.map((entry) => `<button type="button" class="authoring-tool-button${this.currentTool === entry.tool ? ' active' : ''}" data-authoring-tool="${entry.tool}"><b>${entry.icon}</b><span>${entry.label}</span></button>`).join('')}</div></section>
        <section class="authoring-section"><div class="authoring-section-title"><h3>Brush</h3><span>${this.currentTool === 'paint' ? 'Shift+LMB apaga a layer' : '1 stroke = 1 Undo'}</span></div><label class="authoring-field"><span>Radius <b>${brush.radius.toFixed(1)}</b></span><input type="range" min="0.5" max="40" step="0.5" value="${brush.radius}" data-brush-radius></label><label class="authoring-field"><span>Strength <b>${brush.strength.toFixed(1)}</b></span><input type="range" min="0.5" max="30" step="0.5" value="${brush.strength}" data-brush-strength></label><label class="authoring-field"><span>Falloff</span><select data-brush-falloff><option value="smooth"${brush.falloff === 'smooth' ? ' selected' : ''}>Smooth</option><option value="flat"${brush.falloff === 'flat' ? ' selected' : ''}>Hard / Flat</option></select></label></section>
        ${this.layerStack(document)}
        ${selected ? this.selectedLayerPanel(selected) : ''}
        ${this.materialLibrary(document)}
        <input type="file" accept=".zip,application/zip" multiple data-terrain-material-file hidden>
      </div>`;
  }

  private layerStack(document: WorldDocument): string {
    return `<section class="authoring-section terrain-stack-section"><div class="authoring-section-title"><h3>Material Layer Stack</h3><button type="button" class="editor-button compact" data-add-layer>+ Layer</button></div><p class="authoring-hint">Arraste pelo ≡ para reordenar. A pintura usa ID permanente: mover uma layer nunca troca suas máscaras.</p><div class="terrain-layer-stack">${document.terrain.layers.map((layer, index) => this.layerRow(layer, index)).join('')}</div></section>`;
  }

  private layerRow(layer: TerrainLayerDocument, index: number): string {
    const record = layer.materialId ? this.materialRecords.find((candidate) => candidate.id === layer.materialId) : undefined;
    const preview = record ? this.previewUrl(record) : '';
    const selected = layer.id === this.selectedLayerId;
    return `<div class="terrain-stack-row${selected ? ' selected' : ''}${layer.locked ? ' locked' : ''}" draggable="true" data-layer-row="${escapeHtml(layer.id)}" data-layer-index="${index}">
      <button type="button" class="stack-handle" title="Arrastar para reordenar">≡</button>
      <button type="button" class="stack-icon-button" data-layer-visible="${escapeHtml(layer.id)}" title="${layer.visible ? 'Ocultar' : 'Mostrar'}">${layer.visible ? '👁' : '◌'}</button>
      <button type="button" class="stack-icon-button" data-layer-lock="${escapeHtml(layer.id)}" title="${layer.locked ? 'Desbloquear' : 'Bloquear'}">${layer.locked ? '🔒' : '🔓'}</button>
      <button type="button" class="stack-icon-button${layer.solo ? ' active' : ''}" data-layer-solo="${escapeHtml(layer.id)}" title="Solo">S</button>
      <button type="button" class="terrain-stack-select" data-select-layer="${escapeHtml(layer.id)}">
        <span class="terrain-material-thumb" style="${preview ? `background-image:url('${preview}')` : `background:${layer.fallbackColor}`}"></span>
        <span class="terrain-stack-copy"><strong>${escapeHtml(layer.name)}</strong><small>${escapeHtml(layer.materialName ?? 'Cor sólida')} · ${this.layerPaintCount(layer.id)} strokes${layer.fill > 0 ? ' · fill' : ''}</small></span>
      </button>
    </div>`;
  }

  private selectedLayerPanel(layer: TerrainLayerDocument): string {
    const maskOn = this.editor.terrainMaskPreviewLayerId === layer.id;
    return `<section class="authoring-section selected-terrain-layer"><div class="authoring-section-title"><h3>Selected Layer</h3><span>${layer.locked ? 'LOCKED' : this.currentTool === 'paint' ? 'PAINT READY' : 'configure'}</span></div>
      <label class="authoring-field"><span>Name</span><input type="text" data-selected-layer-name value="${escapeHtml(layer.name)}"></label>
      <label class="authoring-field"><span>Material</span><select data-selected-layer-material><option value="">Cor sólida</option>${this.materialOptions(layer.materialId)}</select></label>
      <div class="authoring-row"><label class="authoring-field"><span>Fallback</span><input type="color" data-selected-layer-fallback value="${layer.fallbackColor}"></label><label class="authoring-field"><span>Tint</span><input type="color" data-selected-layer-tint value="${layer.tint}"></label></div>
      <div class="authoring-row"><label class="authoring-field"><span>Tiling</span><input type="number" min="0.25" max="100" step="0.25" data-selected-layer-tiling value="${layer.tileScale}"></label><label class="authoring-field"><span>Rotation °</span><input type="number" step="1" data-selected-layer-rotation value="${layer.rotation}"></label></div>
      <label class="authoring-field"><span>Opacity <b>${Math.round(layer.opacity * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" data-selected-layer-opacity value="${layer.opacity}"></label>
      <div class="authoring-row"><label class="authoring-field"><span>Normal Strength</span><input type="number" min="0" max="4" step="0.1" data-selected-layer-normal value="${layer.normalStrength}"></label><label class="authoring-field"><span>Roughness ×</span><input type="number" min="0" max="4" step="0.1" data-selected-layer-roughness value="${layer.roughnessMultiplier}"></label></div>
      <div class="terrain-layer-actions"><button type="button" class="editor-button" data-import-selected-layer>Import ZIP</button><button type="button" class="editor-button" data-fill-layer>Fill</button><button type="button" class="editor-button" data-clear-layer>Clear</button><button type="button" class="editor-button${maskOn ? ' active' : ''}" data-mask-layer>${maskOn ? 'Exit Mask' : 'Show Mask'}</button></div>
      <div class="terrain-layer-actions"><button type="button" class="editor-button" data-duplicate-layer>Duplicate</button><button type="button" class="editor-button danger" data-delete-layer>Delete Layer</button></div>
      <p class="authoring-hint">Normal/Roughness já ficam configurados na layer; o renderer 7.2 usa Albedo no Texture Array e preserva os mapas PBR para a próxima evolução do shader.</p>
    </section>`;
  }

  private materialLibrary(document: WorldDocument): string {
    return `<section class="authoring-section terrain-material-library"><div class="authoring-section-title"><h3>Material Library</h3><button type="button" class="editor-button compact" data-import-library>+ Import ZIPs</button></div><p class="authoring-hint">Importe vários ZIPs. Material é biblioteca; layer é a utilização dele no mapa.</p><div class="terrain-library-grid">${this.materialRecords.length === 0 ? '<p class="panel-empty">Nenhum material importado.</p>' : this.materialRecords.map((record) => {
      const preview = this.previewUrl(record); const used = document.terrain.layers.filter((layer) => layer.materialId === record.id).length;
      return `<article class="terrain-library-card"><span class="terrain-library-thumb" style="background-image:url('${preview}')"></span><div><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(record.sourceArchive)}</small><em>${Object.keys(record.files).join(' · ')}</em></div><button type="button" class="stack-icon-button" data-delete-material="${record.id}" title="Excluir material">⌫</button><span class="material-usage">${used ? `${used} layer${used > 1 ? 's' : ''}` : 'livre'}</span></article>`;
    }).join('')}</div></section>`;
  }

  private renderWorld(document: WorldDocument): void {
    this.roots.world.innerHTML = `<div class="panel-heading"><div><strong>World</strong><span>ambiente e gameplay espacial</span></div></div><div class="authoring-scroll"><section class="authoring-section"><div class="authoring-section-title"><h3>Ferramentas</h3><span>clique para ativar</span></div><div class="authoring-tool-grid world">${WORLD_TOOLS.map((entry) => `<button type="button" class="authoring-tool-button${this.currentTool === entry.tool ? ' active' : ''}" data-authoring-tool="${entry.tool}"><b>${entry.icon}</b><span>${entry.label}</span></button>`).join('')}</div></section>${this.worldOverview(document)}${this.waterPanel(document)}${this.spawnPanel(document)}${this.blockerPanel(document)}</div>`;
  }

  private renderLayers(): void {
    this.roots.layers.innerHTML = `<div class="panel-heading"><div><strong>Layers</strong><span>visibilidade do editor</span></div></div><div class="authoring-scroll">${this.layersPanel()}<section class="authoring-section"><h3>Dica</h3><p class="authoring-hint">Desligue Objects para esculpir sem cenário na frente. Collision Debug mostra footprints e blockers sem afetar o Playtest.</p></section></div>`;
  }

  private worldOverview(document: WorldDocument): string { return `<section class="authoring-section"><h3>Mapa atual</h3><div class="authoring-readout"><span>Tamanho <b>${document.environment.groundSize}</b></span><span>Objetos <b>${document.entities.length}</b></span><span>Blockers <b>${document.blockers.length}</b></span></div><p class="authoring-hint">Nome, tamanho, descrição e exportação continuam em Mapas.</p></section>`; }
  private waterPanel(document: WorldDocument): string { const water = document.water; return `<section class="authoring-section"><h3>Water</h3><label class="authoring-check"><input type="checkbox" data-water-enabled ${water.enabled ? 'checked' : ''}><span>Água habilitada no mapa</span></label><label class="authoring-field"><span>Nível</span><input type="number" step="0.25" data-water-level value="${water.level}"></label><div class="authoring-row"><label class="authoring-field"><span>Cor</span><input type="color" data-water-color value="${water.color}"></label><label class="authoring-field"><span>Opacidade</span><input type="number" min="0.05" max="0.95" step="0.05" data-water-opacity value="${water.opacity}"></label></div><button type="button" class="editor-button" data-authoring-tool="water">Ativar Water Tool</button></section>`; }
  private spawnPanel(document: WorldDocument): string { const spawn = document.spawn; return `<section class="authoring-section"><h3>Player Spawn</h3><div class="authoring-readout"><span>X <b>${spawn.x.toFixed(2)}</b></span><span>Y <b>${spawn.y.toFixed(2)}</b></span><span>Z <b>${spawn.z.toFixed(2)}</b></span></div><p class="authoring-hint">Ative Spawn e clique no terreno para mover o marcador.</p><button type="button" class="editor-button" data-authoring-tool="spawn">Ativar Spawn Tool</button></section>`; }
  private blockerPanel(document: WorldDocument): string { return `<section class="authoring-section"><h3>Invisible Blockers</h3><div class="authoring-stat"><strong>${document.blockers.length}</strong><span>segmentos</span></div><p class="authoring-hint">Ative Blocker e arraste entre dois pontos. O segmento só aparece como debug no editor.</p><button type="button" class="editor-button" data-authoring-tool="blocker">Ativar Blocker Tool</button></section>`; }

  private layersPanel(): string {
    const layers: EditorWorldLayer[] = ['terrain', 'objects', 'water', 'spawn', 'collision', 'grid'];
    return `<section class="authoring-section"><h3>Scene Visibility</h3><div class="authoring-layers">${layers.map((layer) => `<label class="authoring-check"><input type="checkbox" data-world-layer="${layer}" ${this.editor.getLayerVisible(layer) ? 'checked' : ''}><span>${LAYER_LABELS[layer]}</span></label>`).join('')}</div></section>`;
  }

  private bindTerrain(document: WorldDocument): void {
    this.bindToolButtons(this.roots.terrain);
    const radius = this.roots.terrain.querySelector<HTMLInputElement>('[data-brush-radius]'); radius?.addEventListener('input', () => { this.editor.setBrushSettings({ radius: num(radius.value, this.editor.brushSettings.radius) }); this.updateRangeLabel(radius); });
    const strength = this.roots.terrain.querySelector<HTMLInputElement>('[data-brush-strength]'); strength?.addEventListener('input', () => { this.editor.setBrushSettings({ strength: num(strength.value, this.editor.brushSettings.strength) }); this.updateRangeLabel(strength); });
    this.roots.terrain.querySelector<HTMLSelectElement>('[data-brush-falloff]')?.addEventListener('change', (event) => this.editor.setBrushSettings({ falloff: (event.currentTarget as HTMLSelectElement).value === 'flat' ? 'flat' : 'smooth' }));

    this.roots.terrain.querySelector<HTMLElement>('[data-add-layer]')?.addEventListener('click', () => { const id = this.editor.addTerrainLayer(); if (id) { this.selectedLayerId = id; this.editor.setBrushSettings({ paintLayerId: id }); this.render(this.currentTool, document); } });
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-select-layer]').forEach((button) => button.addEventListener('click', () => { const id = button.dataset.selectLayer ?? ''; this.selectedLayerId = id; this.editor.setBrushSettings({ paintLayerId: id }); if (this.currentTool !== 'paint') this.editor.setAuthoringTool('paint'); this.render(this.currentTool, document); }));
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-layer-visible]').forEach((button) => button.addEventListener('click', () => { const layer = document.terrain.layers.find((candidate) => candidate.id === button.dataset.layerVisible); if (layer) this.editor.updateTerrainLayer(layer.id, { visible: !layer.visible }); }));
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-layer-lock]').forEach((button) => button.addEventListener('click', () => { const layer = document.terrain.layers.find((candidate) => candidate.id === button.dataset.layerLock); if (layer) this.editor.updateTerrainLayer(layer.id, { locked: !layer.locked }); }));
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-layer-solo]').forEach((button) => button.addEventListener('click', () => { const layer = document.terrain.layers.find((candidate) => candidate.id === button.dataset.layerSolo); if (layer) this.editor.updateTerrainLayer(layer.id, { solo: !layer.solo }); }));
    this.bindLayerDrag(document);

    const selected = document.terrain.layers.find((layer) => layer.id === this.selectedLayerId);
    if (selected) this.bindSelectedLayer(selected);

    const fileInput = this.roots.terrain.querySelector<HTMLInputElement>('[data-terrain-material-file]');
    this.roots.terrain.querySelector<HTMLElement>('[data-import-library]')?.addEventListener('click', () => { this.attachImportedToLayerId = null; fileInput?.click(); });
    this.roots.terrain.querySelector<HTMLElement>('[data-import-selected-layer]')?.addEventListener('click', () => { this.attachImportedToLayerId = this.selectedLayerId; fileInput?.click(); });
    fileInput?.addEventListener('change', () => { const files = Array.from(fileInput.files ?? []); if (files.length) void this.importMaterials(files, this.attachImportedToLayerId); fileInput.value = ''; });

    this.roots.terrain.querySelectorAll<HTMLElement>('[data-delete-material]').forEach((button) => button.addEventListener('click', () => void this.deleteMaterial(button.dataset.deleteMaterial ?? '', document)));
  }

  private bindSelectedLayer(layer: TerrainLayerDocument): void {
    const root = this.roots.terrain;
    root.querySelector<HTMLInputElement>('[data-selected-layer-name]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { name: (event.currentTarget as HTMLInputElement).value }));
    root.querySelector<HTMLSelectElement>('[data-selected-layer-material]')?.addEventListener('change', (event) => { const value = (event.currentTarget as HTMLSelectElement).value; const record = this.materialRecords.find((candidate) => candidate.id === value); this.editor.setTerrainLayerMaterial(layer.id, record ? { id: record.id, name: record.name } : null); });
    root.querySelector<HTMLInputElement>('[data-selected-layer-fallback]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { fallbackColor: (event.currentTarget as HTMLInputElement).value }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-tint]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { tint: (event.currentTarget as HTMLInputElement).value }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-tiling]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { tileScale: num((event.currentTarget as HTMLInputElement).value, layer.tileScale) }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-rotation]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { rotation: num((event.currentTarget as HTMLInputElement).value, layer.rotation) }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-opacity]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { opacity: num((event.currentTarget as HTMLInputElement).value, layer.opacity) }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-normal]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { normalStrength: num((event.currentTarget as HTMLInputElement).value, layer.normalStrength) }));
    root.querySelector<HTMLInputElement>('[data-selected-layer-roughness]')?.addEventListener('change', (event) => this.editor.updateTerrainLayer(layer.id, { roughnessMultiplier: num((event.currentTarget as HTMLInputElement).value, layer.roughnessMultiplier) }));
    root.querySelector<HTMLElement>('[data-fill-layer]')?.addEventListener('click', () => this.editor.fillTerrainLayer(layer.id));
    root.querySelector<HTMLElement>('[data-clear-layer]')?.addEventListener('click', () => { if (window.confirm(`Limpar toda a pintura de “${layer.name}”?`)) this.editor.clearTerrainLayerPaint(layer.id); });
    root.querySelector<HTMLElement>('[data-mask-layer]')?.addEventListener('click', () => this.editor.setTerrainLayerMaskPreview(this.editor.terrainMaskPreviewLayerId === layer.id ? null : layer.id));
    root.querySelector<HTMLElement>('[data-duplicate-layer]')?.addEventListener('click', () => { const id = this.editor.duplicateTerrainLayer(layer.id); if (id) { this.selectedLayerId = id; this.editor.setBrushSettings({ paintLayerId: id }); } });
    root.querySelector<HTMLElement>('[data-delete-layer]')?.addEventListener('click', () => { if (window.confirm(`Excluir “${layer.name}” e todas as pinceladas ligadas a ela?`)) this.editor.removeTerrainLayer(layer.id); });
  }

  private bindLayerDrag(document: WorldDocument): void {
    let dragged = '';
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-layer-row]').forEach((row) => {
      row.addEventListener('dragstart', (event) => { dragged = row.dataset.layerRow ?? ''; event.dataTransfer?.setData('text/plain', dragged); row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', (event) => { event.preventDefault(); row.classList.remove('drag-over'); const id = dragged || event.dataTransfer?.getData('text/plain') || ''; const target = Number(row.dataset.layerIndex ?? 0); if (id) this.editor.moveTerrainLayer(id, target); });
    });
    void document;
  }

  private bindWorld(document: WorldDocument): void {
    this.bindToolButtons(this.roots.world);
    const commitWater = (): void => {
      const enabled = this.roots.world.querySelector<HTMLInputElement>('[data-water-enabled]')?.checked ?? document.water.enabled;
      const level = num(this.roots.world.querySelector<HTMLInputElement>('[data-water-level]')?.value ?? '', document.water.level);
      const color = this.roots.world.querySelector<HTMLInputElement>('[data-water-color]')?.value ?? document.water.color;
      const opacity = num(this.roots.world.querySelector<HTMLInputElement>('[data-water-opacity]')?.value ?? '', document.water.opacity);
      this.editor.updateWater({ enabled, level, color, opacity });
    };
    this.roots.world.querySelectorAll<HTMLInputElement>('[data-water-enabled],[data-water-level],[data-water-color],[data-water-opacity]').forEach((input) => input.addEventListener('change', commitWater));
  }

  private bindLayers(): void { this.roots.layers.querySelectorAll<HTMLInputElement>('[data-world-layer]').forEach((checkbox) => checkbox.addEventListener('change', () => this.editor.setLayerVisible(checkbox.dataset.worldLayer as EditorWorldLayer, checkbox.checked))); }
  private bindToolButtons(root: HTMLElement): void { root.querySelectorAll<HTMLElement>('[data-authoring-tool]').forEach((button) => button.addEventListener('click', () => this.editor.setAuthoringTool(button.dataset.authoringTool as WorldAuthoringTool))); }

  private async importMaterials(files: File[], attachLayerId: string | null): Promise<void> {
    try {
      this.onStatus(`Importando ${files.length} material(is)...`);
      let first: TerrainMaterialRecord | null = null;
      for (const file of files) { const record = await this.materials.importZip(file); first ??= record; }
      this.materialRecords = await this.materials.list();
      if (attachLayerId && first) this.editor.setTerrainLayerMaterial(attachLayerId, { id: first.id, name: first.name });
      this.onStatus(`${files.length} material(is) importado(s) para a biblioteca.`, 'success');
      if (this.currentDocument) this.render(this.currentTool, this.currentDocument);
    } catch (error) { this.onStatus(`Falha ao importar textura: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  }

  private async deleteMaterial(id: string, document: WorldDocument): Promise<void> {
    const record = this.materialRecords.find((candidate) => candidate.id === id); if (!record) return;
    const users = document.terrain.layers.filter((layer) => layer.materialId === id);
    if (users.length) { this.onStatus(`“${record.name}” está em uso por: ${users.map((layer) => layer.name).join(', ')}. Substitua antes de excluir.`, 'error'); return; }
    if (!window.confirm(`Excluir material “${record.name}” da biblioteca local?`)) return;
    await this.materials.delete(id); const url = this.previewUrls.get(id); if (url) { URL.revokeObjectURL(url); this.previewUrls.delete(id); }
    this.materialRecords = await this.materials.list(); this.render(this.currentTool, document); this.onStatus(`Material “${record.name}” excluído.`, 'success');
  }

  private previewUrl(record: TerrainMaterialRecord): string {
    const existing = this.previewUrls.get(record.id); if (existing) return existing;
    const file = record.files.color; if (!file) return '';
    const url = URL.createObjectURL(file.blob); this.previewUrls.set(record.id, url); return url;
  }

  private materialOptions(selected?: string): string { return this.materialRecords.map((record) => `<option value="${record.id}"${record.id === selected ? ' selected' : ''}>${escapeHtml(record.name)} · ${escapeHtml(record.sourceArchive)}</option>`).join(''); }
  private layerPaintCount(layerId: string): number { return this.currentDocument?.terrain.paintStamps.filter((stamp) => stamp.layerId === layerId).length ?? 0; }
  private toolLabel(tool: WorldAuthoringTool): string { return TERRAIN_TOOLS.find((entry) => entry.tool === tool)?.label ?? (tool === 'select' ? 'Selecione uma ferramenta de terreno' : 'Configuração persistente'); }
  private updateRangeLabel(input: HTMLInputElement): void { const label = input.closest('label')?.querySelector('b'); if (label) label.textContent = num(input.value, 0).toFixed(1); }
}
