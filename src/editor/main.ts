import '../styles.css';
import './editor.css';
import './zip-import.css';
import './world-editor.css';
import './world-project.css';
import './character-studio.css';
import './terrain-editor.css';
import './professional-workspace.css';
import { AssetBrowser } from './AssetBrowser';
import { CharacterStudio } from './CharacterStudio';
import { EditorAssetPlacement } from './EditorAssetPlacement';
import { HierarchyPanel, InspectorPanel } from './EditorPanels';
import { EditorWorkspace } from './EditorWorkspace';
import { WorldAuthoringPanel } from './WorldAuthoringPanel';
import { WorldEditor, type TransformMode, type WorldAuthoringTool } from './WorldEditor';
import { WorldProjectDialog } from './WorldProjectDialog';
import { EditorPerspectiveCamera } from '../camera/EditorPerspectiveCamera';
import type { IsometricCamera } from '../camera/IsometricCamera';
import { Engine } from '../engine/Engine';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found.');
const appRoot: HTMLElement = root;

appRoot.innerHTML = `
  <main class="editor-shell">
    <header class="editor-menubar">
      <div class="editor-brand"><div class="brand-mark">A</div><div class="editor-brand-copy"><strong>Ascension World Editor</strong><span>v0.7.5 · Game Perspective · Regions · Scatter</span></div></div>
      <div class="editor-menubar-center">
        <span class="current-map-badge" data-current-map>Mapa</span>
        <span class="editor-status" data-tone="normal">Editor pronto.</span>
        <button class="editor-button secondary-action" type="button" data-projects>Mapas</button>
        <button class="editor-button secondary-action" type="button" data-character-studio>Personagem</button>
        <button class="editor-button secondary-action" type="button" data-import-world>Importar JSON</button>
        <input type="file" accept=".json,application/json" data-world-file hidden>
      </div>
      <div class="editor-menubar-right">
        <button class="editor-button compact" type="button" data-undo title="Desfazer (Ctrl+Z)">↶</button>
        <button class="editor-button compact" type="button" data-redo title="Refazer (Ctrl+Y)">↷</button>
        <span class="editor-action-separator"></span>
        <button class="editor-button compact" type="button" data-game-camera title="Restaurar câmera do jogo: FOV 60°, pitch e distância padrão">Game Cam</button>
        <button class="editor-button compact" type="button" data-layout-reset title="Restaurar layout padrão">Layout</button>
        <button class="editor-button playtest" type="button" data-playtest>▶ Playtest</button>
      </div>
    </header>

    <section class="editor-workspace">
      <aside class="hierarchy-host" aria-label="Hierarchy do mapa"></aside>
      <div class="editor-splitter" data-left-splitter title="Arraste para redimensionar Hierarchy"></div>
      <section class="editor-viewport-wrap">
        <canvas class="viewport editor-viewport" tabindex="0" aria-label="Viewport 3D do editor"></canvas>
        <aside class="editor-toolrail map-toolrail" aria-label="Ferramentas do World Editor">
          <span class="tool-group-label">SELECT</span>
          <button class="tool-button active" type="button" title="Selecionar (V)" data-world-tool="select"><span class="tool-icon">◇</span><span class="tool-name">Selecionar</span></button>
          <button class="tool-button" type="button" title="Mover (G)" data-transform-mode="translate"><span class="tool-icon">↔</span><span class="tool-name">Mover</span></button>
          <button class="tool-button" type="button" title="Rotacionar (R)" data-transform-mode="rotate"><span class="tool-icon">⟳</span><span class="tool-name">Rotacionar</span></button>
          <button class="tool-button" type="button" title="Escalar (S)" data-transform-mode="scale"><span class="tool-icon">⤢</span><span class="tool-name">Escalar</span></button>
          <span class="tool-group-label">TERRAIN</span>
          <button class="tool-button terrain-tool" type="button" data-world-tool="raise"><span class="tool-icon">△</span><span class="tool-name">Raise</span></button>
          <button class="tool-button terrain-tool" type="button" data-world-tool="lower"><span class="tool-icon">▽</span><span class="tool-name">Lower</span></button>
          <button class="tool-button terrain-tool" type="button" data-world-tool="smooth"><span class="tool-icon">≈</span><span class="tool-name">Smooth</span></button>
          <button class="tool-button terrain-tool" type="button" data-world-tool="flatten"><span class="tool-icon">═</span><span class="tool-name">Flatten</span></button>
          <button class="tool-button terrain-tool" type="button" data-world-tool="paint"><span class="tool-icon">●</span><span class="tool-name">Paint</span></button>
          <button class="tool-button terrain-tool" type="button" data-world-tool="erase"><span class="tool-icon">⌫</span><span class="tool-name">Erase</span></button>
          <span class="tool-group-label">WORLD</span>
          <button class="tool-button world-tool" type="button" data-world-tool="water"><span class="tool-icon">≈</span><span class="tool-name">Water</span></button>
          <button class="tool-button world-tool" type="button" data-world-tool="spawn"><span class="tool-icon">✦</span><span class="tool-name">Spawn</span></button>
          <button class="tool-button world-tool" type="button" data-world-tool="blocker"><span class="tool-icon">▰</span><span class="tool-name">Blocker</span></button>
          <button class="tool-button world-tool" type="button" title="Selecionar região (U)" data-world-tool="region"><span class="tool-icon">▧</span><span class="tool-name">Region</span></button>
          <span class="tool-group-label">CONTENT</span>
          <button class="tool-button" type="button" data-open-assets><span class="tool-icon">▦</span><span class="tool-name">Assets</span></button>
          <button class="tool-button" type="button" data-open-character><span class="tool-icon">♟</span><span class="tool-name">Personagem</span></button>
          <button class="tool-button toolrail-collapse" type="button" data-toolbar-compact><span class="tool-icon">«</span><span class="tool-name">Recolher barra</span></button>
        </aside>
        <div class="active-tool-chip" data-active-tool><strong>Selecionar</strong><span>Clique em um objeto para editar.</span></div>
        <div class="editor-hint"><strong>RMB</strong> orbita · <strong>MMB/Shift+RMB</strong> pan · <strong>Wheel</strong> zoom · <strong>Shift+Click</strong> multi-select · <strong>U</strong> region · <strong>F</strong> foca seleção · <strong>G/R/S</strong> transform</div>
      </section>
      <div class="editor-splitter" data-right-splitter title="Arraste para redimensionar painel"></div>
      <aside class="editor-side-panel" aria-label="Painel de propriedades">
        <nav class="editor-side-tabs" role="tablist">
          <button class="editor-side-tab active" type="button" role="tab" data-right-tab="inspector">Inspector</button>
          <button class="editor-side-tab" type="button" role="tab" data-right-tab="terrain">Terrain</button>
          <button class="editor-side-tab" type="button" role="tab" data-right-tab="world">World</button>
          <button class="editor-side-tab" type="button" role="tab" data-right-tab="layers">Layers</button>
        </nav>
        <div class="editor-side-body">
          <div class="editor-side-pane active" data-right-pane="inspector"><div class="inspector-host"></div></div>
          <div class="editor-side-pane" data-right-pane="terrain"><div class="terrain-panel-host"></div></div>
          <div class="editor-side-pane" data-right-pane="world"><div class="world-panel-host"></div></div>
          <div class="editor-side-pane" data-right-pane="layers"><div class="layers-panel-host"></div></div>
        </div>
      </aside>
    </section>
    <div class="asset-resizer" data-asset-resizer title="Arraste para redimensionar Asset Browser"></div>
    <section class="asset-dock" aria-label="Biblioteca de assets"></section>
  </main>`;

