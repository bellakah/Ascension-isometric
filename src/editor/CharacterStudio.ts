import { AssetDatabase } from '../assets/AssetDatabase';
import type { AssetRecord } from '../assets/types';
import { CharacterDatabase } from '../character/CharacterDatabase';
import {
  cloneCharacterPreset,
  createCharacterPreset,
  createEquipmentAttachment,
  duplicateCharacterPreset,
  touchCharacterPreset,
  type CharacterAssetRef,
  type CharacterEquipmentSlot,
  type CharacterPreset,
  type CharacterVector3,
  type CharacterVisualSlot,
  type CharacterWeaponProfile,
} from '../character/CharacterPreset';
import {
  characterAssetGender,
  inferCharacterAssetRole,
  isRiggedHairAsset,
  isRootMotionAsset,
  type CharacterAssetRole,
} from '../character/characterAssetRoles';
import { CharacterPreview } from './CharacterPreview';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function ref(asset: AssetRecord | undefined): CharacterAssetRef | undefined {
  return asset ? { assetId: asset.id, assetName: asset.name } : undefined;
}

function labelFor(asset: AssetRecord): string {
  const gender = characterAssetGender(asset);
  const genderLabel = gender === 'male' ? 'M' : gender === 'female' ? 'F' : '—';
  return `${asset.name} · ${genderLabel} · ${asset.format.toUpperCase()}`;
}

function chooseClip(names: string[], preferred: string[]): string {
  for (const candidate of preferred) if (names.includes(candidate)) return candidate;
  const lower = names.map((name) => name.toLowerCase());
  for (const candidate of preferred) {
    const index = lower.findIndex((name) => name.includes(candidate.toLowerCase()));
    if (index >= 0) return names[index] ?? '';
  }
  return names[0] ?? '';
}

function profileLabel(profile: CharacterWeaponProfile): string {
  if (profile === 'one-handed') return 'Uma mão';
  if (profile === 'two-handed') return 'Duas mãos';
  if (profile === 'bow') return 'Arco';
  if (profile === 'staff') return 'Cajado';
  return 'Desarmado';
}

export class CharacterStudio {
  private readonly assetDatabase = new AssetDatabase();
  private readonly characterDatabase = new CharacterDatabase();
  private readonly modal: HTMLElement;
  private readonly presetList: HTMLElement;
  private readonly form: HTMLElement;
  private readonly activeLabel: HTMLElement;
  private readonly preview: CharacterPreview;
  private assets: AssetRecord[] = [];
  private presets: CharacterPreset[] = [];
  private activeId: string | null = null;
  private selectedId: string | null = null;
  private draft: CharacterPreset = createCharacterPreset();
  private previewToken = 0;
  private previewTimer = 0;

  constructor(private readonly onStatus: (message: string, tone?: 'normal' | 'success' | 'error') => void) {
    this.modal = document.createElement('section');
    this.modal.className = 'character-studio-modal';
    this.modal.hidden = true;
    this.modal.innerHTML = `
      <div class="character-studio-shell" role="dialog" aria-modal="true" aria-label="Character Studio">
        <header class="character-studio-header">
          <div><strong>Character Studio</strong><span>v0.6 · Equipment sockets · Combat animation state machine</span></div>
          <div class="character-studio-header-actions">
            <span class="character-active-label"></span>
            <button class="editor-button" type="button" data-character-new>Novo</button>
            <button class="editor-button" type="button" data-character-duplicate>Duplicar</button>
            <button class="editor-button danger" type="button" data-character-delete>Excluir</button>
            <button class="editor-button" type="button" data-character-close>Fechar</button>
          </div>
        </header>
        <div class="character-studio-body">
          <aside class="character-preset-pane">
            <div class="character-pane-title"><strong>Presets</strong><span data-preset-count>0</span></div>
            <div class="character-preset-list"></div>
          </aside>
          <section class="character-form-pane"><div class="character-form"></div></section>
          <aside class="character-preview-pane">
            <canvas class="character-preview-canvas"></canvas>
            <div class="character-preview-toolbar"><select data-preview-clip aria-label="Animação de preview"></select><button class="editor-button" type="button" data-preview-play>Tocar</button></div>
            <div class="character-rig-note"><strong>Rig + Equipment</strong><span>Armas são anexadas diretamente aos bones do Universal Rig. Ajuste posição, rotação e escala por slot olhando o preview.</span></div>
          </aside>
        </div>
      </div>`;
    document.body.append(this.modal);
    this.presetList = this.required<HTMLElement>('.character-preset-list');
    this.form = this.required<HTMLElement>('.character-form');
    this.activeLabel = this.required<HTMLElement>('.character-active-label');
    this.preview = new CharacterPreview(this.required<HTMLCanvasElement>('.character-preview-canvas'));
    this.required<HTMLButtonElement>('[data-character-close]').addEventListener('click', () => this.close());
    this.required<HTMLButtonElement>('[data-character-new]').addEventListener('click', () => this.newPreset());
    this.required<HTMLButtonElement>('[data-character-duplicate]').addEventListener('click', () => void this.duplicatePreset());
    this.required<HTMLButtonElement>('[data-character-delete]').addEventListener('click', () => void this.deletePreset());
    this.required<HTMLButtonElement>('[data-preview-play]').addEventListener('click', () => {
      const select = this.required<HTMLSelectElement>('[data-preview-clip]');
      if (select.value) this.preview.playClip(select.value);
    });
    this.modal.addEventListener('pointerdown', (event) => { if (event.target === this.modal) this.close(); });
    window.addEventListener('keydown', this.handleKeyDown);
  }

