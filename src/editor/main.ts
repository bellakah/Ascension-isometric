import '../styles.css';
import './editor.css';
import './zip-import.css';
import './world-editor.css';
import './world-project.css';
import './character-studio.css';
import './terrain-editor.css';
import { AssetBrowser } from './AssetBrowser';
import { CharacterStudio } from './CharacterStudio';
import { EditorAssetPlacement } from './EditorAssetPlacement';
import { HierarchyPanel, InspectorPanel } from './EditorPanels';
import { WorldAuthoringPanel } from './WorldAuthoringPanel';
import { WorldEditor, type TransformMode, type WorldAuthoringTool } from './WorldEditor';
import { WorldProjectDialog } from './WorldProjectDialog';
import { Engine } from '../engine/Engine';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found.');

root.innerHTML = `
  <main class="editor-shell">
    <section class="editor-workspace">
      <aside class="hierarchy-host" aria-label="Hierarchy do mapa"></aside>
      <section class="editor-viewport-wrap">
        <canvas class="viewport editor-viewport" tabindex="0" aria-label="Viewport 3D do editor"></canvas>
        <header class="editor-topbar">
          <div class="brand"><div class="brand-mark">A</div><div class="brand-copy"><h1 class="brand-title">Ascension World Editor</h1><p class="brand-subtitle">v0.7.0 · Terrain Authoring · PBR Material ZIPs</p></div></div>
          <div class="editor-top-actions"><span class="current-map-badge" data-current-map>Mapa</span><span class="editor-status" data-tone="normal">Editor pronto.</span><button class="editor-button compact" type="button" data-undo title="Desfazer (Ctrl+Z)">↶</button><button class="editor-button compact" type="button" data-redo title="Refazer (Ctrl+Y)">↷</button><button class="editor-button" type="button" data-projects>Mapas</button><button class="editor-button" type="button" data-character-studio>Personagem</button><button class="editor-button" type="button" data-import-world>Importar JSON</button><input type="file" accept=".json,application/json" data-world-file hidden><button class="editor-button playtest" type="button" data-playtest>▶ Playtest</button></div>
        </header>
        <aside class="editor-toolrail map-toolrail" aria-label="Ferramentas do World Editor">
          <span class="tool-group-label">SELECT</span>
          <button class="tool-button active" type="button" title="Selecionar (V)" data-world-tool="select">◇<span>Selecionar (V)</span></button>
          <button class="tool-button" type="button" title="Mover (G)" data-transform-mode="translate">↔<span>Mover (G)</span></button>
          <button class="tool-button" type="button" title="Rotacionar (R)" data-transform-mode="rotate">⟳<span>Rotacionar (R)</span></button>
          <button class="tool-button" type="button" title="Escalar (S)" data-transform-mode="scale">⤢<span>Escalar (S)</span></button>
          <span class="tool-group-label">TERRAIN</span>
          <button class="tool-button terrain-tool" type="button" title="Raise" data-world-tool="raise">△<span>Raise</span></button>
          <button class="tool-button terrain-tool" type="button" title="Lower" data-world-tool="lower">▽<span>Lower</span></button>
          <button class="tool-button terrain-tool" type="button" title="Smooth" data-world-tool="smooth">≈<span>Smooth</span></button>
          <button class="tool-button terrain-tool" type="button" title="Flatten" data-world-tool="flatten">═<span>Flatten</span></button>
          <button class="tool-button terrain-tool" type="button" title="Paint" data-world-tool="paint">◉<span>Paint</span></button>
          <button class="tool-button terrain-tool" type="button" title="Erase terrain edit" data-world-tool="erase">⌫<span>Erase</span></button>
          <span class="tool-group-label">WORLD</span>
          <button class="tool-button world-tool" type="button" title="Water" data-world-tool="water">≈<span>Water</span></button>
          <button class="tool-button world-tool" type="button" title="Spawn" data-world-tool="spawn">✦<span>Spawn</span></button>
          <button class="tool-button world-tool" type="button" title="Blocker" data-world-tool="blocker">▰<span>Blocker</span></button>
          <span class="tool-group-label">CONTENT</span>
          <button class="tool-button" type="button" title="Assets" data-open-assets>▦<span>Assets</span></button>
          <button class="tool-button" type="button" title="Character Studio" data-open-character>♟<span>Personagem</span></button>
        </aside>
        <div class="editor-hint"><strong>V</strong> selecionar · <strong>G/R/S</strong> transform · terreno: arraste LMB · <strong>RMB</strong> câmera · <strong>Ctrl+Z/Y</strong> undo/redo · <strong>Q/E</strong> gira câmera</div>
      </section>
      <aside class="inspector-host" aria-label="Inspector e ferramentas do mapa"></aside>
    </section>
    <section class="asset-dock" aria-label="Biblioteca de assets"></section>
  </main>`;