function required<T extends Element>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);
  if (!element) throw new Error(`Editor element not found: ${selector}`);
  return element;
}

const shell = required<HTMLElement>('.editor-shell');
const workspaceElement = required<HTMLElement>('.editor-workspace');
const canvas = required<HTMLCanvasElement>('.editor-viewport');
const assetDock = required<HTMLElement>('.asset-dock');
const hierarchyHost = required<HTMLElement>('.hierarchy-host');
const inspectorHost = required<HTMLElement>('.inspector-host');
const terrainHost = required<HTMLElement>('.terrain-panel-host');
const worldHost = required<HTMLElement>('.world-panel-host');
const layersHost = required<HTMLElement>('.layers-panel-host');
const statusElement = required<HTMLElement>('.editor-status');
const currentMap = required<HTMLElement>('[data-current-map]');
const undoButton = required<HTMLButtonElement>('[data-undo]');
const redoButton = required<HTMLButtonElement>('[data-redo]');
const worldFileInput = required<HTMLInputElement>('[data-world-file]');
const toolrail = required<HTMLElement>('.map-toolrail');
const activeToolChip = required<HTMLElement>('[data-active-tool]');

function setStatus(message: string, tone: 'normal' | 'success' | 'error' = 'normal'): void { statusElement.textContent = message; statusElement.dataset.tone = tone; }

