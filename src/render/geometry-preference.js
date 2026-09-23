// `?geo=0` volta ao visual antigo (blocos), para comparação. Lido uma vez, ao
// carregar: é preferência de desenho, não estado de jogo.
export function readGeometryPreference(locationLike) {
  try {
    const value = new URLSearchParams(locationLike?.search || '').get('geo');
    if (value === null) return true;
    return !['0', 'off', 'false', 'nao', 'não'].includes(value.toLowerCase());
  } catch (_) {
    return true;
  }
}

export const GEOMETRY_ENABLED = readGeometryPreference(globalThis.location);
