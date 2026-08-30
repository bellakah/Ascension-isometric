import '../styles.css';
import './editor.css';
import './zip-import.css';
import './world-editor.css';
import './world-project.css';
import './character-studio.css';
import { AssetBrowser } from './AssetBrowser';
import { CharacterStudio } from './CharacterStudio';
import { EditorAssetPlacement } from './EditorAssetPlacement';
import { HierarchyPanel, InspectorPanel } from './EditorPanels';
import { WorldEditor, type TransformMode } from './WorldEditor';
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
          <div class="brand"><div class="brand-mark">A</div><div class="brand-copy"><h1 class="brand-title">Ascension World Editor</h1><p class="brand-subtitle">v0.5.0 · Character Studio · Universal Character Rig</p></div></div>
          <div class="editor-top-actions">
            <span class="current-map-badge" data-current-map>Mapa</span><span class="editor-status" data-tone="normal">Editor pronto.</span>
            <button class="editor-button compact" type="button" data-undo title="Desfazer (Ctrl+Z)">↶</button><button class="editor-button compact" type="button" data-redo title="Refazer (Ctrl+Y)">↷</button>
            <button class="editor-button" type="button" data-projects>Mapas</button><button class="editor-button" type="button" data-character-studio>Personagem</button><button class="editor-button" type="button" data-import-world>Importar JSON</button>
            <input type="file" accept=".json,application/json" data-world-file hidden><button class="editor-button playtest" type="button" data-playtest>▶ Playtest</button>
          </div>
        </header>
        <aside class="editor-toolrail" aria-label="Ferramentas de transformação">
          <button class="tool-button active" type="button" title="Mover (G)" data-transform-mode="translate">↔<span>Mover (G)</span></button>
          <button class="tool-button" type="button" title="Rotacionar (R)" data-transform-mode="rotate">⟳<span>Rotacionar (R)</span></button>
          <button class="tool-button" type="button" title="Escalar (S)" data-transform-mode="scale">⤢<span>Escalar (S)</span></button>
          <button class="tool-button" type="button" title="Assets" data-open-assets>▦<span>Assets</span></button>
          <button class="tool-button" type="button" title="Character Studio" data-open-character>♟<span>Personagem</span></button>
        </aside>
        <div class="editor-hint"><strong>G/R/S</strong> gizmo · <strong>F</strong> focar · <strong>Ctrl+D</strong> duplicar · <strong>Delete</strong> excluir · <strong>Ctrl+Z/Y</strong> undo/redo · <strong>Q/E</strong> câmera</div>
      </section>
      <aside class="inspector-host" aria-label="Inspector da entidade"></aside>
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

const engine = new Engine(canvas);
engine.camera.setTarget(engine.camera.target.set(0, 0, 0));
let hierarchyPanel: HierarchyPanel | null = null;
let inspectorPanel: InspectorPanel | null = null;
const updateHistoryButtons = (): void => { undoButton.disabled = !worldEditor.canUndo(); redoButton.disabled = !worldEditor.canRedo(); };
const updateModeButtons = (mode: TransformMode): void => { root.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.classList.toggle('active', button.dataset.transformMode === mode)); };

const worldEditor = new WorldEditor(engine, canvas, {
  onDocumentChanged: (document) => { currentMap.textContent = document.name; currentMap.title = `${document.name} · ${document.entities.length} entidades`; hierarchyPanel?.render(document, worldEditor.selectedEntityId); inspectorPanel?.render(worldEditor.getSelectedEntity()); updateHistoryButtons(); },
  onSelectionChanged: (entity) => { hierarchyPanel?.render(worldEditor.document, entity?.id ?? null); inspectorPanel?.render(entity); },
  onModeChanged: updateModeButtons,
  onStatus: setStatus,
});

hierarchyPanel = new HierarchyPanel({ root: hierarchyHost, onSelect: (id) => worldEditor.select(id), onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });
inspectorPanel = new InspectorPanel({ root: inspectorHost, onRename: (name) => worldEditor.renameSelected(name), onTransform: (transform) => worldEditor.updateSelectedTransform(transform), onVisible: (visible) => worldEditor.setSelectedVisible(visible), onDuplicate: () => void worldEditor.duplicateSelected(), onDelete: () => worldEditor.deleteSelected(), onFocus: () => worldEditor.focusSelected() });

