import * as THREE from 'three';

export interface DemoWorld {
  player: THREE.Group;
  animated: THREE.Object3D[];
}

function material(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
}

function castAndReceive(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createTree(x: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.6, 7), material(0x6b4934));
  trunk.position.y = 1.3;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.45, 3.4, 8), material(0x426d4a));
  crown.position.y = 3.5;
  group.add(trunk, crown);
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  castAndReceive(group);
  return group;
}

function createHouse(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 4), material(0xd7c09d));
  body.position.y = 1.4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7, 2.25, 4), material(0x8b5948));
  roof.position.y = 3.65;
  roof.rotation.y = Math.PI / 4;
  group.add(body, roof);
  group.position.set(x, 0, z);
  castAndReceive(group);
  return group;
}

function createPlayer(): THREE.Group {
  const player = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.15, 4, 10), material(0x4f7cac));
  body.position.y = 1.08;
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.48, 6), material(0xe9e1a4));
  marker.position.set(0, 2.35, -0.38);
  marker.rotation.x = Math.PI / 2;
  player.add(body, marker);
  castAndReceive(player);
  return player;
}

export function createDemoWorld(scene: THREE.Scene): DemoWorld {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material(0x71955f));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(100, 100, 0x63835c, 0x6d8d65);
  grid.position.y = 0.01;
  scene.add(grid);

  const hemisphere = new THREE.HemisphereLight(0xcde8ff, 0x536149, 1.9);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d2, 3.2);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  const houseA = createHouse(-5, -5);
  const houseB = createHouse(6, -2);
  houseB.rotation.y = Math.PI / 2;
  scene.add(houseA, houseB);

  const treePositions: Array<[number, number, number]> = [
    [-11, -8, 1.05], [-8, 4, 0.9], [-2, 9, 1.15], [6, 8, 0.95], [12, 3, 1.1],
    [11, -8, 0.85], [3, -11, 1], [-12, 8, 0.85],
  ];
  for (const [x, z, scale] of treePositions) scene.add(createTree(x, z, scale));

  const rockMat = material(0x7c8582);
  for (const [x, z, s] of [[-1, -8, 0.9], [9, 4, 1.2], [-9, -1, 0.65]] as Array<[number, number, number]>) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s), rockMat);
    rock.position.set(x, s * 0.65, z);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  const player = createPlayer();
  scene.add(player);

  const animated = [player];
  return { player, animated };
}