  async open(): Promise<void> {
    this.assets = await this.assetDatabase.list();
    this.presets = await this.characterDatabase.list();
    this.activeId = await this.characterDatabase.getActiveId();
    if (this.selectedId) {
      const selected = this.presets.find((preset) => preset.id === this.selectedId);
      if (selected) this.draft = cloneCharacterPreset(selected); else this.selectedId = null;
    }
    if (!this.selectedId) {
      const active = this.activeId ? this.presets.find((preset) => preset.id === this.activeId) : undefined;
      const first = active ?? this.presets[0];
      if (first) { this.selectedId = first.id; this.draft = cloneCharacterPreset(first); } else this.newPreset(false);
    }
    this.modal.hidden = false;
    this.render();
    this.schedulePreview();
  }

  close(): void { this.modal.hidden = true; }

  dispose(): void {
    if (this.previewTimer) window.clearTimeout(this.previewTimer);
    ++this.previewToken;
    this.preview.dispose();
    window.removeEventListener('keydown', this.handleKeyDown);
    this.modal.remove();
  }

  private newPreset(render = true): void {
    const preset = createCharacterPreset(`Personagem ${this.presets.length + 1}`);
    const bases = this.assetsFor('base');
    if (bases[0]) { preset.base = ref(bases[0]); preset.gender = characterAssetGender(bases[0]); }
    const libraries = this.assetsFor('animation').filter((asset) => !isRootMotionAsset(asset));
    preset.animationLibraries = libraries
      .filter((asset) => asset.sourcePackId === 'quaternius-universal-animation-library' || asset.sourcePackId === 'quaternius-universal-animation-library-2')
      .map((asset) => ref(asset)!)
      .slice(0, 2);
    this.applyClipDefaults(preset, true);
    this.selectedId = null;
    this.draft = preset;
    if (render) { this.render(); this.schedulePreview(); }
  }

  private async duplicatePreset(): Promise<void> {
    const saved = this.presets.find((preset) => preset.id === this.selectedId);
    if (!saved) return;
    const copy = duplicateCharacterPreset(saved);
    await this.characterDatabase.put(copy);
    this.selectedId = copy.id;
    this.draft = cloneCharacterPreset(copy);
    await this.reloadPresets();
    this.onStatus(`${copy.name} duplicado.`, 'success');
  }

  private async deletePreset(): Promise<void> {
    if (!this.selectedId) return;
    const preset = this.presets.find((candidate) => candidate.id === this.selectedId);
    if (!preset || !window.confirm(`Excluir o preset ${preset.name}?`)) return;
    await this.characterDatabase.delete(preset.id);
    this.selectedId = null;
    this.activeId = await this.characterDatabase.getActiveId();
    await this.reloadPresets(false);
    if (this.presets[0]) { this.selectedId = this.presets[0].id; this.draft = cloneCharacterPreset(this.presets[0]); } else this.newPreset(false);
    this.render();
    this.schedulePreview();
    this.onStatus(`${preset.name} removido.`, 'success');
  }

