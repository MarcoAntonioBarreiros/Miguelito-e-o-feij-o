// Iluminacao compartilhada por todos os materiais da cena 2,5D.
//
// Modelo: forward com ate MAX_LIGHTS luzes pontuais em uniforms, escolhidas por
// quadro na CPU (as mais relevantes para a camera). Quatro delas projetam
// sombra: a visibilidade e calculada uma vez por quadro numa textura de meia
// resolucao (passe de visibilidade) e cada material so a le.
//
// O estilo ilustrado manda: a luz "envolve" (half-lambert com wrap), ha um piso
// de ambiente nos personagens e um brilho especular curto, que combina com o
// acabamento umido das bacterias pintadas. A ideia e iluminar a arte, nao
// re-renderiza-la como 3D realista.

import * as THREE from '../vendor/three.bundle.min.js';

export const MAX_LIGHTS = 24;
export const SHADOW_SLOTS = 4;

export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
    uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
    uLightCount: { value: 0 },
    uVis: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    // camX, camY (mundo do jogo, y para baixo), largura e altura visiveis
    uCam: { value: new THREE.Vector4(0, 0, 1280, 720) },
    uAmbient: { value: new THREE.Color(0.055, 0.078, 0.088) },
    uFogColor: { value: new THREE.Color(0.010, 0.030, 0.040) },
    uFogDensity: { value: 0.0026 },
    uLightingOn: { value: 1 },
    uShadowsOn: { value: 1 },
    // calmaria: ate 4 halos em mundo GL (x, y para cima, raio, intensidade)
    uCalmZones: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  };
}

export const LIGHTING_GLSL = /* glsl */`
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform float uTime;
uniform vec4 uLightPos[MAX_LIGHTS];  // xyz mundo GL (y para cima), w = raio
uniform vec4 uLightCol[MAX_LIGHTS];  // rgb intensidade, w = slot de sombra + 1 (0 = sem)
uniform int uLightCount;
uniform sampler2D uVis;
uniform vec2 uResolution;
uniform vec4 uCam;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uLightingOn;
uniform float uShadowsOn;
uniform vec4 uCalmZones[4];

// Calmaria (Pseudomonas + Bacillus): 0..1 no ponto do mundo, borda suave.
float calmAt(vec3 wp) {
  float w = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 z = uCalmZones[i];
    if (z.w <= 0.0) continue;
    float edge = max(60.0, z.z * .28);
    w = max(w, z.w * (1.0 - smoothstep(z.z - edge, z.z, distance(wp.xy, z.xy))));
  }
  return w;
}
// luz ambiente quente da calmaria (rosa-pessego): clareia, nao tinge
const vec3 CALM_AMBIENT = vec3(.86, .52, .44);

float shadowFor(float slotPlusOne, vec2 suv) {
  // o passe de visibilidade roda sempre: sem "Sombras" ele so calcula a luz
  // entrando no volume do solo (sem sombra projetada)
  if (slotPlusOne < .5) return 1.0;
  vec4 v = texture(uVis, suv);
  int s = int(slotPlusOne + .5) - 1;
  return s == 0 ? v.r : s == 1 ? v.g : s == 2 ? v.b : v.a;
}

// wrap: 0 = lambert, 1 = a luz envolve tudo. spec: forca do brilho curto.
vec3 accumulateLightAt(vec3 wp, vec3 N, float wrap, float spec, vec2 suv, out vec3 rim) {
  vec3 sum = vec3(0.0);
  rim = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec4 lp = uLightPos[i];
    vec4 lc = uLightCol[i];
    vec3 L = lp.xyz - wp;
    float d = length(L);
    // raio negativo = foco apontado para baixo (feixe da superficie), como o
    // Spot Light 2D da cena Unity: cone de 58 graus com miolo de 18. Fora do
    // cone fica escuro; e esse contraste que separa as camadas.
    float radius = abs(lp.w);
    if (d > radius) continue;
    vec3 l = L / max(d, 1e-3);
    float q = d / radius;
    float att = 1.0 - q * q;
    att *= att;
    if (lp.w < 0.0) {
      float cy = L.y / max(length(L.xy), 1e-3);
      att *= smoothstep(.875, .988, cy);
    }
    float ndl = dot(N, l);
    float diff = clamp((ndl + wrap) / (1.0 + wrap), 0.0, 1.0);
    float sh = shadowFor(lc.w, suv);
    vec3 c = lc.rgb * att * sh;
    sum += c * diff;
    vec3 H = normalize(l + vec3(0.0, 0.0, 1.0));
    sum += c * spec * pow(max(dot(N, H), 0.0), 24.0);
    // contraluz: a borda virada para a luz acende (leitura de silhueta)
    float edge = 1.0 - clamp(N.z, 0.0, 1.0);
    vec2 nxy = N.xy / max(length(N.xy), 1e-4);
    vec2 lxy = l.xy / max(length(l.xy), 1e-4);
    // so luz que vem de CIMA desenha o contorno: lanterna ou exsudato abaixo
    // de uma raiz acendiam a borda de baixo dela, e a cena ficava com luz
    // vindo de dois lados (blocos e raizes iluminados por cima, algumas
    // laterais por baixo)
    float fromAbove = smoothstep(-.15, .45, l.y);
    rim += c * edge * edge * clamp(dot(nxy, lxy), 0.0, 1.0) * fromAbove;
  }
  // varias luzes somadas nao estouram: a soma satura suave perto de 1,3
  // (uma luz sozinha continua quase linear)
  rim = 1.3 * (1.0 - exp(-rim / 1.3));
  return 1.3 * (1.0 - exp(-sum / 1.3));
}

#ifndef LIGHT_IN_VERTEX
vec3 accumulateLight(vec3 wp, vec3 N, float wrap, float spec, out vec3 rim) {
  return accumulateLightAt(wp, N, wrap, spec, gl_FragCoord.xy / uResolution, rim);
}
#endif

vec3 applyFog(vec3 col, float worldZ) {
  float f = 1.0 - exp(-uFogDensity * max(0.0, -worldZ));
  return mix(col, uFogColor, clamp(f, 0.0, 0.94));
}

// posicao no mundo GL de um ponto do plano de jogo (z = 0), a partir da tela
vec3 planeWorld(vec2 suv) {
  return vec3(uCam.x + suv.x * uCam.z, -(uCam.y + (1.0 - suv.y) * uCam.w), 0.0);
}
`;
