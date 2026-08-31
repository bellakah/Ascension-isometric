import * as THREE from 'three';
import type { EntityCollisionMode, SerializedVector3, WorldDocument, WorldEntityDocument } from '../world/WorldDocument';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function numberValue(value: string, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export interface HierarchyPanelOptions { root: HTMLElement; onSelect(id: string): void; onDuplicate(): void; onDelete(): void; onFocus(): void; }

export class HierarchyPanel {
  private document: WorldDocument | null = null;
  private selectedId: string | null = null;
  private search = '';

  constructor(private readonly options: HierarchyPanelOptions) {
    options.root.classList.add('hierarchy-panel');
    options.root.addEventListener('input', (event) => {
      const target = event.target; if (!(target instanceof HTMLInputElement) || !target.matches('[data-hierarchy-search]')) return;
      this.search = target.value.toLowerCase(); this.renderCurrent();
    });
  }

  render(document: WorldDocument, selectedId: string | null): void { this.document = document; this.selectedId = selectedId; this.renderCurrent(); }

  private renderCurrent(): void {
    const document = this.document;
    const entities = document?.entities.filter((entity) => !this.search || `${entity.name} ${entity.assetName}`.toLowerCase().includes(this.search)) ?? [];
    const blockerCount = document?.blockers.length ?? 0;
    const terrainEdits = document?.terrain.heightStamps.length ?? 0;
    const paintEdits = document?.terrain.paintStamps.length ?? 0;
    this.options.root.innerHTML = `
      <div class="panel-heading"><div><strong>Hierarchy</strong><span>${document?.entities.length ?? 0} objetos · ${blockerCount} blockers</span></div><div class="panel-actions"><button type="button" title="Duplicar selecionado" data-hierarchy-duplicate>⧉</button><button type="button" title="Focar selecionado" data-hierarchy-focus>◎</button><button type="button" title="Excluir selecionado" data-hierarchy-delete>⌫</button></div></div>
      <div class="hierarchy-search-wrap"><input type="search" data-hierarchy-search placeholder="Buscar na cena..." value="${escapeHtml(this.search)}"></div>
      <div class="hierarchy-list">
        <details class="hierarchy-section" open>
          <summary>Environment <span>3 itens</span></summary>
          <div class="hierarchy-virtual-row"><span>▱</span><b>Terrain</b><span>${terrainEdits + paintEdits} edits</span></div>
          <div class="hierarchy-virtual-row"><span>≈</span><b>Water</b><span>${document?.water.enabled ? 'on' : 'off'}</span></div>
          <div class="hierarchy-virtual-row"><span>✦</span><b>Spawn</b><span>${document ? `${document.spawn.x.toFixed(0)}, ${document.spawn.z.toFixed(0)}` : '-'}</span></div>
        </details>
        <details class="hierarchy-section" open>
          <summary>Objects <span>${entities.length}/${document?.entities.length ?? 0}</span></summary>
          ${entities.length === 0 ? '<p class="panel-empty">Nenhum objeto corresponde à busca.</p>' : entities.map((entity) => `
            <button type="button" class="hierarchy-row${entity.id === this.selectedId ? ' selected' : ''}" data-entity-id="${escapeHtml(entity.id)}"><span class="hierarchy-icon">◇</span><span class="hierarchy-copy"><strong>${escapeHtml(entity.name)}</strong><small>${escapeHtml(entity.assetName)}</small></span><span class="hierarchy-visibility">${entity.visible ? '●' : '○'}</span></button>`).join('')}
        </details>
        <details class="hierarchy-section" open>
          <summary>Gameplay <span>${blockerCount + 1} itens</span></summary>
          <div class="hierarchy-virtual-row"><span>✦</span><b>Player Spawn</b><span>1</span></div>
          <div class="hierarchy-virtual-row"><span>▰</span><b>Blockers</b><span>${blockerCount}</span></div>
        </details>
        <details class="hierarchy-section"><summary>Characters <span>futuro</span></summary><p class="panel-empty">NPCs e monstros serão organizados aqui quando entrarem no WorldDocument.</p></details>
      </div>`;
    this.options.root.querySelectorAll<HTMLElement>('[data-entity-id]').forEach((row) => { row.addEventListener('click', () => this.options.onSelect(row.dataset.entityId ?? '')); row.addEventListener('dblclick', () => this.options.onFocus()); });
    this.options.root.querySelector<HTMLElement>('[data-hierarchy-duplicate]')?.addEventListener('click', () => this.options.onDuplicate());
    this.options.root.querySelector<HTMLElement>('[data-hierarchy-focus]')?.addEventListener('click', () => this.options.onFocus());
    this.options.root.querySelector<HTMLElement>('[data-hierarchy-delete]')?.addEventListener('click', () => this.options.onDelete());
  }
}

export interface InspectorTransform { position: SerializedVector3; rotationDegrees: SerializedVector3; scale: SerializedVector3; }

export interface InspectorPanelOptions {
  root: HTMLElement;
  onRename(name: string): void;
  onTransform(transform: InspectorTransform): void;
  onVisible(visible: boolean): void;
  onGrounding(grounded: boolean, offset: number): void;
  onSnapGround(): void;
  onCollision(mode: EntityCollisionMode, radius?: number): void;
  onDuplicate(): void;
  onDelete(): void;
  onFocus(): void;
}

export class InspectorPanel {
  private entity: WorldEntityDocument | null = null;
  constructor(private readonly options: InspectorPanelOptions) { options.root.classList.add('inspector-panel'); }

  render(entity: WorldEntityDocument | null): void {
    this.entity = entity;
    if (!entity) {
      this.options.root.innerHTML = `<div class="panel-heading"><div><strong>Object Inspector</strong><span>Nenhuma seleção</span></div></div><div class="inspector-empty"><strong>Selecione um objeto</strong><span>Clique no viewport ou em Objects na Hierarchy. Terrain, World e Layers continuam disponíveis nas abas acima.</span></div>`;
      return;
    }
    const rotation = { x: THREE.MathUtils.radToDeg(entity.rotation.x), y: THREE.MathUtils.radToDeg(entity.rotation.y), z: THREE.MathUtils.radToDeg(entity.rotation.z) };
    this.options.root.innerHTML = `
      <div class="panel-heading"><div><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.assetName)}</span></div></div>
      <div class="inspector-scroll">
        <label class="inspector-field"><span>Nome</span><input type="text" data-name value="${escapeHtml(entity.name)}"></label>
        <div class="inspector-readonly"><span>Asset</span><code title="${escapeHtml(entity.assetId)}">${escapeHtml(entity.assetName)}</code></div>
        <label class="inspector-visible"><input type="checkbox" data-visible ${entity.visible ? 'checked' : ''}><span>Visível no mundo</span></label>
        ${this.vectorGroup('Posição', 'position', entity.position, 0.5)}
        ${this.vectorGroup('Rotação', 'rotation', rotation, 15)}
        ${this.vectorGroup('Escala', 'scale', entity.scale, 0.1)}
        <fieldset class="inspector-section"><legend>Terreno</legend><label class="inspector-visible"><input type="checkbox" data-grounded ${entity.grounded ? 'checked' : ''}><span>Fixar ao terreno (Grounded)</span></label><label class="inspector-field"><span>Ground Offset</span><input type="number" step="0.05" data-ground-offset value="${entity.groundOffset.toFixed(3)}"></label><button type="button" class="editor-button" data-snap-ground>Snap to Ground</button></fieldset>
        <fieldset class="inspector-section"><legend>Collision</legend><label class="inspector-field"><span>Modo</span><select data-collision-mode><option value="none"${entity.collision.mode === 'none' ? ' selected' : ''}>None</option><option value="auto"${entity.collision.mode === 'auto' ? ' selected' : ''}>Auto</option><option value="radius"${entity.collision.mode === 'radius' ? ' selected' : ''}>Radius</option></select></label>${entity.collision.mode === 'radius' ? `<label class="inspector-field"><span>Raio</span><input type="number" min="0.1" max="30" step="0.1" data-collision-radius value="${(entity.collision.radius ?? 1).toFixed(2)}"></label>` : ''}</fieldset>
        <div class="inspector-actions"><button type="button" class="editor-button" data-focus>Focar</button><button type="button" class="editor-button" data-duplicate>Duplicar</button><button type="button" class="editor-button danger" data-delete>Excluir</button></div>
      </div>`;
    this.options.root.querySelector<HTMLInputElement>('[data-name]')?.addEventListener('change', (event) => this.options.onRename((event.currentTarget as HTMLInputElement).value));
    this.options.root.querySelector<HTMLInputElement>('[data-visible]')?.addEventListener('change', (event) => this.options.onVisible((event.currentTarget as HTMLInputElement).checked));
    this.options.root.querySelectorAll<HTMLInputElement>('[data-vector]').forEach((input) => input.addEventListener('change', () => this.emitTransform()));
    const grounded = this.options.root.querySelector<HTMLInputElement>('[data-grounded]');
    const offset = this.options.root.querySelector<HTMLInputElement>('[data-ground-offset]');
    grounded?.addEventListener('change', () => this.options.onGrounding(grounded.checked, numberValue(offset?.value ?? '', entity.groundOffset)));
    offset?.addEventListener('change', () => this.options.onGrounding(grounded?.checked ?? entity.grounded, numberValue(offset.value, entity.groundOffset)));
    this.options.root.querySelector<HTMLElement>('[data-snap-ground]')?.addEventListener('click', () => this.options.onSnapGround());
    const collisionMode = this.options.root.querySelector<HTMLSelectElement>('[data-collision-mode]');
    collisionMode?.addEventListener('change', () => this.options.onCollision(collisionMode.value as EntityCollisionMode, numberValue(this.options.root.querySelector<HTMLInputElement>('[data-collision-radius]')?.value ?? '', entity.collision.radius ?? 1)));
    this.options.root.querySelector<HTMLInputElement>('[data-collision-radius]')?.addEventListener('change', (event) => this.options.onCollision('radius', numberValue((event.currentTarget as HTMLInputElement).value, entity.collision.radius ?? 1)));
    this.options.root.querySelector<HTMLElement>('[data-focus]')?.addEventListener('click', () => this.options.onFocus());
    this.options.root.querySelector<HTMLElement>('[data-duplicate]')?.addEventListener('click', () => this.options.onDuplicate());
    this.options.root.querySelector<HTMLElement>('[data-delete]')?.addEventListener('click', () => this.options.onDelete());
  }

  private vectorGroup(label: string, key: string, value: SerializedVector3, step: number): string {
    return `<fieldset class="inspector-vector-group"><legend>${label}</legend><label><span>X</span><input type="number" data-vector="${key}" data-axis="x" step="${step}" value="${value.x.toFixed(3)}"></label><label><span>Y</span><input type="number" data-vector="${key}" data-axis="y" step="${step}" value="${value.y.toFixed(3)}"></label><label><span>Z</span><input type="number" data-vector="${key}" data-axis="z" step="${step}" value="${value.z.toFixed(3)}"></label></fieldset>`;
  }

  private emitTransform(): void {
    const entity = this.entity; if (!entity) return;
    const read = (group: string, axis: keyof SerializedVector3, fallback: number): number => numberValue(this.options.root.querySelector<HTMLInputElement>(`[data-vector="${group}"][data-axis="${axis}"]`)?.value ?? '', fallback);
    this.options.onTransform({ position: { x: read('position', 'x', entity.position.x), y: read('position', 'y', entity.position.y), z: read('position', 'z', entity.position.z) }, rotationDegrees: { x: read('rotation', 'x', THREE.MathUtils.radToDeg(entity.rotation.x)), y: read('rotation', 'y', THREE.MathUtils.radToDeg(entity.rotation.y)), z: read('rotation', 'z', THREE.MathUtils.radToDeg(entity.rotation.z)) }, scale: { x: read('scale', 'x', entity.scale.x), y: read('scale', 'y', entity.scale.y), z: read('scale', 'z', entity.scale.z) } });
  }
}