  private async savePreset(makeActive: boolean): Promise<void> {
    if (!this.draft.base) { this.onStatus('Selecione um Universal Base Character antes de salvar.', 'error'); return; }
    touchCharacterPreset(this.draft);
    await this.characterDatabase.put(this.draft);
    this.selectedId = this.draft.id;
    if (makeActive) { await this.characterDatabase.setActiveId(this.draft.id); this.activeId = this.draft.id; }
    await this.reloadPresets(false);
    this.render();
    this.onStatus(makeActive ? `${this.draft.name} salvo e definido como personagem jogável.` : `${this.draft.name} salvo.`, 'success');
  }

  private async reloadPresets(render = true): Promise<void> {
    this.presets = await this.characterDatabase.list();
    this.activeId = await this.characterDatabase.getActiveId();
    if (render) this.render();
  }

  private render(): void {
    this.renderPresetList();
    this.renderForm();
    const active = this.activeId ? this.presets.find((preset) => preset.id === this.activeId) : undefined;
    this.activeLabel.textContent = active ? `Ativo: ${active.name}` : 'Nenhum personagem ativo';
    this.required<HTMLElement>('[data-preset-count]').textContent = `${this.presets.length}`;
    this.renderPreviewClips();
  }

  private renderPresetList(): void {
    if (this.presets.length === 0) { this.presetList.innerHTML = '<div class="character-empty">Nenhum preset salvo ainda.</div>'; return; }
    this.presetList.innerHTML = '';
    for (const preset of this.presets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `character-preset-card${preset.id === this.selectedId ? ' selected' : ''}${preset.id === this.activeId ? ' active' : ''}`;
      button.innerHTML = `<span class="character-preset-name">${escapeHtml(preset.name)}</span><span class="character-preset-meta">${preset.gender} · ${profileLabel(preset.combat.profile)} · ${preset.animationLibraries.length} biblioteca(s)</span>${preset.id === this.activeId ? '<span class="character-active-chip">PLAYTEST</span>' : ''}`;
      button.addEventListener('click', () => { this.selectedId = preset.id; this.draft = cloneCharacterPreset(preset); this.render(); this.schedulePreview(); });
      this.presetList.append(button);
    }
  }

