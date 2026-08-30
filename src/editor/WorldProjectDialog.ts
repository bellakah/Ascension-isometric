import type { WorldEditor } from './WorldEditor';

export class WorldProjectDialog {
  private readonly overlay = document.createElement('div');
  private readonly list: HTMLElement;
  private readonly settings: HTMLElement;

  constructor(private readonly editor: WorldEditor) {
    this.overlay.className = 'world-project-overlay';
    this.overlay.innerHTML = `
      <section class="world-project-dialog" role="dialog" aria-modal="true" aria-label="Gerenciador de mapas">
        <header><div><strong>Mapas do projeto</strong><span>Crie e organize múltiplos mundos locais.</span></div><button class="editor-button" data-close>Fechar</button></header>
        <div class="world-project-body">
          <aside class="world-project-list-wrap">
            <div class="world-project-actions"><button class="editor-button primary" data-new>Novo mapa</button><button class="editor-button" data-duplicate>Duplicar atual</button></div>
            <div class="world-project-list"></div>
          </aside>
          <section class="world-project-settings"></section>
        </div>
      </section>`;
    document.body.append(this.overlay);
    this.list = this.required('.world-project-list');
    this.settings = this.required('.world-project-settings');
    this.overlay.addEventListener('pointerdown', (event) => { if (event.target === this.overlay) this.close(); });
    this.required<HTMLButtonElement>('[data-close]').addEventListener('click', () => this.close());
    this.required<HTMLButtonElement>('[data-new]').addEventListener('click', () => void this.createWorld());
    this.required<HTMLButtonElement>('[data-duplicate]').addEventListener('click', () => void this.duplicateWorld());
  }

  async open(): Promise<void> {
    await this.render();
    this.overlay.classList.add('open');
  }

  close(): void { this.overlay.classList.remove('open'); }
  dispose(): void { this.overlay.remove(); }

  private async render(): Promise<void> {
    const worlds = await this.editor.listWorlds();
    this.list.innerHTML = '';
    for (const world of worlds) {
      const row = document.createElement('article');
      row.className = `world-project-item${world.id === this.editor.document.id ? ' active' : ''}`;
      row.innerHTML = `<button class="world-project-open" type="button"><strong>${this.escape(world.name)}</strong><span>${world.entityCount} entidades · ${new Date(world.updatedAt).toLocaleString()}</span></button><button class="world-project-delete" type="button" title="Excluir">×</button>`;
      row.querySelector<HTMLButtonElement>('.world-project-open')?.addEventListener('click', () => void this.editor.openWorld(world.id).then(() => this.render()));
      row.querySelector<HTMLButtonElement>('.world-project-delete')?.addEventListener('click', () => void this.deleteWorld(world.id, world.name));
      this.list.append(row);
    }
    this.renderSettings();
  }

  private renderSettings(): void {
    const world = this.editor.document;
    this.settings.innerHTML = `
      <div class="world-settings-title"><strong>Configurações do mapa</strong><span>${this.escape(world.id)}</span></div>
      <label>Nome<input data-name value="${this.escape(world.name)}"></label>
      <label>Descrição<textarea data-description rows="3">${this.escape(world.description)}</textarea></label>
      <fieldset><legend>Ponto de nascimento</legend><div class="world-vector"><label>X<input data-spawn-x type="number" step="0.5" value="${world.spawn.x}"></label><label>Y<input data-spawn-y type="number" step="0.5" value="${world.spawn.y}"></label><label>Z<input data-spawn-z type="number" step="0.5" value="${world.spawn.z}"></label></div></fieldset>
      <fieldset><legend>Ambiente</legend><label>Tamanho do chão<input data-ground-size type="number" min="10" max="1000" step="10" value="${world.environment.groundSize}"></label><div class="world-color-row"><label>Chão<input data-ground-color type="color" value="${world.environment.groundColor}"></label><label>Fundo<input data-background-color type="color" value="${world.environment.backgroundColor}"></label></div></fieldset>
      <div class="world-settings-actions"><button class="editor-button primary" data-apply>Aplicar configurações</button><button class="editor-button" data-export>Exportar JSON</button></div>`;
    this.settings.querySelector<HTMLButtonElement>('[data-apply]')?.addEventListener('click', () => void this.applySettings());
    this.settings.querySelector<HTMLButtonElement>('[data-export]')?.addEventListener('click', () => this.exportWorld());
  }

  private async createWorld(): Promise<void> {
    const name = window.prompt('Nome do novo mapa:', 'Novo mapa');
    if (!name?.trim()) return;
    await this.editor.createNewWorld(name);
    await this.render();
  }

  private async duplicateWorld(): Promise<void> {
    await this.editor.duplicateCurrentWorld();
    await this.render();
  }

  private async deleteWorld(id: string, name: string): Promise<void> {
    if (!window.confirm(`Excluir o mapa “${name}”? Esta ação não pode ser desfeita.`)) return;
    await this.editor.deleteWorld(id);
    await this.render();
  }

  private async applySettings(): Promise<void> {
    const value = (selector: string): string => this.settings.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? '';
    const number = (selector: string): number => Number(value(selector)) || 0;
    await this.editor.updateMapSettings({
      name: value('[data-name]'),
      description: value('[data-description]'),
      spawn: { x: number('[data-spawn-x]'), y: number('[data-spawn-y]'), z: number('[data-spawn-z]') },
      groundSize: number('[data-ground-size]'),
      groundColor: value('[data-ground-color]'),
      backgroundColor: value('[data-background-color]'),
    });
    await this.render();
  }

  private exportWorld(): void {
    const blob = new Blob([this.editor.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.editor.document.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'ascension-world'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private required<T extends Element>(selector: string): T {
    const element = this.overlay.querySelector<T>(selector);
    if (!element) throw new Error(`WorldProjectDialog element missing: ${selector}`);
    return element;
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
  }
}
