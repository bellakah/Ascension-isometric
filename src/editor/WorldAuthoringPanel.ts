import { TerrainMaterialDatabase, type TerrainMaterialRecord } from '../world/TerrainMaterialDatabase';
import type { EditorWorldLayer } from '../world/WorldEnvironment';
import type { WorldDocument } from '../world/WorldDocument';
import type { WorldAuthoringTool, WorldEditor } from './WorldEditor';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function num(value: string, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

const LAYER_LABELS: Record<EditorWorldLayer, string> = {
  terrain: 'Terrain', objects: 'Objects', water: 'Water', spawn: 'Spawn', collision: 'Collision Debug', grid: 'Grid',
};

export class WorldAuthoringPanel {
  private readonly materials = new TerrainMaterialDatabase();
  private materialRecords: TerrainMaterialRecord[] = [];
  private pendingLayer = 0;
  private currentTool: WorldAuthoringTool = 'select';
  private currentDocument: WorldDocument | null = null;

  constructor(private readonly root: HTMLElement, private readonly editor: WorldEditor, private readonly onStatus: (message: string, tone?: 'normal' | 'success' | 'error') => void) {
    root.classList.add('world-authoring-panel');
  }

  async initialize(): Promise<void> { this.materialRecords = await this.materials.list(); }

  render(tool: WorldAuthoringTool, document: WorldDocument): void {
    this.currentTool = tool; this.currentDocument = document;
    const brush = this.editor.brushSettings;
    this.root.innerHTML = `
      <div class="panel-heading"><div><strong>World Authoring</strong><span>${escapeHtml(this.toolLabel(tool))}</span></div></div>
      <div class="authoring-scroll">
        ${this.isTerrainTool(tool) ? `<section class="authoring-section"><h3>Brush</h3><label class="authoring-field"><span>Radius <b>${brush.radius.toFixed(1)}</b></span><input type="range" min="0.5" max="40" step="0.5" value="${brush.radius}" data-brush-radius></label><label class="authoring-field"><span>Strength <b>${brush.strength.toFixed(1)}</b></span><input type="range" min="0.5" max="30" step="0.5" value="${brush.strength}" data-brush-strength></label><label class="authoring-field"><span>Falloff</span><select data-brush-falloff><option value="smooth"${brush.falloff === 'smooth' ? ' selected' : ''}>Smooth</option><option value="flat"${brush.falloff === 'flat' ? ' selected' : ''}>Hard / Flat</option></select></label><p class="authoring-hint">Arraste com o botão esquerdo. Uma pincelada inteira gera apenas um Undo.</p></section>` : ''}
        ${tool === 'paint' ? this.paintPanel(document, brush.paintLayer) : ''}
        ${tool === 'water' ? this.waterPanel(document) : ''}
        ${tool === 'spawn' ? this.spawnPanel(document) : ''}
        ${tool === 'blocker' ? this.blockerPanel(document) : ''}
        ${this.isTerrainTool(tool) ? this.materialPanel(document) : ''}
        ${this.layersPanel()}
        <input type="file" accept=".zip,application/zip" data-terrain-material-file hidden>
      </div>`;
    this.bind(tool, document);
  }

  dispose(): void { this.root.innerHTML = ''; }

  private paintPanel(document: WorldDocument, selectedLayer: number): string {
    return `<section class="authoring-section"><h3>Paint Layer</h3><div class="terrain-layer-picks">${document.terrain.layers.map((layer, index) => `<button type="button" class="terrain-layer-pick${selectedLayer === index ? ' active' : ''}" data-paint-layer="${index}"><i style="background:${layer.fallbackColor}"></i><span>${escapeHtml(layer.name)}</span><small>${escapeHtml(layer.materialName ?? 'cor sólida')}</small></button>`).join('')}</div></section>`;
  }

  private materialPanel(document: WorldDocument): string {
    return `<section class="authoring-section"><div class="authoring-section-title"><h3>Terrain Materials</h3><span>PBR ZIP</span></div><p class="authoring-hint">Importa ZIPs com color/albedo, normal_gl, roughness, AO e height. O renderer atual usa o color map no blend e preserva os demais mapas para evolução PBR.</p><div class="terrain-material-layers">${document.terrain.layers.map((layer, index) => `<div class="terrain-material-card"><div class="terrain-material-card-head"><i style="background:${layer.fallbackColor}"></i><strong>${escapeHtml(layer.name)}</strong><button type="button" class="editor-button compact" data-import-layer="${index}">Importar ZIP</button></div><label class="authoring-field"><span>Material</span><select data-layer-material="${index}"><option value="">Cor sólida</option>${this.materialRecords.map((record) => `<option value="${record.id}"${record.id === layer.materialId ? ' selected' : ''}>${escapeHtml(record.name)} · ${escapeHtml(record.sourceArchive)}</option>`).join('')}</select></label><div class="authoring-row"><label class="authoring-field"><span>Cor fallback</span><input type="color" data-layer-color="${index}" value="${layer.fallbackColor}"></label><label class="authoring-field"><span>Tiling</span><input type="number" min="0.25" max="100" step="0.25" data-layer-tiling="${index}" value="${layer.tileScale}"></label></div></div>`).join('')}</div></section>`;
  }

  private waterPanel(document: WorldDocument): string {
    const water = document.water;
    return `<section class="authoring-section"><h3>Water</h3><label class="authoring-check"><input type="checkbox" data-water-enabled ${water.enabled ? 'checked' : ''}><span>Água habilitada no mapa</span></label><label class="authoring-field"><span>Nível</span><input type="number" step="0.25" data-water-level value="${water.level}"></label><div class="authoring-row"><label class="authoring-field"><span>Cor</span><input type="color" data-water-color value="${water.color}"></label><label class="authoring-field"><span>Opacidade</span><input type="number" min="0.05" max="0.95" step="0.05" data-water-opacity value="${water.opacity}"></label></div><p class="authoring-hint">Use Lower para cavar o leito e ajuste o nível da água aqui.</p></section>`;
  }

  private spawnPanel(document: WorldDocument): string {
    const spawn = document.spawn;
    return `<section class="authoring-section"><h3>Player Spawn</h3><div class="authoring-readout"><span>X <b>${spawn.x.toFixed(2)}</b></span><span>Y <b>${spawn.y.toFixed(2)}</b></span><span>Z <b>${spawn.z.toFixed(2)}</b></span></div><p class="authoring-hint">Clique no terreno para mover o marcador de spawn. A altura acompanha automaticamente a superfície.</p></section>`;
  }

  private blockerPanel(document: WorldDocument): string {
    return `<section class="authoring-section"><h3>Invisible Blockers</h3><div class="authoring-stat"><strong>${document.blockers.length}</strong><span>segmentos</span></div><p class="authoring-hint">Clique e arraste entre dois pontos. O segmento aparece no editor, mas é invisível no jogo e impede passagem.</p></section>`;
  }

  private layersPanel(): string {
    const layers: EditorWorldLayer[] = ['terrain', 'objects', 'water', 'spawn', 'collision', 'grid'];
    return `<section class="authoring-section"><h3>Layers</h3><div class="authoring-layers">${layers.map((layer) => `<label class="authoring-check"><input type="checkbox" data-world-layer="${layer}" ${this.editor.getLayerVisible(layer) ? 'checked' : ''}><span>${LAYER_LABELS[layer]}</span></label>`).join('')}</div></section>`;
  }

  private bind(tool: WorldAuthoringTool, document: WorldDocument): void {
    const radius = this.root.querySelector<HTMLInputElement>('[data-brush-radius]');
    radius?.addEventListener('input', () => { this.editor.setBrushSettings({ radius: num(radius.value, this.editor.brushSettings.radius) }); this.updateRangeLabel(radius); });
    const strength = this.root.querySelector<HTMLInputElement>('[data-brush-strength]');
    strength?.addEventListener('input', () => { this.editor.setBrushSettings({ strength: num(strength.value, this.editor.brushSettings.strength) }); this.updateRangeLabel(strength); });
    this.root.querySelector<HTMLSelectElement>('[data-brush-falloff]')?.addEventListener('change', (event) => this.editor.setBrushSettings({ falloff: (event.currentTarget as HTMLSelectElement).value === 'flat' ? 'flat' : 'smooth' }));
    this.root.querySelectorAll<HTMLElement>('[data-paint-layer]').forEach((button) => button.addEventListener('click', () => { this.editor.setBrushSettings({ paintLayer: Number(button.dataset.paintLayer ?? 0) }); this.render(tool, document); }));

    const commitWater = (): void => {
      const enabled = this.root.querySelector<HTMLInputElement>('[data-water-enabled]')?.checked ?? document.water.enabled;
      const level = num(this.root.querySelector<HTMLInputElement>('[data-water-level]')?.value ?? '', document.water.level);
      const color = this.root.querySelector<HTMLInputElement>('[data-water-color]')?.value ?? document.water.color;
      const opacity = num(this.root.querySelector<HTMLInputElement>('[data-water-opacity]')?.value ?? '', document.water.opacity);
      this.editor.updateWater({ enabled, level, color, opacity });
    };
    this.root.querySelectorAll<HTMLInputElement>('[data-water-enabled],[data-water-level],[data-water-color],[data-water-opacity]').forEach((input) => input.addEventListener('change', commitWater));

    this.root.querySelectorAll<HTMLSelectElement>('[data-layer-material]').forEach((select) => select.addEventListener('change', () => {
      const index = Number(select.dataset.layerMaterial ?? 0); const record = this.materialRecords.find((candidate) => candidate.id === select.value);
      this.editor.setTerrainLayerMaterial(index, record ? { id: record.id, name: record.name } : null);
    }));
    this.root.querySelectorAll<HTMLInputElement>('[data-layer-color]').forEach((input) => input.addEventListener('change', () => this.editor.updateTerrainLayer(Number(input.dataset.layerColor ?? 0), { fallbackColor: input.value })));
    this.root.querySelectorAll<HTMLInputElement>('[data-layer-tiling]').forEach((input) => input.addEventListener('change', () => this.editor.updateTerrainLayer(Number(input.dataset.layerTiling ?? 0), { tileScale: num(input.value, 10) })));

    const fileInput = this.root.querySelector<HTMLInputElement>('[data-terrain-material-file]');
    this.root.querySelectorAll<HTMLButtonElement>('[data-import-layer]').forEach((button) => button.addEventListener('click', () => { this.pendingLayer = Number(button.dataset.importLayer ?? 0); fileInput?.click(); }));
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0]; if (!file) return;
      void this.importMaterial(file, this.pendingLayer); fileInput.value = '';
    });

    this.root.querySelectorAll<HTMLInputElement>('[data-world-layer]').forEach((checkbox) => checkbox.addEventListener('change', () => this.editor.setLayerVisible(checkbox.dataset.worldLayer as EditorWorldLayer, checkbox.checked)));
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
  private isTerrainTool(tool: WorldAuthoringTool): boolean { return tool === 'raise' || tool === 'lower' || tool === 'smooth' || tool === 'flatten' || tool === 'paint' || tool === 'erase'; }
  private toolLabel(tool: WorldAuthoringTool): string {
    const labels: Record<WorldAuthoringTool, string> = { select: 'Select', raise: 'Raise Terrain', lower: 'Lower Terrain', smooth: 'Smooth Terrain', flatten: 'Flatten Terrain', paint: 'Paint Terrain', erase: 'Erase Terrain Edit', water: 'Water', spawn: 'Spawn', blocker: 'Blocker' };
    return labels[tool];
  }
}