  private renderForm(): void {
    const bases = this.assetsFor('base');
    const hairs = this.assetsFor('hair').sort((a, b) => Number(isRiggedHairAsset(b)) - Number(isRiggedHairAsset(a)));
    const outfits = this.assetsFor('outfit');
    const body = this.assetsFor('body'); const arms = this.assetsFor('arms'); const legs = this.assetsFor('legs'); const feet = this.assetsFor('feet'); const headgear = this.assetsFor('headgear'); const accessory = this.assetsFor('accessory');
    const animations = this.assetsFor('animation').filter((asset) => !isRootMotionAsset(asset));
    const equipmentAssets = this.assets.filter((asset) => ['weapon', 'shield'].includes(inferCharacterAssetRole(asset))).sort((a, b) => a.name.localeCompare(b.name));
    const clipNames = this.selectedClipNames();

    this.form.innerHTML = `
      <section class="character-section">
        <div class="character-section-heading"><div><strong>Identidade</strong><span>Preset usado pelo runtime do personagem.</span></div><div class="character-form-actions"><button class="editor-button" type="button" data-save-character>Salvar</button><button class="editor-button primary" type="button" data-activate-character>Salvar + Usar no jogo</button></div></div>
        <label class="character-field"><span>Nome</span><input type="text" data-character-name value="${escapeHtml(this.draft.name)}"></label>
        <div class="character-row">
          <label class="character-field"><span>Gênero do preset</span><select data-character-gender><option value="unspecified"${this.draft.gender === 'unspecified' ? ' selected' : ''}>Não definido</option><option value="male"${this.draft.gender === 'male' ? ' selected' : ''}>Masculino</option><option value="female"${this.draft.gender === 'female' ? ' selected' : ''}>Feminino</option></select></label>
          <label class="character-field"><span>Base sob a roupa</span><select data-base-mode><option value="full"${this.draft.baseMode === 'full' ? ' selected' : ''}>Corpo completo</option><option value="head-only"${this.draft.baseMode === 'head-only' ? ' selected' : ''}>Cabeça somente</option></select></label>
        </div>
      </section>
      <section class="character-section"><div class="character-section-heading"><div><strong>Corpo base</strong><span>Universal Base Characters.</span></div></div>${this.assetSelect('Base Character', 'base', bases, this.draft.base?.assetId)}${this.assetSelect('Cabelo / barba', 'hair', hairs, this.draft.visuals.hair?.assetId, true)}</section>
      <section class="character-section"><div class="character-section-heading"><div><strong>Equipamento visual</strong><span>Outfit completo ou peças modulares.</span></div></div>${this.assetSelect('Outfit completo', 'outfit', outfits, this.draft.visuals.outfit?.assetId, true)}<div class="character-modular-grid">${this.assetSelect('Torso', 'body', body, this.draft.visuals.body?.assetId, true)}${this.assetSelect('Braços', 'arms', arms, this.draft.visuals.arms?.assetId, true)}${this.assetSelect('Pernas', 'legs', legs, this.draft.visuals.legs?.assetId, true)}${this.assetSelect('Pés', 'feet', feet, this.draft.visuals.feet?.assetId, true)}${this.assetSelect('Cabeça / hood', 'headgear', headgear, this.draft.visuals.headgear?.assetId, true)}${this.assetSelect('Acessório', 'accessory', accessory, this.draft.visuals.accessory?.assetId, true)}</div></section>
      <section class="character-section">
        <div class="character-section-heading"><div><strong>Armas e sockets</strong><span>Main hand, off hand e costas ligados aos bones do rig.</span></div></div>
        ${equipmentAssets.length === 0 ? '<span class="character-empty-inline">Importe um pack de armas no Asset Browser. KayKit Fantasy Weapons já é compatível.</span>' : ''}
        ${this.equipmentSlot('Mão principal', 'mainHand', equipmentAssets)}
        ${this.equipmentSlot('Mão secundária', 'offHand', equipmentAssets)}
        ${this.equipmentSlot('Costas', 'back', equipmentAssets)}
      </section>
      <section class="character-section">
        <div class="character-section-heading"><div><strong>Locomoção e bibliotecas</strong><span>UAL1/UAL2 sem root motion.</span></div></div>
        <div class="character-animation-libraries">${animations.length === 0 ? '<span class="character-empty-inline">Importe UAL1/UAL2 pelo Asset Browser.</span>' : animations.map((asset) => { const checked = this.draft.animationLibraries.some((entry) => entry.assetId === asset.id); return `<label><input type="checkbox" data-animation-library="${asset.id}"${checked ? ' checked' : ''}><span>${escapeHtml(asset.name)}</span><small>${asset.animations.length} clips</small></label>`; }).join('')}</div>
        <div class="character-row character-clips">${this.clipSelect('Idle', 'motion:idle', clipNames, this.draft.clips.idle)}${this.clipSelect('Walk', 'motion:walk', clipNames, this.draft.clips.walk)}${this.clipSelect('Run', 'motion:run', clipNames, this.draft.clips.run)}</div>
      </section>
      <section class="character-section character-combat-section">
        <div class="character-section-heading"><div><strong>Combat Animation State Machine</strong><span>Attack → combo window → recover. Bloqueio é um estado separado.</span></div></div>
        <label class="character-field"><span>Perfil de arma</span><select data-combat-profile>${(['unarmed','one-handed','two-handed','bow','staff'] as const).map((profile) => `<option value="${profile}"${profile === this.draft.combat.profile ? ' selected' : ''}>${profileLabel(profile)}</option>`).join('')}</select></label>
        <div class="character-combat-grid">${this.clipSelect('Ataque 1', 'combat:attack1', clipNames, this.draft.combat.clips.attack1)}${this.clipSelect('Ataque 2', 'combat:attack2', clipNames, this.draft.combat.clips.attack2)}${this.clipSelect('Ataque 3', 'combat:attack3', clipNames, this.draft.combat.clips.attack3)}${this.clipSelect('Bloqueio', 'combat:block', clipNames, this.draft.combat.clips.block)}</div>
        <div class="character-combat-help"><strong>Playtest</strong><span>LMB ou J: atacar / enfileirar próximo golpe · RMB ou K: defender · durante golpes o movimento cai para 16%.</span></div>
      </section>
      <section class="character-import-note"><strong>Etapa 6</strong><span>Armaduras continuam usando os slots visuais. Armas são assets independentes presos aos sockets do esqueleto, o que prepara inventário/equipamento real sem duplicar o personagem.</span></section>`;

    this.bindFormEvents(animations, equipmentAssets);
  }

