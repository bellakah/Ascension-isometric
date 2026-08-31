import type { WorldAuthoringTool } from './WorldEditor';

export type EditorRightTab = 'inspector' | 'terrain' | 'world' | 'layers';

interface WorkspaceState {
  hierarchyWidth: number;
  inspectorWidth: number;
  assetHeight: number;
  assetCollapsed: boolean;
  toolbarCompact: boolean;
  rightTab: EditorRightTab;
}

const STORAGE_KEY = 'ascension-editor-workspace-v1';
const DEFAULT_STATE: WorkspaceState = {
  hierarchyWidth: 240,
  inspectorWidth: 330,
  assetHeight: 220,
  assetCollapsed: true,
  toolbarCompact: false,
  rightTab: 'inspector',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadState(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    return {
      hierarchyWidth: clamp(Number(parsed.hierarchyWidth ?? DEFAULT_STATE.hierarchyWidth), 170, 420),
      inspectorWidth: clamp(Number(parsed.inspectorWidth ?? DEFAULT_STATE.inspectorWidth), 260, 460),
      assetHeight: clamp(Number(parsed.assetHeight ?? DEFAULT_STATE.assetHeight), 140, 520),
      assetCollapsed: parsed.assetCollapsed ?? DEFAULT_STATE.assetCollapsed,
      toolbarCompact: parsed.toolbarCompact ?? DEFAULT_STATE.toolbarCompact,
      rightTab: parsed.rightTab === 'terrain' || parsed.rightTab === 'world' || parsed.rightTab === 'layers' ? parsed.rightTab : 'inspector',
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export interface EditorWorkspaceOptions {
  shell: HTMLElement;
  workspace: HTMLElement;
  assetDock: HTMLElement;
  assetResizer: HTMLElement;
  leftSplitter: HTMLElement;
  rightSplitter: HTMLElement;
  toolrail: HTMLElement;
  tabButtons: NodeListOf<HTMLElement>;
  tabPanes: NodeListOf<HTMLElement>;
}

export class EditorWorkspace {
  private state = loadState();

  constructor(private readonly options: EditorWorkspaceOptions) {
    this.apply();
    this.bindHorizontalSplitter(options.leftSplitter, 'hierarchyWidth', 170, 420, 1);
    this.bindHorizontalSplitter(options.rightSplitter, 'inspectorWidth', 260, 460, -1);
    this.bindAssetSplitter();
    options.tabButtons.forEach((button) => button.addEventListener('click', () => this.setRightTab(button.dataset.rightTab as EditorRightTab)));
    options.assetDock.addEventListener('asset-dock-toggle', () => this.toggleAssetDock());
  }

  get rightTab(): EditorRightTab { return this.state.rightTab; }
  get assetCollapsed(): boolean { return this.state.assetCollapsed; }

  setRightTab(tab: EditorRightTab): void {
    this.state.rightTab = tab;
    this.options.tabButtons.forEach((button) => {
      const active = button.dataset.rightTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    this.options.tabPanes.forEach((pane) => pane.classList.toggle('active', pane.dataset.rightPane === tab));
    this.persist();
  }

  focusForTool(tool: WorldAuthoringTool): void {
    if (tool === 'raise' || tool === 'lower' || tool === 'smooth' || tool === 'flatten' || tool === 'paint' || tool === 'erase') this.setRightTab('terrain');
    else if (tool === 'water' || tool === 'spawn' || tool === 'blocker') this.setRightTab('world');
  }

  toggleAssetDock(force?: boolean): void {
    this.state.assetCollapsed = force ?? !this.state.assetCollapsed;
    this.applyAssetState();
    this.persist();
  }

  toggleToolbar(): void {
    this.state.toolbarCompact = !this.state.toolbarCompact;
    this.applyToolbarState();
    this.persist();
  }

  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.apply();
    this.persist();
  }

  private apply(): void {
    this.options.workspace.style.setProperty('--hierarchy-width', `${this.state.hierarchyWidth}px`);
    this.options.workspace.style.setProperty('--inspector-width', `${this.state.inspectorWidth}px`);
    this.options.shell.style.setProperty('--asset-dock-height', `${this.state.assetHeight}px`);
    this.applyAssetState();
    this.applyToolbarState();
    this.setRightTab(this.state.rightTab);
  }

  private applyAssetState(): void {
    this.options.shell.classList.toggle('asset-collapsed', this.state.assetCollapsed);
    this.options.assetDock.classList.toggle('collapsed', this.state.assetCollapsed);
    this.options.assetDock.querySelectorAll<HTMLElement>('[data-asset-collapse-label]').forEach((element) => {
      element.textContent = this.state.assetCollapsed ? 'Abrir' : 'Recolher';
    });
  }

  private applyToolbarState(): void {
    this.options.toolrail.classList.toggle('compact', this.state.toolbarCompact);
    const toggle = this.options.toolrail.querySelector<HTMLElement>('[data-toolbar-compact]');
    if (toggle) toggle.title = this.state.toolbarCompact ? 'Expandir ferramentas' : 'Recolher ferramentas';
  }

  private bindHorizontalSplitter(
    splitter: HTMLElement,
    key: 'hierarchyWidth' | 'inspectorWidth',
    min: number,
    max: number,
    direction: 1 | -1,
  ): void {
    splitter.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startValue = this.state[key];
      splitter.setPointerCapture(event.pointerId);
      document.body.classList.add('editor-resizing');
      const move = (moveEvent: PointerEvent): void => {
        this.state[key] = clamp(startValue + (moveEvent.clientX - startX) * direction, min, max);
        const property = key === 'hierarchyWidth' ? '--hierarchy-width' : '--inspector-width';
        this.options.workspace.style.setProperty(property, `${this.state[key]}px`);
      };
      const up = (upEvent: PointerEvent): void => {
        splitter.removeEventListener('pointermove', move);
        splitter.removeEventListener('pointerup', up);
        if (splitter.hasPointerCapture(upEvent.pointerId)) splitter.releasePointerCapture(upEvent.pointerId);
        document.body.classList.remove('editor-resizing');
        this.persist();
      };
      splitter.addEventListener('pointermove', move);
      splitter.addEventListener('pointerup', up);
    });
  }

  private bindAssetSplitter(): void {
    const splitter = this.options.assetResizer;
    splitter.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.state.assetCollapsed) this.toggleAssetDock(false);
      const startY = event.clientY;
      const startHeight = this.state.assetHeight;
      splitter.setPointerCapture(event.pointerId);
      document.body.classList.add('editor-resizing');
      const move = (moveEvent: PointerEvent): void => {
        this.state.assetHeight = clamp(startHeight + (startY - moveEvent.clientY), 140, Math.min(520, window.innerHeight * 0.65));
        this.options.shell.style.setProperty('--asset-dock-height', `${this.state.assetHeight}px`);
      };
      const up = (upEvent: PointerEvent): void => {
        splitter.removeEventListener('pointermove', move);
        splitter.removeEventListener('pointerup', up);
        if (splitter.hasPointerCapture(upEvent.pointerId)) splitter.releasePointerCapture(upEvent.pointerId);
        document.body.classList.remove('editor-resizing');
        this.persist();
      };
      splitter.addEventListener('pointermove', move);
      splitter.addEventListener('pointerup', up);
    });
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* best effort */ }
  }
}