const projectDialog = new WorldProjectDialog(worldEditor);
const characterStudio = new CharacterStudio(setStatus);
const placement = new EditorAssetPlacement(engine, canvas, (asset, position) => worldEditor.placeAsset(asset, position), setStatus);
const browser = new AssetBrowser({ root: assetDock, dropTarget: root, onPlace: (asset) => void placement.activate(asset).catch((error: unknown) => setStatus(`Não foi possível preparar ${asset.name}: ${error instanceof Error ? error.message : String(error)}`, 'error')), onStatus: setStatus });
void Promise.all([browser.initialize(), worldEditor.initialize()]).catch((error: unknown) => setStatus(`Falha ao inicializar editor: ${error instanceof Error ? error.message : String(error)}`, 'error'));

let cameraDragging = false; let lastX = 0; let lastY = 0;
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerdown', (event) => { if (event.button === 0 && !placement.isActive && !worldEditor.isTransformInteracting) worldEditor.selectFromPointer(event); if (event.button !== 2 || worldEditor.isTransformInteracting) return; cameraDragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => { if (!cameraDragging) return; const dx = event.clientX - lastX; const dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY; engine.camera.panScreen(dx, dy); });
canvas.addEventListener('pointerup', (event) => { if (event.button !== 2) return; cameraDragging = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); engine.camera.zoomByWheel(event.deltaY); }, { passive: false });

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.code === 'KeyZ') { event.preventDefault(); if (event.shiftKey) void worldEditor.redo(); else void worldEditor.undo(); return; }
    if (event.code === 'KeyY') { event.preventDefault(); void worldEditor.redo(); return; }
    if (event.code === 'KeyD') { event.preventDefault(); void worldEditor.duplicateSelected(); return; }
  }
  if (event.code === 'KeyG') worldEditor.setMode('translate'); if (event.code === 'KeyR') worldEditor.setMode('rotate'); if (event.code === 'KeyS') worldEditor.setMode('scale');
  if (event.code === 'KeyF') worldEditor.focusSelected(); if (event.code === 'Delete') worldEditor.deleteSelected(); if (event.code === 'Escape' && !placement.isActive) worldEditor.clearSelection();
  if (event.code === 'KeyQ') engine.camera.rotateQuarter(-1); if (event.code === 'KeyE') engine.camera.rotateQuarter(1);
});

root.querySelectorAll<HTMLElement>('[data-transform-mode]').forEach((button) => button.addEventListener('click', () => worldEditor.setMode(button.dataset.transformMode as TransformMode)));
root.querySelector<HTMLElement>('[data-open-assets]')?.addEventListener('click', () => assetDock.classList.toggle('collapsed'));
root.querySelector<HTMLElement>('[data-open-character]')?.addEventListener('click', () => void characterStudio.open());
root.querySelector<HTMLButtonElement>('[data-character-studio]')?.addEventListener('click', () => void characterStudio.open());
root.querySelector<HTMLButtonElement>('[data-projects]')?.addEventListener('click', () => void projectDialog.open());
root.querySelector<HTMLButtonElement>('[data-playtest]')?.addEventListener('click', () => void worldEditor.preparePlaytest().then(() => window.open('/?playtest=1', 'ascension-playtest')));
root.querySelector<HTMLButtonElement>('[data-import-world]')?.addEventListener('click', () => worldFileInput.click());
undoButton.addEventListener('click', () => void worldEditor.undo()); redoButton.addEventListener('click', () => void worldEditor.redo());
worldFileInput.addEventListener('change', () => { const file = worldFileInput.files?.[0]; if (!file) return; void file.text().then((json) => worldEditor.importWorldJson(json)).catch((error: unknown) => setStatus(`Falha ao importar mapa: ${error instanceof Error ? error.message : String(error)}`, 'error')); worldFileInput.value = ''; });

engine.start();
window.addEventListener('beforeunload', () => { void worldEditor.saveCurrent(); placement.dispose(); browser.dispose(); characterStudio.dispose(); projectDialog.dispose(); worldEditor.dispose(); engine.dispose(); });
