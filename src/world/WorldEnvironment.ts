import * as THREE from 'three';
import type { WorldDocument } from './WorldDocument';

export class WorldEnvironment {
  private readonly group = new THREE.Group();

  constructor(private readonly scene: THREE.Scene, document: WorldDocument, private readonly showGrid: boolean) {
    this.group.name = 'World Environment';
    this.group.userData.editorHelper = true;
    this.scene.add(this.group);
    this.update(document);
  }

  update(document: WorldDocument): void {
    this.group.clear();
    this.scene.background = new THREE.Color(document.environment.backgroundColor);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(document.environment.groundSize, document.environment.groundSize),
      new THREE.MeshStandardMaterial({ color: document.environment.groundColor, roughness: 0.9, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    ground.userData.editorHelper = true;
    this.group.add(ground);

    if (this.showGrid) {
      const divisions = Math.max(10, Math.min(200, Math.round(document.environment.groundSize)));
      const grid = new THREE.GridHelper(document.environment.groundSize, divisions, 0x5e7763, 0x6d886d);
      grid.position.y = 0.01;
      grid.userData.editorHelper = true;
      this.group.add(grid);
    }

    const hemisphere = new THREE.HemisphereLight(0xdceeff, 0x526149, 1.8);
    this.group.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff1d2, 3.1);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const extent = Math.min(60, Math.max(20, document.environment.groundSize * 0.35));
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    this.group.add(sun);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    this.group.clear();
  }
}