const canvas = root.querySelector<HTMLCanvasElement>('.editor-viewport');
const assetDock = root.querySelector<HTMLElement>('.asset-dock');
const hierarchyHost = root.querySelector<HTMLElement>('.hierarchy-host');
const inspectorHost = root.querySelector<HTMLElement>('.inspector-host');
const status = root.querySelector<HTMLElement>('.editor-status');
const currentMap = root.querySelector<HTMLElement>('[data-current-map]');
const undoButton = root.querySelector<HTMLButtonElement>('[data-undo]');
const redoButton = root.querySelector<HTMLButtonElement>('[data-redo]');
const worldFileInput = root.querySelector<HTMLInputElement>('[data-world-file]');
if (!canvas || !assetDock || !hierarchyHost || !inspectorHost || !status || !currentMap || !undoButton || !redoButton || !worldFileInput) throw new Error('Editor shell failed to initialize.');
const statusElement: HTMLElement = status;
function setStatus(message: string, tone: 'normal' | 'success' | 'error' = 'normal'): void { statusElement.textContent = message; statusElement.dataset.tone = tone; }

const engine = new Engine(canvas); engine.camera.setTarget(engine.camera.target.set(0, 0, 0));
let hierarchyPanel: HierarchyPanel | null = null;
let inspectorPanel: InspectorPanel | null = null;
let authoringPanel: WorldAuthoringPanel | null = null;
let currentTool: WorldAuthoringTool = 'select';
const updateHistoryButtons = (): void => { undoButton.disabled = !worldEditor.canUndo(); redoButton.disabled = !worldEditor.canRedo(); };
const updateModeButtons = (mode: TransformMode): void => root.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.classList.toggle('active', currentTool === 'select' && button.dataset.transformMode === mode));
const updateToolButtons = (tool: WorldAuthoringTool): void => root.querySelectorAll<HTMLElement>('[data-world-tool]').forEach((button) => button.classList.toggle('active', button.dataset.worldTool === tool));

const worldEditor = new WorldEditor(engine, canvas, {
  onDocumentChanged: (document) => {
    currentMap.textContent = document.name; currentMap.title = `${document.name} · ${document.entities.length} entidades · ${document.terrain.heightStamps.length} terrain edits`;
    hierarchyPanel?.render(document, worldEditor.selectedEntityId);
    if (currentTool === 'select') inspectorPanel?.render(worldEditor.getSelectedEntity()); else authoringPanel?.render(currentTool, document);
    updateHistoryButtons();
  },
  onSelectionChanged: (entity) => { hierarchyPanel?.render(worldEditor.document, entity?.id ?? null); if (currentTool === 'select') inspectorPanel?.render(entity); },
  onModeChanged: updateModeButtons,
  onToolChanged: (tool) => { currentTool = tool; updateToolButtons(tool); if (tool === 'select') inspectorPanel?.render(worldEditor.getSelectedEntity()); else authoringPanel?.render(tool, worldEditor.document); },
  onStatus: setStatus,
});

hierarchyPanel = new HierarchyPanel({ root: hierarchyHost, onSelect: (id) => { worldEditor.setAuthoringTool('select'); worldEditor.select(id); }, onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });
inspectorPanel = new InspectorPanel({ root: inspectorHost, onRename: (name) => worldEditor.renameSelected(name), onTransform: (transform) => worldEditor.updateSelectedTransform(transform), onVisible: (visible) => worldEditor.setSelectedVisible(visible), onGrounding: (grounded, offset) => worldEditor.setSelectedGrounding(grounded, offset), onSnapGround: () => worldEditor.snapSelectedToGround(), onCollision: (mode, radius) => worldEditor.setSelectedCollision(mode, radius), onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });
authoringPanel = new WorldAuthoringPanel(inspectorHost, worldEditor, setStatus);

