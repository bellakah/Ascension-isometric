import * as THREE from 'three';
import { TerrainMaterialDatabase } from './TerrainMaterialDatabase';
import { sampleTerrainHeight, terrainLayerWeights, type TerrainRegion } from './TerrainMath';
import { MAX_TERRAIN_LAYERS, type WorldDocument } from './WorldDocument';

const ARRAY_SIZE = 256;

const VERTEX_SHADER = `
in vec4 aWeight0;
in vec4 aWeight1;
in vec4 aWeight2;
in vec4 aWeight3;
out vec2 vUv2;
out vec4 vWeight0;
out vec4 vWeight1;
out vec4 vWeight2;
out vec4 vWeight3;
out vec3 vWorld;
void main() {
  vUv2 = uv;
  vWeight0 = aWeight0;
  vWeight1 = aWeight1;
  vWeight2 = aWeight2;
  vWeight3 = aWeight3;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT_SHADER = `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAlbedoArray;
uniform int uLayerCount;
uniform int uMaskPreview;
uniform float uHasMap[16];
uniform vec3 uFallback[16];
uniform vec3 uTint[16];
uniform float uRepeat[16];
uniform float uRotation[16];
in vec2 vUv2;
in vec4 vWeight0;
in vec4 vWeight1;
in vec4 vWeight2;
in vec4 vWeight3;
in vec3 vWorld;
out vec4 outColor;

float weightAt(int index) {
  if (index < 4) return vWeight0[index];
  if (index < 8) return vWeight1[index - 4];
  if (index < 12) return vWeight2[index - 8];
  return vWeight3[index - 12];
}

vec2 layerUv(int index) {
  float angle = radians(uRotation[index]);
  float c = cos(angle); float s = sin(angle);
  vec2 centered = vUv2 - vec2(0.5);
  vec2 rotated = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + vec2(0.5);
  return fract(rotated * max(0.001, uRepeat[index]));
}

