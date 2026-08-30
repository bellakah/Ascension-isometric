import * as THREE from 'three';
import { TerrainMaterialDatabase } from './TerrainMaterialDatabase';
import { sampleTerrainHeight, terrainLayerWeights, type TerrainRegion } from './TerrainMath';
import type { WorldDocument } from './WorldDocument';

const VERTEX_SHADER = `
attribute vec4 aWeight;
varying vec2 vUv2;
varying vec4 vWeight;
varying vec3 vWorld;
void main() { vUv2 = uv; vWeight = aWeight; vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uTex0; uniform sampler2D uTex1; uniform sampler2D uTex2; uniform sampler2D uTex3;
uniform float uHas0; uniform float uHas1; uniform float uHas2; uniform float uHas3;
uniform vec3 uColor0; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3;
uniform float uRepeat0; uniform float uRepeat1; uniform float uRepeat2; uniform float uRepeat3;
varying vec2 vUv2; varying vec4 vWeight; varying vec3 vWorld;
vec3 layerColor(sampler2D map, float hasMap, vec3 fallbackColor, float repeatValue) { vec3 tex = texture2D(map, vUv2 * repeatValue).rgb; return mix(fallbackColor, tex, hasMap); }
void main() {
  vec4 w = max(vWeight, 0.0); float total = max(0.0001, w.x + w.y + w.z + w.w); w /= total;
  vec3 base = layerColor(uTex0,uHas0,uColor0,uRepeat0)*w.x + layerColor(uTex1,uHas1,uColor1,uRepeat1)*w.y + layerColor(uTex2,uHas2,uColor2,uRepeat2)*w.z + layerColor(uTex3,uHas3,uColor3,uRepeat3)*w.w;
  vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (normal.y < 0.0) normal *= -1.0;
  float light = 0.58 + max(dot(normal, normalize(vec3(0.35,0.9,0.28))), 0.0) * 0.62;
  gl_FragColor = vec4(base * light, 1.0);
}`;

function whiteTexture(): THREE.DataTexture { const texture = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace; return texture; }
function inRegion(x: number, z: number, region?: TerrainRegion): boolean { return !region || (x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ); }

export class TerrainSurface {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly database = new TerrainMaterialDatabase();
  private readonly fallback = whiteTexture();
  private readonly urls: string[] = [];
  private readonly loadedTextures: THREE.Texture[] = [];
  private textureGeneration = 0;
  private materialSignature = '';
  private size = 0;
  private resolution = 0;

  constructor(document: WorldDocument) {
    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, uniforms: {
      uTex0:{value:this.fallback},uTex1:{value:this.fallback},uTex2:{value:this.fallback},uTex3:{value:this.fallback},
      uHas0:{value:0},uHas1:{value:0},uHas2:{value:0},uHas3:{value:0},
      uColor0:{value:new THREE.Color('#71955f')},uColor1:{value:new THREE.Color('#8b7355')},uColor2:{value:new THREE.Color('#7c817e')},uColor3:{value:new THREE.Color('#c9b77d')},
      uRepeat0:{value:10},uRepeat1:{value:10},uRepeat2:{value:8},uRepeat3:{value:9},
    }, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1,1,1), material); this.mesh.name = 'Editable Terrain'; this.mesh.receiveShadow = true; this.mesh.userData.editorTerrain = true; this.mesh.userData.editorHelper = true; this.update(document);
  }

  update(document: WorldDocument, region?: TerrainRegion): void {
    const requiredResolution = Math.max(16, Math.min(192, document.terrain.resolution));
    if (this.size !== document.environment.groundSize || this.resolution !== requiredResolution) {
      this.mesh.geometry.dispose(); this.mesh.geometry = new THREE.PlaneGeometry(document.environment.groundSize, document.environment.groundSize, requiredResolution, requiredResolution); this.mesh.geometry.rotateX(-Math.PI/2); this.size = document.environment.groundSize; this.resolution = requiredResolution; region = undefined;
    }
    const position = this.mesh.geometry.getAttribute('position');
    let weights = this.mesh.geometry.getAttribute('aWeight') as THREE.BufferAttribute | undefined;
    if (!weights || weights.count !== position.count) { weights = new THREE.Float32BufferAttribute(new Float32Array(position.count*4),4); this.mesh.geometry.setAttribute('aWeight', weights); }
    for (let index=0; index<position.count; index+=1) {
      const x=position.getX(index); const z=position.getZ(index); if (!inRegion(x,z,region)) continue;
      position.setY(index, sampleTerrainHeight(document,x,z)); const layer=terrainLayerWeights(document,x,z); weights.setXYZW(index,layer[0],layer[1],layer[2],layer[3]);
    }
    position.needsUpdate=true; weights.needsUpdate=true; this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingBox(); this.mesh.geometry.computeBoundingSphere();
    document.terrain.layers.slice(0,4).forEach((layer,index)=>{ const cu=this.mesh.material.uniforms[`uColor${index}`]; const ru=this.mesh.material.uniforms[`uRepeat${index}`]; if(cu)cu.value.set(layer.fallbackColor); if(ru)ru.value=layer.tileScale; });
    const signature = document.terrain.layers.slice(0,4).map((layer)=>layer.materialId??'').join('|');
    if (signature !== this.materialSignature) { this.materialSignature = signature; void this.refreshTextures(document); }
  }

  heightAt(document: WorldDocument,x:number,z:number):number{return sampleTerrainHeight(document,x,z);}
  surfaceAt(camera:THREE.Camera,canvas:HTMLCanvasElement,clientX:number,clientY:number):THREE.Vector3|null{const rect=canvas.getBoundingClientRect();const pointer=new THREE.Vector2(((clientX-rect.left)/Math.max(1,rect.width))*2-1,-((clientY-rect.top)/Math.max(1,rect.height))*2+1);const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(this.mesh,false)[0]?.point.clone()??null;}
  dispose():void{++this.textureGeneration;this.clearLoadedTextures();this.fallback.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}

  private async refreshTextures(document:WorldDocument):Promise<void>{const generation=++this.textureGeneration;const records=await Promise.all(document.terrain.layers.slice(0,4).map((layer)=>layer.materialId?this.database.get(layer.materialId):Promise.resolve(undefined)));if(generation!==this.textureGeneration)return;this.clearLoadedTextures();for(let index=0;index<4;index+=1){const file=records[index]?.files.color;const textureUniform=this.mesh.material.uniforms[`uTex${index}`];const hasUniform=this.mesh.material.uniforms[`uHas${index}`];if(!file){if(textureUniform)textureUniform.value=this.fallback;if(hasUniform)hasUniform.value=0;continue;}const url=URL.createObjectURL(file.blob);this.urls.push(url);try{const texture=await new THREE.TextureLoader().loadAsync(url);if(generation!==this.textureGeneration){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;this.loadedTextures.push(texture);if(textureUniform)textureUniform.value=texture;if(hasUniform)hasUniform.value=1;}catch{if(textureUniform)textureUniform.value=this.fallback;if(hasUniform)hasUniform.value=0;}}}
  private clearLoadedTextures():void{for(const texture of this.loadedTextures)texture.dispose();this.loadedTextures.length=0;for(const url of this.urls)URL.revokeObjectURL(url);this.urls.length=0;}
}
