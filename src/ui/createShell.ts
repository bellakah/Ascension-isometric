export interface ShellOptions {
  mode: 'game' | 'editor';
  title: string;
  subtitle: string;
  help: string;
}

export interface AppShell {
  canvas: HTMLCanvasElement;
  dispose(): void;
}

export function createShell(root: HTMLElement, options: ShellOptions): AppShell {
  root.innerHTML = `
    <main class="app-shell">
      <canvas class="viewport" tabindex="0" aria-label="Viewport 3D"></canvas>
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">A</div>
          <div class="brand-copy">
            <h1 class="brand-title">${options.title}</h1>
            <p class="brand-subtitle">${options.subtitle}</p>
          </div>
        </div>
        <nav class="actions">
          <a class="action ${options.mode === 'game' ? 'primary' : ''}" href="/">Jogo</a>
          <a class="action ${options.mode === 'editor' ? 'primary' : ''}" href="/editor.html">Editor</a>
        </nav>
      </header>
      <section class="panel">
        <h2>Foundation v0.1</h2>
        <p>${options.help}</p>
      </section>
      <div class="editor-badge">Three.js · TypeScript · câmera ortográfica isométrica</div>
    </main>`;

  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) throw new Error('Viewport canvas was not created.');
  canvas.focus();

  return {
    canvas,
    dispose() {
      root.innerHTML = '';
    },
  };
}
