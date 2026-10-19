// EPS lives on the existing root, at the same z=0 contact plane as the game.
// Its colour already contains the original Bacillus sprites. A separate relief
// field describes only the gel, so the light never invents new organism art.
import * as THREE from '../vendor/three.bundle.min.js';
import { LIGHTING_GLSL } from './shading.js';
import { writeSpritePlanePositions } from './sprite-plane.js';

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vWorld = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */`
${LIGHTING_GLSL}
uniform sampler2D uMap;
uniform sampler2D uRelief;
uniform vec2 uTexel;
uniform vec2 uWorldStep;
uniform vec2 uU;
uniform vec2 uV;
uniform float uAlpha;
uniform float uActivity;
varying vec2 vUv;
varying vec3 vWorld;

float heightAt(vec2 uv) {
  vec4 r = texture2D(uRelief, uv);
  return r.r * r.a;
}

void main() {
  vec4 c = texture2D(uMap, vUv);
  float alpha = c.a * uAlpha;
  if (alpha < .003) discard;
  // Colour texture is premultiplied, just like the game's sprite pass.
  vec3 albedo = c.rgb / max(c.a, 1e-4);
  float dx = heightAt(vUv + vec2(uTexel.x, 0.0)) - heightAt(vUv - vec2(uTexel.x, 0.0));
  // Positive V is down in the Canvas pose, whereas positive texture V is up.
  float dy = heightAt(vUv - vec2(0.0, uTexel.y)) - heightAt(vUv + vec2(0.0, uTexel.y));
  vec2 slope = vec2(dx, dy) * 3.1 / max(vec2(.02), 2.0 * uWorldStep);
  vec3 N = normalize(vec3(-uU * slope.x - uV * slope.y, 1.0));
  vec3 rim;
  float wetness = .4 + .6 * uActivity;
  vec3 light = accumulateLight(vWorld + vec3(0.0, 0.0, 3.0), N, .64, .22 * wetness, rim);
  // A modest colour floor keeps this an illustrated translucent membrane.
  // No emissive halo, additive blend, noise or alpha amplification is used.
  vec3 lit = albedo * (.43 + uAmbient + light * .61)
    + rim * vec3(.54, .84, .74) * .15 * wetness;
  vec3 colour = mix(albedo, lit, uLightingOn);
  gl_FragColor = vec4(colour * alpha, alpha);
}`;

/** Pure pose mapping, shared by capture and the zoom/rotation regression check. */
export function biofilmScreenQuad(matrix, packet) {
  const at = (x, y) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });
  return {
    p0: at(packet.x, packet.y),
    pu: at(packet.x + packet.w, packet.y),
    pv: at(packet.x, packet.y + packet.h),
  };
}

function textureFor(image, colour) {
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.premultiplyAlpha = colour;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createBiofilmLayer({ scene, shared }) {
  const entries = new Map();
  const queue = [];
  let frame = 0;
  const stats = { visible: 0, cached: 0, uploads: 0 };

  function release(entry) {
    scene.remove(entry.mesh);
    entry.geometry.dispose();
    entry.material.dispose();
    entry.colour.dispose();
    entry.relief.dispose();
  }

  function createEntry(packet) {
    const colour = textureFor(packet.image, true);
    const relief = textureFor(packet.relief, false);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(12);
    const position = new THREE.BufferAttribute(positions, 3);
    position.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', position);
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geometry.setIndex([0, 2, 1, 1, 2, 3]);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uMap: { value: colour }, uRelief: { value: relief },
        uTexel: { value: new THREE.Vector2() },
        uWorldStep: { value: new THREE.Vector2() },
        uU: { value: new THREE.Vector2(1, 0) },
        uV: { value: new THREE.Vector2(0, -1) },
        uAlpha: { value: 1 }, uActivity: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 43;
    mesh.visible = false;
    scene.add(mesh);
    return { colour, relief, geometry, position, positions, material, mesh, revision: undefined, lastSeen: frame };
  }

  return {
    stats,
    begin() {
      frame++;
      queue.length = 0;
      stats.visible = stats.uploads = 0;
      for (const entry of entries.values()) entry.mesh.visible = false;
    },
    capture(ctx, packet) {
      if (packet?.key == null || !packet.image?.width || !packet.image?.height
        || !packet.relief?.width || !packet.relief?.height
        || ![packet.x, packet.y, packet.w, packet.h].every(Number.isFinite)
        || packet.w <= 0 || packet.h <= 0) return false;
      const alpha = Number.isFinite(ctx.globalAlpha) ? Math.max(0, Math.min(1, ctx.globalAlpha)) : 1;
      queue.push({ packet, alpha, ...biofilmScreenQuad(ctx.getTransform(), packet) });
      return true;
    },
    update(toWorld) {
      for (const pose of queue) {
        const { packet } = pose;
        let entry = entries.get(packet.key);
        if (!entry) {
          entry = createEntry(packet);
          entries.set(packet.key, entry);
        }
        entry.lastSeen = frame;
        if (entry.revision !== packet.revision || entry.colour.image !== packet.image || entry.relief.image !== packet.relief) {
          entry.colour.image = packet.image;
          entry.relief.image = packet.relief;
          entry.colour.needsUpdate = entry.relief.needsUpdate = true;
          entry.revision = packet.revision;
          stats.uploads += 2;
        }
        const { p0, pu, pv } = writeSpritePlanePositions(entry.positions, 0, pose, toWorld);
        const ux = pu.x - p0.x, uy = pu.y - p0.y;
        const vx = pv.x - p0.x, vy = pv.y - p0.y;
        const width = Math.max(.001, Math.hypot(ux, uy));
        const height = Math.max(.001, Math.hypot(vx, vy));
        const uniforms = entry.material.uniforms;
        uniforms.uU.value.set(ux / width, uy / width);
        uniforms.uV.value.set(vx / height, vy / height);
        uniforms.uTexel.value.set(1 / packet.relief.width, 1 / packet.relief.height);
        uniforms.uWorldStep.value.set(width / packet.relief.width, height / packet.relief.height);
        uniforms.uAlpha.value = pose.alpha;
        uniforms.uActivity.value = Math.max(0, Math.min(1, Number(packet.activity) || 0));
        entry.position.needsUpdate = true;
        entry.mesh.visible = pose.alpha > .001;
        stats.visible += entry.mesh.visible ? 1 : 0;
      }
      // Short offscreen trips keep textures. Old phase/colony canvases release
      // their GPU allocation after three seconds at the normal 60 Hz cadence.
      for (const [key, entry] of entries) {
        if (frame - entry.lastSeen > 180) { release(entry); entries.delete(key); }
      }
      stats.cached = entries.size;
    },
    dispose() {
      for (const entry of entries.values()) release(entry);
      entries.clear(); queue.length = 0;
      stats.visible = stats.cached = stats.uploads = 0;
    },
  };
}