const editorWorkspace = new EditorWorkspace({
  shell,
  workspace: workspaceElement,
  assetDock,
  assetResizer: required<HTMLElement>('[data-asset-resizer]'),
  leftSplitter: required<HTMLElement>('[data-left-splitter]'),
  rightSplitter: required<HTMLElement>('[data-right-splitter]'),
  toolrail,
  tabButtons: appRoot.querySelectorAll<HTMLElement>('[data-right-tab]'),
  tabPanes: appRoot.querySelectorAll<HTMLElement>('[data-right-pane]'),
});

const editorCamera = new EditorPerspectiveCamera();
const engine = new Engine(canvas, editorCamera as unknown as IsometricCamera);
editorCamera.setTarget(editorCamera.target.set(0, 1.8, 0));

let hierarchyPanel: HierarchyPanel | null = null;
let inspectorPanel: InspectorPanel | null = null;
let authoringPanel: WorldAuthoringPanel | null = null;
let currentTool: WorldAuthoringTool = 'select';
let currentMode: TransformMode = 'translate';

const toolNames: Record<WorldAuthoringTool, string> = { select: 'Selecionar', raise: 'Raise Terrain', lower: 'Lower Terrain', smooth: 'Smooth Terrain', flatten: 'Flatten Terrain', paint: 'Paint Terrain', erase: 'Erase Terrain', water: 'Water', spawn: 'Spawn', blocker: 'Blocker', region: 'Region' };
function updateActiveToolChip(): void {
  const brush = worldEditor.brushSettings;
  const terrain = currentTool === 'raise' || currentTool === 'lower' || currentTool === 'smooth' || currentTool === 'flatten' || currentTool === 'paint' || currentTool === 'erase';
  let detail = 'Use o viewport para editar o mundo.';
  if (currentTool === 'select') detail = worldEditor.selectionCount > 1 ? `${worldEditor.selectionCount} objetos · Transform: ${currentMode}` : `Transform: ${currentMode}`;
  else if (terrain) detail = `Radius ${brush.radius.toFixed(1)} · Strength ${brush.strength.toFixed(1)} · ${brush.falloff}`;
  else if (currentTool === 'region') detail = worldEditor.isPasteArmed ? 'Paste armado · clique no terreno' : 'Arraste no terreno para selecionar uma região';
  activeToolChip.innerHTML = `<strong>${toolNames[currentTool]}</strong><span>${detail}</span>`;
}
const updateHistoryButtons = (): void => { undoButton.disabled = !worldEditor.canUndo(); redoButton.disabled = !worldEditor.canRedo(); };
const updateModeButtons = (mode: TransformMode): void => { currentMode = mode; appRoot.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.classList.toggle('active', currentTool === 'select' && button.dataset.transformMode === mode)); updateActiveToolChip(); };
const updateToolButtons = (tool: WorldAuthoringTool): void => { appRoot.querySelectorAll<HTMLElement>('[data-world-tool]').forEach((button) => button.classList.toggle('active', button.dataset.worldTool === tool)); updateActiveToolChip(); };