void main() {
  if (uMaskPreview >= 0) {
    float mask = clamp(weightAt(uMaskPreview), 0.0, 1.0);
    outColor = vec4(vec3(mask), 1.0);
    return;
  }
  vec3 base = vec3(0.0);
  float total = 0.0;
  for (int index = 0; index < 16; index++) {
    if (index >= uLayerCount) break;
    float weight = max(0.0, weightAt(index));
    if (weight <= 0.0001) continue;
    vec3 sampled = texture(uAlbedoArray, vec3(layerUv(index), float(index))).rgb;
    vec3 color = mix(uFallback[index], sampled, uHasMap[index]) * uTint[index];
    base += color * weight;
    total += weight;
  }
  if (total > 0.0001) base /= total;
  vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (normal.y < 0.0) normal *= -1.0;
  float light = 0.58 + max(dot(normal, normalize(vec3(0.35, 0.9, 0.28))), 0.0) * 0.62;
  outColor = vec4(base * light, 1.0);
}`;

function inRegion(x: number, z: number, region?: TerrainRegion): boolean {
  return !region || (x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ);
}

function blankArrayTexture(): THREE.DataArrayTexture {
  const data = new Uint8Array(ARRAY_SIZE * ARRAY_SIZE * 4 * MAX_TERRAIN_LAYERS);
  data.fill(255);
  const texture = new THREE.DataArrayTexture(data, ARRAY_SIZE, ARRAY_SIZE, MAX_TERRAIN_LAYERS);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

async function blobPixels(blob: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = ARRAY_SIZE; canvas.height = ARRAY_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { bitmap.close(); throw new Error('Canvas 2D indisponível para textura de terreno.'); }
  context.drawImage(bitmap, 0, 0, ARRAY_SIZE, ARRAY_SIZE);
  bitmap.close();
  return context.getImageData(0, 0, ARRAY_SIZE, ARRAY_SIZE).data;
}

export class TerrainSurface {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly database = new TerrainMaterialDatabase();
  private arrayTexture = blankArrayTexture();
  private textureGeneration = 0;
  private materialSignature = '';
  private size = 0;
  private resolution = 0;
  private maskLayerId: string | null = null;

  constructor(document: WorldDocument) {
    const colors = Array.from({ length: MAX_TERRAIN_LAYERS }, () => new THREE.Color('#808080'));
    const tints = Array.from({ length: MAX_TERRAIN_LAYERS }, () => new THREE.Color('#ffffff'));
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uAlbedoArray: { value: this.arrayTexture },
        uLayerCount: { value: 1 },
        uMaskPreview: { value: -1 },
        uHasMap: { value: new Array<number>(MAX_TERRAIN_LAYERS).fill(0) },
        uFallback: { value: colors },
        uTint: { value: tints },
        uRepeat: { value: new Array<number>(MAX_TERRAIN_LAYERS).fill(10) },
        uRotation: { value: new Array<number>(MAX_TERRAIN_LAYERS).fill(0) },
      },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), material);
    this.mesh.name = 'Editable Terrain'; this.mesh.receiveShadow = true; this.mesh.userData.editorTerrain = true; this.mesh.userData.editorHelper = true;
    this.update(document);
  }

  update(document: WorldDocument, region?: TerrainRegion): void {
    const requiredResolution = Math.max(16, Math.min(192, document.terrain.resolution));
    if (this.size !== document.environment.groundSize || this.resolution !== requiredResolution) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(document.environment.groundSize, document.environment.groundSize, requiredResolution, requiredResolution);
      this.mesh.geometry.rotateX(-Math.PI / 2);
      this.size = document.environment.groundSize; this.resolution = requiredResolution; region = undefined;
    }

    const position = this.mesh.geometry.getAttribute('position');
    const attributes = Array.from({ length: 4 }, (_, group) => {
      const name = `aWeight${group}`;
      let attribute = this.mesh.geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!attribute || attribute.count !== position.count) {
        attribute = new THREE.Float32BufferAttribute(new Float32Array(position.count * 4), 4);
        this.mesh.geometry.setAttribute(name, attribute);
      }
      return attribute;
    });

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index); const z = position.getZ(index); if (!inRegion(x, z, region)) continue;
      position.setY(index, sampleTerrainHeight(document, x, z));
      const weights = terrainLayerWeights(document, x, z);
      for (let group = 0; group < 4; group += 1) {
        const offset = group * 4;
        attributes[group]!.setXYZW(index, weights[offset] ?? 0, weights[offset + 1] ?? 0, weights[offset + 2] ?? 0, weights[offset + 3] ?? 0);
      }
    }
    position.needsUpdate = true; attributes.forEach((attribute) => { attribute.needsUpdate = true; });
    this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingBox(); this.mesh.geometry.computeBoundingSphere();
    this.applyLayerUniforms(document);

    const signature = document.terrain.layers.map((layer) => layer.materialId ?? '').join('|');
    if (signature !== this.materialSignature) { this.materialSignature = signature; void this.refreshTextureArray(document); }
  }

  setMaskPreview(document: WorldDocument, layerId: string | null): void {
    this.maskLayerId = layerId;
    this.mesh.material.uniforms.uMaskPreview!.value = layerId ? document.terrain.layers.findIndex((layer) => layer.id === layerId) : -1;
  }

  heightAt(document: WorldDocument, x: number, z: number): number { return sampleTerrainHeight(document, x, z); }

  surfaceAt(camera: THREE.Camera, canvas: HTMLCanvasElement, clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(this.mesh, false)[0]?.point.clone() ?? null;
  }

  dispose(): void { ++this.textureGeneration; this.arrayTexture.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }

  private applyLayerUniforms(document: WorldDocument): void {
    const layers = document.terrain.layers.slice(0, MAX_TERRAIN_LAYERS);
    this.mesh.material.uniforms.uLayerCount!.value = Math.max(1, layers.length);
    const fallback = this.mesh.material.uniforms.uFallback!.value as THREE.Color[];
    const tint = this.mesh.material.uniforms.uTint!.value as THREE.Color[];
    const repeat = this.mesh.material.uniforms.uRepeat!.value as number[];
    const rotation = this.mesh.material.uniforms.uRotation!.value as number[];
    for (let index = 0; index < MAX_TERRAIN_LAYERS; index += 1) {
      const layer = layers[index];
      fallback[index]!.set(layer?.fallbackColor ?? document.environment.groundColor);
      tint[index]!.set(layer?.tint ?? '#ffffff');
      repeat[index] = layer?.tileScale ?? 10;
      rotation[index] = layer?.rotation ?? 0;
    }
    this.mesh.material.uniforms.uMaskPreview!.value = this.maskLayerId ? layers.findIndex((layer) => layer.id === this.maskLayerId) : -1;
  }

  private async refreshTextureArray(document: WorldDocument): Promise<void> {
    const generation = ++this.textureGeneration;
    const layers = document.terrain.layers.slice(0, MAX_TERRAIN_LAYERS);
    const records = await Promise.all(layers.map((layer) => layer.materialId ? this.database.get(layer.materialId) : Promise.resolve(undefined)));
    if (generation !== this.textureGeneration) return;

    const data = new Uint8Array(ARRAY_SIZE * ARRAY_SIZE * 4 * MAX_TERRAIN_LAYERS); data.fill(255);
    const hasMap = new Array<number>(MAX_TERRAIN_LAYERS).fill(0);
    const sliceBytes = ARRAY_SIZE * ARRAY_SIZE * 4;
    await Promise.all(records.map(async (record, index) => {
      const file = record?.files.color; if (!file) return;
      try {
        const pixels = await blobPixels(file.blob);
        if (generation !== this.textureGeneration) return;
        data.set(pixels, index * sliceBytes); hasMap[index] = 1;
      } catch { hasMap[index] = 0; }
    }));
    if (generation !== this.textureGeneration) return;

    const next = new THREE.DataArrayTexture(data, ARRAY_SIZE, ARRAY_SIZE, MAX_TERRAIN_LAYERS);
    next.format = THREE.RGBAFormat; next.type = THREE.UnsignedByteType; next.colorSpace = THREE.SRGBColorSpace;
    next.minFilter = THREE.LinearMipmapLinearFilter; next.magFilter = THREE.LinearFilter; next.generateMipmaps = true; next.needsUpdate = true;
    const previous = this.arrayTexture; this.arrayTexture = next; this.mesh.material.uniforms.uAlbedoArray!.value = next; this.mesh.material.uniforms.uHasMap!.value = hasMap; previous.dispose();
  }
}
