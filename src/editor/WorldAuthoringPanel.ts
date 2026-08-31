import { TerrainMaterialDatabase, type TerrainMaterialRecord } from '../world/TerrainMaterialDatabase';
import type { EditorWorldLayer } from '../world/WorldEnvironment';
import type { WorldDocument } from '../world/WorldDocument';
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
  private pendingLayer = 0;
  private currentTool: WorldAuthoringTool = 'select';
  private currentDocument: WorldDocument | null = null;

  constructor(private readonly roots: WorldAuthoringPanelRoots, private readonly editor: WorldEditor, private readonly onStatus: (message: string, tone?: 'normal' | 'success' | 'error') => void) {
    Object.values(roots).forEach((root) => root.classList.add('world-authoring-panel'));
  }

  async initialize(): Promise<void> { this.materialRecords = await this.materials.list(); }

  render(tool: WorldAuthoringTool, document: WorldDocument): void {
    this.currentTool = tool; this.currentDocument = document;
    this.renderTerrain(document); this.renderWorld(document); this.renderLayers();
    this.bindTerrain(document); this.bindWorld(document); this.bindLayers();
  }

  dispose(): void { Object.values(this.roots).forEach((root) => { root.innerHTML = ''; }); }

  private renderTerrain(document: WorldDocument): void {
    const brush = this.editor.brushSettings;
    this.roots.terrain.innerHTML = `
      <div class="panel-heading"><div><strong>Terrain</strong><span>${escapeHtml(this.toolLabel(this.currentTool))}</span></div></div>
      <div class="authoring-scroll">
        <section class="authoring-section"><div class="authoring-section-title"><h3>Ferramentas</h3><span>clique para ativar</span></div><div class="authoring-tool-grid">${TERRAIN_TOOLS.map((entry) => `<button type="button" class="authoring-tool-button${this.currentTool === entry.tool ? ' active' : ''}" data-authoring-tool="${entry.tool}"><b>${entry.icon}</b><span>${entry.label}</span></button>`).join('')}</div></section>
        <section class="authoring-section"><h3>Brush</h3><label class="authoring-field"><span>Radius <b>${brush.radius.toFixed(1)}</b></span><input type="range" min="0.5" max="40" step="0.5" value="${brush.radius}" data-brush-radius></label><label class="authoring-field"><span>Strength <b>${brush.strength.toFixed(1)}</b></span><input type="range" min="0.5" max="30" step="0.5" value="${brush.strength}" data-brush-strength></label><label class="authoring-field"><span>Falloff</span><select data-brush-falloff><option value="smooth"${brush.falloff === 'smooth' ? ' selected' : ''}>Smooth</option><option value="flat"${brush.falloff === 'flat' ? ' selected' : ''}>Hard / Flat</option></select></label><p class="authoring-hint">Arraste com LMB no terreno. Uma pincelada inteira gera apenas um Undo.</p></section>
        ${this.paintPanel(document, brush.paintLayer)}
        ${this.materialPanel(document)}
        <input type="file" accept=".zip,application/zip" data-terrain-material-file hidden>
      </div>`;
  }

  private renderWorld(document: WorldDocument): void {
    this.roots.world.innerHTML = `
      <div class="panel-heading"><div><strong>World</strong><span>ambiente e gameplay espacial</span></div></div>
      <div class="authoring-scroll">
        <section class="authoring-section"><div class="authoring-section-title"><h3>Ferramentas</h3><span>clique para ativar</span></div><div class="authoring-tool-grid world">${WORLD_TOOLS.map((entry) => `<button type="button" class="authoring-tool-button${this.currentTool === entry.tool ? ' active' : ''}" data-authoring-tool="${entry.tool}"><b>${entry.icon}</b><span>${entry.label}</span></button>`).join('')}</div></section>
        ${this.worldOverview(document)}
        ${this.waterPanel(document)}
        ${this.spawnPanel(document)}
        ${this.blockerPanel(document)}
      </div>`;
  }

  private renderLayers(): void {
    this.roots.layers.innerHTML = `<div class="panel-heading"><div><strong>Layers</strong><span>visibilidade do editor</span></div></div><div class="authoring-scroll">${this.layersPanel()}<section class="authoring-section"><h3>Dica</h3><p class="authoring-hint">Desligue Objects para esculpir sem cenário na frente. Collision Debug mostra footprints e blockers sem afetar o Playtest.</p></section></div>`;
  }

  private paintPanel(document: WorldDocument, selectedLayer: number): string {
    return `<section class="authoring-section"><div class="authoring-section-title"><h3>Paint Layers</h3><span>${this.currentTool === 'paint' ? 'Paint ativo' : 'selecione Paint para usar'}</span></div><div class="terrain-layer-picks">${document.terrain.layers.map((layer, index) => `<button type="button" class="terrain-layer-pick${selectedLayer === index ? ' active' : ''}" data-paint-layer="${index}"><i style="background:${layer.fallbackColor}"></i><span>${escapeHtml(layer.name)}</span><small>${escapeHtml(layer.materialName ?? 'cor sólida')}</small></button>`).join('')}</div></section>`;
  }

  private materialPanel(document: WorldDocument): string {
    return `<section class="authoring-section"><div class="authoring-section-title"><h3>Terrain Materials</h3><span>PBR ZIP</span></div><p class="authoring-hint">Importe ZIPs como grass_01_1k. Color/albedo é usado no blend; normal_gl, roughness, AO e height ficam preservados na biblioteca.</p><div class="terrain-material-layers">${document.terrain.layers.map((layer, index) => `<div class="terrain-material-card"><div class="terrain-material-card-head"><i style="background:${layer.fallbackColor}"></i><strong>${escapeHtml(layer.name)}</strong><button type="button" class="editor-button compact" data-import-layer="${index}">Importar ZIP</button></div><label class="authoring-field"><span>Material</span><select data-layer-material="${index}"><option value="">Cor sólida</option>${this.materialRecords.map((record) => `<option value="${record.id}"${record.id === layer.materialId ? ' selected' : ''}>${escapeHtml(record.name)} · ${escapeHtml(record.sourceArchive)}</option>`).join('')}</select></label><div class="authoring-row"><label class="authoring-field"><span>Cor fallback</span><input type="color" data-layer-color="${index}" value="${layer.fallbackColor}"></label><label class="authoring-field"><span>Tiling</span><input type="number" min="0.25" max="100" step="0.25" data-layer-tiling="${index}" value="${layer.tileScale}"></label></div></div>`).join('')}</div></section>`;
  }

  private worldOverview(document: WorldDocument): string {
    return `<section class="authoring-section"><h3>Mapa atual</h3><div class="authoring-readout"><span>Tamanho <b>${document.environment.groundSize}</b></span><span>Objetos <b>${document.entities.length}</b></span><span>Blockers <b>${document.blockers.length}</b></span></div><p class="authoring-hint">Nome, tamanho, descrição e exportação continuam em Mapas.</p></section>`;
  }

  private waterPanel(document: WorldDocument): string {
    const water = document.water;
    return `<section class="authoring-section"><h3>Water</h3><label class="authoring-check"><input type="checkbox" data-water-enabled ${water.enabled ? 'checked' : ''}><span>Água habilitada no mapa</span></label><label class="authoring-field"><span>Nível</span><input type="number" step="0.25" data-water-level value="${water.level}"></label><div class="authoring-row"><label class="authoring-field"><span>Cor</span><input type="color" data-water-color value="${water.color}"></label><label class="authoring-field"><span>Opacidade</span><input type="number" min="0.05" max="0.95" step="0.05" data-water-opacity value="${water.opacity}"></label></div><button type="button" class="editor-button" data-authoring-tool="water">Ativar Water Tool</button></section>`;
  }

  private spawnPanel(document: WorldDocument): string {
    const spawn = document.spawn;
    return `<section class="authoring-section"><h3>Player Spawn</h3><div class="authoring-readout"><span>X <b>${spawn.x.toFixed(2)}</b></span><span>Y <b>${spawn.y.toFixed(2)}</b></span><span>Z <b>${spawn.z.toFixed(2)}</b></span></div><p class="authoring-hint">Ative Spawn e clique no terreno para mover o marcador.</p><button type="button" class="editor-button" data-authoring-tool="spawn">Ativar Spawn Tool</button></section>`;
  }

  private blockerPanel(document: WorldDocument): string {
    return `<section class="authoring-section"><h3>Invisible Blockers</h3><div class="authoring-stat"><strong>${document.blockers.length}</strong><span>segmentos</span></div><p class="authoring-hint">Ative Blocker e arraste entre dois pontos. O segmento só aparece como debug no editor.</p><button type="button" class="editor-button" data-authoring-tool="blocker">Ativar Blocker Tool</button></section>`;
  }

  private layersPanel(): string {
    const layers: EditorWorldLayer[] = ['terrain', 'objects', 'water', 'spawn', 'collision', 'grid'];
    return `<section class="authoring-section"><h3>Scene Visibility</h3><div class="authoring-layers">${layers.map((layer) => `<label class="authoring-check"><input type="checkbox" data-world-layer="${layer}" ${this.editor.getLayerVisible(layer) ? 'checked' : ''}><span>${LAYER_LABELS[layer]}</span></label>`).join('')}</div></section>`;
  }

  private bindTerrain(document: WorldDocument): void {
    this.bindToolButtons(this.roots.terrain);
    const radius = this.roots.terrain.querySelector<HTMLInputElement>('[data-brush-radius]');
    radius?.addEventListener('input', () => { this.editor.setBrushSettings({ radius: num(radius.value, this.editor.brushSettings.radius) }); this.updateRangeLabel(radius); });
    const strength = this.roots.terrain.querySelector<HTMLInputElement>('[data-brush-strength]');
    strength?.addEventListener('input', () => { this.editor.setBrushSettings({ strength: num(strength.value, this.editor.brushSettings.strength) }); this.updateRangeLabel(strength); });
    this.roots.terrain.querySelector<HTMLSelectElement>('[data-brush-falloff]')?.addEventListener('change', (event) => this.editor.setBrushSettings({ falloff: (event.currentTarget as HTMLSelectElement).value === 'flat' ? 'flat' : 'smooth' }));
    this.roots.terrain.querySelectorAll<HTMLElement>('[data-paint-layer]').forEach((button) => button.addEventListener('click', () => { this.editor.setBrushSettings({ paintLayer: Number(button.dataset.paintLayer ?? 0) }); this.render(this.currentTool, document); }));
    this.roots.terrain.querySelectorAll<HTMLSelectElement>('[data-layer-material]').forEach((select) => select.addEventListener('change', () => {
      const index = Number(select.dataset.layerMaterial ?? 0); const record = this.materialRecords.find((candidate) => candidate.id === select.value);
      this.editor.setTerrainLayerMaterial(index, record ? { id: record.id, name: record.name } : null);
    }));
    this.roots.terrain.querySelectorAll<HTMLInputElement>('[data-layer-color]').forEach((input) => input.addEventListener('change', () => this.editor.updateTerrainLayer(Number(input.dataset.layerColor ?? 0), { fallbackColor: input.value })));
    this.roots.terrain.querySelectorAll<HTMLInputElement>('[data-layer-tiling]').forEach((input) => input.addEventListener('change', () => this.editor.updateTerrainLayer(Number(input.dataset.layerTiling ?? 0), { tileScale: num(input.value, 10) })));
    const fileInput = this.roots.terrain.querySelector<HTMLInputElement>('[data-terrain-material-file]');
    this.roots.terrain.querySelectorAll<HTMLButtonElement>('[data-import-layer]').forEach((button) => button.addEventListener('click', () => { this.pendingLayer = Number(button.dataset.importLayer ?? 0); fileInput?.click(); }));
    fileInput?.addEventListener('change', () => { const file = fileInput.files?.[0]; if (!file) return; void this.importMaterial(file, this.pendingLayer); fileInput.value = ''; });
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

  private bindLayers(): void {
    this.roots.layers.querySelectorAll<HTMLInputElement>('[data-world-layer]').forEach((checkbox) => checkbox.addEventListener('change', () => this.editor.setLayerVisible(checkbox.dataset.worldLayer as EditorWorldLayer, checkbox.checked)));
  }

  private bindToolButtons(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-authoring-tool]').forEach((button) => button.addEventListener('click', () => this.editor.setAuthoringTool(button.dataset.authoringTool as WorldAuthoringTool)));
  }

  private async importMaterial(file: File, layerIndex: number): Promise<void> {
    try {
      this.onStatus(`Importando material ${file.name}...`);
      const record = await this.materials.importZip(file); this.materialRecords = await this.materials.list();
      this.editor.setTerrainLayerMaterial(layerIndex, { id: record.id, name: record.name });
      this.onStatus(`${record.name} importado: ${Object.keys(record.files).join(', ')}.`, 'success');
      if (this.currentDocument) this.render(this.currentTool, this.currentDocument);
    } catch (error) { this.onStatus(`Falha ao importar textura: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  }

  private updateRangeLabel(input: HTMLInputElement): void { const label = input.closest('label')?.querySelector('b'); if (label) label.textContent = Number(input.value).toFixed(1); }
  private toolLabel(tool: WorldAuthoringTool): string {
    const labels: Record<WorldAuthoringTool, string> = { select: 'Seleção', raise: 'Raise Terrain', lower: 'Lower Terrain', smooth: 'Smooth Terrain', flatten: 'Flatten Terrain', paint: 'Paint Terrain', erase: 'Erase Terrain Edit', water: 'Water Tool', spawn: 'Spawn Tool', blocker: 'Blocker Tool' };
    return labels[tool];
  }
}