const worldEditor = new WorldEditor(engine, canvas, {
  onDocumentChanged: (document) => {
    currentMap.textContent = document.name; currentMap.title = `${document.name} · ${document.entities.length} objetos · ${document.terrain.heightStamps.length} terrain edits`;
    hierarchyPanel?.render(document, worldEditor.selectedEntityId); inspectorPanel?.render(worldEditor.getSelectedEntity()); authoringPanel?.render(currentTool, document); updateHistoryButtons(); updateActiveToolChip();
  },
  onSelectionChanged: (entity) => { hierarchyPanel?.render(worldEditor.document, entity?.id ?? null); inspectorPanel?.render(entity); if (entity && currentTool === 'select') editorWorkspace.setRightTab('inspector'); updateActiveToolChip(); },
  onModeChanged: updateModeButtons,
  onToolChanged: (tool) => { currentTool = tool; updateToolButtons(tool); editorWorkspace.focusForTool(tool); authoringPanel?.render(tool, worldEditor.document); },
  onStatus: setStatus,
});

function resetGameCameraToSpawn(): void {
  const spawn = worldEditor.document.spawn;
  const y = worldEditor.terrainHeightAt(spawn.x, spawn.z) + 1.8;
  editorCamera.setTarget(editorCamera.target.set(spawn.x, y, spawn.z));
  editorCamera.resetGameView();
  setStatus('Câmera restaurada para a composição padrão do gameplay.', 'success');
}

hierarchyPanel = new HierarchyPanel({ root: hierarchyHost, onSelect: (id) => { worldEditor.setAuthoringTool('select'); editorWorkspace.setRightTab('inspector'); worldEditor.select(id); }, onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });
inspectorPanel = new InspectorPanel({ root: inspectorHost, onRename: (name) => worldEditor.renameSelected(name), onTransform: (transform) => worldEditor.updateSelectedTransform(transform), onVisible: (visible) => worldEditor.setSelectedVisible(visible), onGrounding: (grounded, offset) => worldEditor.setSelectedGrounding(grounded, offset), onSnapGround: () => worldEditor.snapSelectedToGround(), onCollision: (mode, radius) => worldEditor.setSelectedCollision(mode, radius), onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });
authoringPanel = new WorldAuthoringPanel({ terrain: terrainHost, world: worldHost, layers: layersHost }, worldEditor, setStatus);