  private bindFormEvents(animations: AssetRecord[], equipmentAssets: AssetRecord[]): void {
    this.form.querySelector<HTMLInputElement>('[data-character-name]')?.addEventListener('change', (event) => { this.draft.name = (event.currentTarget as HTMLInputElement).value.trim() || this.draft.name; this.renderPresetList(); });
    this.form.querySelector<HTMLSelectElement>('[data-character-gender]')?.addEventListener('change', (event) => { this.draft.gender = (event.currentTarget as HTMLSelectElement).value as CharacterPreset['gender']; });
    this.form.querySelector<HTMLSelectElement>('[data-base-mode]')?.addEventListener('change', (event) => { this.draft.baseMode = (event.currentTarget as HTMLSelectElement).value as CharacterPreset['baseMode']; this.schedulePreview(); });
    this.form.querySelectorAll<HTMLSelectElement>('[data-character-asset]').forEach((select) => select.addEventListener('change', () => this.handleAssetSelect(select)));
    this.form.querySelectorAll<HTMLInputElement>('[data-animation-library]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const selected = animations.filter((asset) => this.form.querySelector<HTMLInputElement>(`[data-animation-library="${CSS.escape(asset.id)}"]`)?.checked);
      this.draft.animationLibraries = selected.map((asset) => ref(asset)!);
      this.applyClipDefaults(this.draft, true);
      this.renderForm(); this.renderPreviewClips(); this.schedulePreview();
    }));
    this.form.querySelectorAll<HTMLSelectElement>('[data-character-clip]').forEach((select) => select.addEventListener('change', () => this.handleClipSelect(select)));
    this.form.querySelector<HTMLSelectElement>('[data-combat-profile]')?.addEventListener('change', (event) => {
      this.draft.combat.profile = (event.currentTarget as HTMLSelectElement).value as CharacterWeaponProfile;
      this.applyCombatDefaults(this.draft, true);
      this.renderForm(); this.renderPreviewClips(); this.schedulePreview();
    });
    this.form.querySelectorAll<HTMLSelectElement>('[data-equipment-slot]').forEach((select) => select.addEventListener('change', () => {
      const slot = select.dataset.equipmentSlot as CharacterEquipmentSlot;
      const asset = equipmentAssets.find((candidate) => candidate.id === select.value);
      if (asset) this.draft.equipment[slot] = createEquipmentAttachment(ref(asset)!, slot);
      else delete this.draft.equipment[slot];
      this.renderForm(); this.schedulePreview();
    }));
    this.form.querySelectorAll<HTMLInputElement>('[data-socket-name]').forEach((input) => input.addEventListener('change', () => {
      const slot = input.dataset.socketName as CharacterEquipmentSlot;
      const attachment = this.draft.equipment[slot];
      if (!attachment) return;
      attachment.socket = input.value.trim() || attachment.socket;
      this.schedulePreview();
    }));
    this.form.querySelectorAll<HTMLInputElement>('[data-socket-vector]').forEach((input) => input.addEventListener('change', () => this.handleSocketVector(input)));
    this.form.querySelector<HTMLButtonElement>('[data-save-character]')?.addEventListener('click', () => void this.savePreset(false));
    this.form.querySelector<HTMLButtonElement>('[data-activate-character]')?.addEventListener('click', () => void this.savePreset(true));
  }

  private handleAssetSelect(select: HTMLSelectElement): void {
    const role = select.dataset.characterAsset as CharacterAssetRole;
    const asset = this.assets.find((candidate) => candidate.id === select.value);
    if (role === 'base') {
      this.draft.base = ref(asset);
      if (asset) this.draft.gender = characterAssetGender(asset);
      this.renderForm(); this.schedulePreview(); return;
    }
    const slot = role as CharacterVisualSlot;
    if (asset) this.draft.visuals[slot] = ref(asset); else delete this.draft.visuals[slot];
    if (slot === 'outfit' && asset) {
      for (const modular of ['body', 'arms', 'legs', 'feet', 'headgear', 'accessory'] as const) delete this.draft.visuals[modular];
      this.draft.baseMode = 'head-only'; this.renderForm();
    } else if (slot !== 'hair' && slot !== 'outfit' && asset) {
      delete this.draft.visuals.outfit; this.draft.baseMode = 'head-only'; this.renderForm();
    }
    this.schedulePreview();
  }

  private handleClipSelect(select: HTMLSelectElement): void {
    const path = select.dataset.characterClip ?? '';
    if (path.startsWith('motion:')) {
      const key = path.slice('motion:'.length) as keyof CharacterPreset['clips'];
      this.draft.clips[key] = select.value;
    } else if (path.startsWith('combat:')) {
      const key = path.slice('combat:'.length) as keyof CharacterPreset['combat']['clips'];
      this.draft.combat.clips[key] = select.value;
    }
    this.schedulePreview();
  }

  private handleSocketVector(input: HTMLInputElement): void {
    const slot = input.dataset.socketVector as CharacterEquipmentSlot;
    const kind = input.dataset.vectorKind as 'position' | 'rotationDegrees' | 'scale';
    const axis = input.dataset.vectorAxis as keyof CharacterVector3;
    const attachment = this.draft.equipment[slot];
    if (!attachment) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (kind === 'scale') attachment.transform[kind][axis] = Math.max(0.001, Math.abs(value));
    else attachment.transform[kind][axis] = value;
    this.schedulePreview();
  }

  private equipmentSlot(label: string, slot: CharacterEquipmentSlot, assets: AssetRecord[]): string {
    const attachment = this.draft.equipment[slot];
    const select = `<label class="character-field"><span>${label}</span><select data-equipment-slot="${slot}"><option value="">Nenhum</option>${assets.map((asset) => `<option value="${asset.id}"${asset.id === attachment?.asset.assetId ? ' selected' : ''}>${escapeHtml(asset.name)}</option>`).join('')}</select></label>`;
    if (!attachment) return `<div class="character-equipment-slot">${select}</div>`;
    return `<div class="character-equipment-slot equipped">${select}<div class="character-socket-editor"><label class="character-field"><span>Bone/socket</span><input data-socket-name="${slot}" value="${escapeHtml(attachment.socket)}"></label>${this.vectorEditor(slot, 'position', 'Posição', attachment.transform.position, 0.01)}${this.vectorEditor(slot, 'rotationDegrees', 'Rotação °', attachment.transform.rotationDegrees, 1)}${this.vectorEditor(slot, 'scale', 'Escala', attachment.transform.scale, 0.05)}</div></div>`;
  }

  private vectorEditor(slot: CharacterEquipmentSlot, kind: 'position' | 'rotationDegrees' | 'scale', label: string, value: CharacterVector3, step: number): string {
    return `<div class="character-vector-field"><span>${label}</span><div>${(['x','y','z'] as const).map((axis) => `<label>${axis.toUpperCase()}<input type="number" step="${step}" data-socket-vector="${slot}" data-vector-kind="${kind}" data-vector-axis="${axis}" value="${value[axis]}"></label>`).join('')}</div></div>`;
  }

  private assetSelect(label: string, role: CharacterAssetRole, assets: AssetRecord[], selectedId?: string, optional = false): string {
    return `<label class="character-field"><span>${label}</span><select data-character-asset="${role}">${optional ? '<option value="">Nenhum</option>' : '<option value="">Selecione...</option>'}${assets.map((asset) => `<option value="${asset.id}"${asset.id === selectedId ? ' selected' : ''}>${escapeHtml(labelFor(asset))}</option>`).join('')}</select></label>`;
  }

  private clipSelect(label: string, path: string, names: string[], selected: string): string {
    const effective = names.includes(selected) ? selected : '';
    return `<label class="character-field"><span>${label}</span><select data-character-clip="${path}"><option value="">Sem animação</option>${names.map((name) => `<option value="${escapeHtml(name)}"${name === effective ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>`;
  }

  private assetsFor(role: CharacterAssetRole): AssetRecord[] {
    return this.assets.filter((asset) => inferCharacterAssetRole(asset) === role).sort((a, b) => a.name.localeCompare(b.name));
  }

  private selectedClipNames(): string[] {
    const selectedIds = new Set(this.draft.animationLibraries.map((entry) => entry.assetId));
    return [...new Set(this.assets.filter((asset) => selectedIds.has(asset.id)).flatMap((asset) => asset.animations))].sort((a, b) => a.localeCompare(b));
  }

  private applyClipDefaults(preset: CharacterPreset, force = false): void {
    const selectedIds = new Set(preset.animationLibraries.map((entry) => entry.assetId));
    const names = [...new Set(this.assets.filter((asset) => selectedIds.has(asset.id)).flatMap((asset) => asset.animations))];
    if (force || !names.includes(preset.clips.idle)) preset.clips.idle = chooseClip(names, ['Idle_Loop', 'Idle_FoldArms_Loop', 'Idle_No_Loop']);
    if (force || !names.includes(preset.clips.walk)) preset.clips.walk = chooseClip(names, ['Walk_Loop', 'Jog_Fwd_Loop', 'Walk_Carry_Loop']);
    if (force || !names.includes(preset.clips.run)) preset.clips.run = chooseClip(names, ['Sprint_Loop', 'Jog_Fwd_Loop', 'Walk_Loop']);
    this.applyCombatDefaults(preset, force, names);
  }

  private applyCombatDefaults(preset: CharacterPreset, force = false, suppliedNames?: string[]): void {
    const names = suppliedNames ?? this.selectedClipNames();
    const profile = preset.combat.profile;
    const attack1 = profile === 'unarmed' ? ['Punch_Jab', 'Melee_Hook', 'Punch'] : profile === 'bow' ? ['Bow_Shoot', 'Bow_Attack', 'OverhandThrow'] : ['Sword_Attack', 'Sword_Dash', 'Melee_Hook'];
    const attack2 = profile === 'unarmed' ? ['Punch_Cross', 'Melee_Hook', 'Punch'] : profile === 'bow' ? ['Bow_Shoot', 'Bow_Attack'] : ['Sword_Dash', 'Sword_Attack', 'Sword_Heavy_Combo'];
    const attack3 = profile === 'unarmed' ? ['Melee_Hook', 'Punch_Uppercut', 'Punch'] : profile === 'bow' ? ['Bow_Shoot', 'Bow_Attack'] : ['Sword_Heavy_Combo', 'Sword_Attack', 'Melee_Hook'];
    const block = profile === 'unarmed' ? ['Idle_Loop'] : ['Sword_Block', 'Shield_Block', 'Idle_Loop'];
    if (force || !names.includes(preset.combat.clips.attack1)) preset.combat.clips.attack1 = chooseClip(names, attack1);
    if (force || !names.includes(preset.combat.clips.attack2)) preset.combat.clips.attack2 = chooseClip(names, attack2);
    if (force || !names.includes(preset.combat.clips.attack3)) preset.combat.clips.attack3 = chooseClip(names, attack3);
    if (force || !names.includes(preset.combat.clips.block)) preset.combat.clips.block = chooseClip(names, block);
  }

  private renderPreviewClips(): void {
    const select = this.required<HTMLSelectElement>('[data-preview-clip]');
    const names = this.selectedClipNames();
    select.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    if (names.includes(this.draft.clips.idle)) select.value = this.draft.clips.idle;
  }

  private schedulePreview(): void {
    if (this.previewTimer) window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.refreshPreview(), 140);
  }

  private async refreshPreview(): Promise<void> {
    const token = ++this.previewToken;
    if (!this.draft.base) { this.preview.clear(); return; }
    try {
      await this.preview.show(cloneCharacterPreset(this.draft));
      if (token !== this.previewToken) return;
      if (this.draft.clips.idle) this.preview.playClip(this.draft.clips.idle);
    } catch (error) {
      if (token !== this.previewToken) return;
      this.onStatus(`Preview do personagem falhou: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => { if (!this.modal.hidden && event.code === 'Escape') this.close(); };
  private required<T extends Element>(selector: string): T { const element = this.modal.querySelector<T>(selector); if (!element) throw new Error(`Character Studio element not found: ${selector}`); return element; }
}