const projectDialog = new WorldProjectDialog(worldEditor);
const characterStudio = new CharacterStudio(setStatus);
const placement = new EditorAssetPlacement(engine, canvas, (x, y) => worldEditor.surfaceAt(x, y), (asset, position) => worldEditor.placeAsset(asset, position), setStatus);
const browser = new AssetBrowser({ root: assetDock, dropTarget: root, onPlace: (asset) => { worldEditor.setAuthoringTool('select'); void placement.activate(asset).catch((error: unknown) => setStatus(`Não foi possível preparar ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error')); }, onStatus: setStatus });
void Promise.all([browser.initialize(), authoringPanel.initialize(), worldEditor.initialize()]).catch((error: unknown) => setStatus(`Falha ao inicializar editor: ${error instanceof Error ? error.message : String(error)}`, 'error'));

let cameraDragging = false; let lastX = 0; let lastY = 0;
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (placement.isActive && event.button === 0) return;
  if (worldEditor.handleAuthoringPointerDown(event)) { canvas.setPointerCapture(event.pointerId); return; }
  if (event.button === 0 && !worldEditor.isTransformInteracting) worldEditor.selectFromPointer(event);
  if (event.button !== 2 || worldEditor.isTransformInteracting) return;
  cameraDragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => { worldEditor.handleAuthoringPointerMove(event); if (!cameraDragging) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; engine.camera.panScreen(dx, dy); });
canvas.addEventListener('pointerup', (event) => { worldEditor.handleAuthoringPointerUp(event); if (event.button === 2) cameraDragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); engine.camera.zoomByWheel(event.deltaY); }, { passive: false });

window.addEventListener('keydown', (event) => {
  const target = event.target; if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) void worldEditor.redo(); else void worldEditor.undo(); return; }
    if (event.code === 'KeyY') { event.preventDefault(); void worldEditor.redo(); return; }
    if (event.code === 'KeyD') { event.preventDefault(); void worldEditor.duplicateSelected(); return; }
  }
  if (event.code === 'KeyV') worldEditor.setAuthoringTool('select');
  if (event.code === 'KeyG') worldEditor.setMode('translate'); if (event.code === 'KeyR') worldEditor.setMode('rotate'); if (event.code === 'KeyS') worldEditor.setMode('scale');
  if (event.code === 'KeyF' && currentTool === 'select') worldEditor.focusSelected(); if (event.code === 'Delete' && currentTool === 'select') worldEditor.deleteSelected(); if (event.code === 'Escape' && !placement.isActive) worldEditor.setAuthoringTool('select');
  if (event.code === 'KeyQ') engine.camera.rotateQuarter(-1); if (event.code === 'KeyE') engine.camera.rotateQuarter(1);
});

root.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.addEventListener('click', () => worldEditor.setMode(button.dataset.transformMode as TransformMode)));
root.querySelectorAll<HTMLElement>('[data-world-tool]').forEach((button) => button.addEventListener('click', () => worldEditor.setAuthoringTool(button.dataset.worldTool as WorldAuthoringTool)));
root.querySelector<HTMLElement>('[data-open-assets]')?.addEventListener('click', () => assetDock.classList.toggle('collapsed'));
root.querySelector<HTMLElement>('[data-open-character]')?.addEventListener('click', () => void characterStudio.open());
root.querySelector<HTMLButtonElement>('[data-character-studio]')?.addEventListener('click', () => void characterStudio.open());
root.querySelector<HTMLButtonElement>('[data-projects]')?.addEventListener('click', () => void projectDialog.open());
root.querySelector<HTMLButtonElement>('[data-playtest]')?.addEventListener('click', () => void worldEditor.preparePlaytest().then(() => window.open('/?playtest=1', 'ascension-playtest')));
root.querySelector<HTMLButtonElement>('[data-import-world]')?.addEventListener('click', () => worldFileInput.click());
undoButton.addEventListener('click', () => void worldEditor.undo()); redoButton.addEventListener('click', () => void worldEditor.redo());
worldFileInput.addEventListener('change', () => { const file = worldFileInput.files?.[0]; if (!file) return; void file.text().then((json) => worldEditor.importWorldJson(json)).catch((error: unknown) => setStatus(`Falha ao importar mapa: ${error instanceof Error ? error.message : String(error)}`, 'error')); worldFileInput.value = ''; });

engine.start();
window.addEventListener('beforeunload', () => { void worldEditor.saveCurrent(); placement.dispose(); browser.dispose(); characterStudio.dispose(); projectDialog.dispose(); authoringPanel?.dispose(); worldEditor.dispose(); engine.dispose(); });
