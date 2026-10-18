// O nucleo agora vem das cristas angulares do proprio perfil volumetrico
// (shaft-profile.js), sem o pedestal do halo. Uma coluna vertical separada
// nao acompanha a inclinacao/movimento da faixa que o jogador realmente ve.

// Coordenadas da tela -> intersecao no plano z=0, iguais a planeWorld() dos
// shaders. Um ponto de poeira em outra camada usa sua projecao para coincidir
// com a faixa vista na tela, sem uma segunda mascara deslocada pela paralaxe.
export function beamPlanePoint(uv, camera) {
  return [camera[0] + uv[0] * camera[2], -(camera[1] + (1 - uv[1]) * camera[3])];
}

// Sinal deterministico individual. A mascara do nucleo e aplicada pelo shader;
// a poeira exterior nunca recebe este sinal nem brilho proprio.
export function beamTwinkle(time, seed) {
  const slow = .5 + .5 * Math.sin(time * (.9 + seed * 1.1) + seed * 71);
  const pulse = .5 + .5 * Math.sin(time * (2.3 + seed * 1.7) + seed * 127);
  return .66 + .28 * slow + .28 * pulse ** 8;
}

export const BEAM_CORE_GLSL = /* glsl */`
float beamTwinkle(float time, float seed) {
  float slow = .5 + .5 * sin(time * (.9 + seed * 1.1) + seed * 71.0);
  float pulse = .5 + .5 * sin(time * (2.3 + seed * 1.7) + seed * 127.0);
  return .66 + .28 * slow + .28 * pow(pulse, 8.0);
}
`;