const projectDialog = new WorldProjectDialog(worldEditor);
const characterStudio = new CharacterStudio(setStatus);
const placement = new EditorAssetPlacement(engine, canvas, (x, y) => worldEditor.surfaceAt(x, y), (asset, position) => worldEditor.placeAsset(asset, position), setStatus);
const browser = new AssetBrowser({ root: assetDock, dropTarget: appRoot, onPlace: (asset) => { worldEditor.setAuthoringTool('select'); editorWorkspace.toggleAssetDock(false); void placement.activate(asset).catch((error: unknown) => setStatus(`Não foi possível preparar ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error')); }, onStatus: setStatus });
void Promise.all([browser.initialize(), authoringPanel.initialize(), worldEditor.initialize()]).then(() => { authoringPanel?.render(currentTool, worldEditor.document); resetGameCameraToSpawn(); }).catch((error: unknown) => setStatus(`Falha ao inicializar editor: ${error instanceof Error ? error.message : String(error)}`, 'error'));

type CameraDragMode = 'orbit' | 'pan';
let cameraDragMode: CameraDragMode | null = null;
let cameraPointerId: number | null = null;
let lastX = 0;
let lastY = 0;

function endCameraDrag(pointerId: number | null = cameraPointerId): void {
  if (pointerId !== null) {
    try { if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch { /* capture may already be released */ }
  }
  cameraDragMode = null;
  cameraPointerId = null;
  canvas.style.cursor = '';
}

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => {
  if (placement.isActive && event.button === 0) return;
  if (worldEditor.handleAuthoringPointerDown(event)) { canvas.setPointerCapture(event.pointerId); return; }
  if (event.button === 0 && !worldEditor.isTransformInteracting) worldEditor.selectFromPointer(event);
  if (worldEditor.isTransformInteracting) return;

  const pan = event.button === 1 || (event.button === 2 && event.shiftKey);
  const orbit = event.button === 2 && !event.shiftKey;
  if (!pan && !orbit) return;
  event.preventDefault();
  cameraDragMode = pan ? 'pan' : 'orbit';
  cameraPointerId = event.pointerId;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.style.cursor = cameraDragMode === 'orbit' ? 'grabbing' : 'move';
  try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer capture fallback */ }
});
canvas.addEventListener('pointermove', (event) => {
  worldEditor.handleAuthoringPointerMove(event);
  if (!cameraDragMode || event.pointerId !== cameraPointerId) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  if (cameraDragMode === 'orbit') editorCamera.orbitScreen(dx, dy);
  else editorCamera.panScreen(dx, dy);
});
canvas.addEventListener('pointerup', (event) => {
  worldEditor.handleAuthoringPointerUp(event);
  if (event.pointerId === cameraPointerId) endCameraDrag(event.pointerId);
  else if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', (event) => { if (event.pointerId === cameraPointerId) endCameraDrag(event.pointerId); });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); editorCamera.zoomByWheel(event.deltaY); }, { passive: false });
window.addEventListener('blur', () => endCameraDrag());

window.addEventListener('keydown', (event) => {
  const target = event.target; if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) void worldEditor.redo(); else void worldEditor.undo(); return; }
    if (event.code === 'KeyY') { event.preventDefault(); void worldEditor.redo(); return; }
    if (event.code === 'KeyD') { event.preventDefault(); void worldEditor.duplicateSelected(); return; }
  }
  if (event.code === 'KeyV') worldEditor.setAuthoringTool('select');
  if (event.code === 'KeyU') worldEditor.setAuthoringTool('region');
  if (event.code === 'KeyG') worldEditor.setMode('translate'); if (event.code === 'KeyR') worldEditor.setMode('rotate'); if (event.code === 'KeyS') worldEditor.setMode('scale');
  if (event.code === 'KeyF' && currentTool === 'select') worldEditor.focusSelected(); if (event.code === 'Delete' && currentTool === 'select') worldEditor.deleteSelected(); if (event.code === 'Escape' && !placement.isActive) worldEditor.setAuthoringTool('select');
  if (event.code === 'KeyQ') editorCamera.rotateQuarter(-1); if (event.code === 'KeyE') editorCamera.rotateQuarter(1);
});

appRoot.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.addEventListener('click', () => worldEditor.setMode(button.dataset.transformMode as TransformMode)));
appRoot.querySelectorAll<HTMLElement>('[data-world-tool]').forEach((button) => button.addEventListener('click', () => worldEditor.setAuthoringTool(button.dataset.worldTool as WorldAuthoringTool)));
required<HTMLElement>('[data-toolbar-compact]').addEventListener('click', () => editorWorkspace.toggleToolbar());
required<HTMLElement>('[data-layout-reset]').addEventListener('click', () => editorWorkspace.reset());
required<HTMLElement>('[data-game-camera]').addEventListener('click', resetGameCameraToSpawn);
required<HTMLElement>('[data-open-assets]').addEventListener('click', () => editorWorkspace.toggleAssetDock());
required<HTMLElement>('[data-open-character]').addEventListener('click', () => void characterStudio.open());
required<HTMLButtonElement>('[data-character-studio]').addEventListener('click', () => void characterStudio.open());
required<HTMLButtonElement>('[data-projects]').addEventListener('click', () => void projectDialog.open());
required<HTMLButtonElement>('[data-playtest]').addEventListener('click', () => { const playtestWindow = window.open('about:blank', 'ascension-playtest'); void worldEditor.preparePlaytest().then(() => { if (playtestWindow) playtestWindow.location.href = '/?playtest=1'; else window.open('/?playtest=1', 'ascension-playtest'); }); });
required<HTMLButtonElement>('[data-import-world]').addEventListener('click', () => worldFileInput.click());
undoButton.addEventListener('click', () => void worldEditor.undo()); redoButton.addEventListener('click', () => void worldEditor.redo());
worldFileInput.addEventListener('change', () => { const file = worldFileInput.files?.[0]; if (!file) return; void file.text().then((json) => worldEditor.importWorldJson(json)).catch((error: unknown) => setStatus(`Falha ao importar mapa: ${error instanceof Error ? error.message : String(error)}`, 'error')); worldFileInput.value = ''; });

engine.start();
window.addEventListener('beforeunload', () => { void worldEditor.saveCurrent(); placement.dispose(); browser.dispose(); characterStudio.dispose(); projectDialog.dispose(); authoringPanel?.dispose(); worldEditor.dispose(); engine.dispose(); });
