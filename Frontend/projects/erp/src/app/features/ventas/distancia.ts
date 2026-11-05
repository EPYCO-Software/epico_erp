import { UbicacionGps } from 'ui';

/** De dónde salió la distancia de la planta a la obra. */
export type FuenteDistancia = 'carretera' | 'aprox' | 'manual';

/** Las carreteras rodean: la línea recta por este factor da una distancia de manejo aproximada. */
export const FACTOR_RODEO = 1.3;

/** Distancia en línea recta (haversine), en km. */
export function kmEnLineaRecta(a: UbicacionGps, b: UbicacionGps): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const unDecimal = (n: number) => Math.round(n * 10) / 10;

// shortcut: OSRM público de OpenStreetMap (gratis, sin API key; uso ligero: una consulta por obra). Con tráfico
// real, un servidor OSRM propio o de un proveedor con la misma API.
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Km de manejo de la planta a la obra, por carretera (OSRM). Si el servicio no responde o no hay ruta, la línea recta
 * por FACTOR_RODEO, marcada como aproximada para que quien cotiza la corrija si la conoce.
 */
export async function distanciaDeManejo(planta: UbicacionGps, obra: UbicacionGps): Promise<{ km: number; fuente: FuenteDistancia }> {
  try {
    const r = await fetch(`${OSRM}/${planta.lng},${planta.lat};${obra.lng},${obra.lat}?overview=false`, {
      signal: AbortSignal.timeout(6000),
    });
    const metros = ((await r.json()) as { routes?: { distance: number }[] }).routes?.[0]?.distance;
    if (metros != null) return { km: unDecimal(metros / 1000), fuente: 'carretera' };
  } catch {
    // Sin servicio: la aproximada.
  }
  return { km: unDecimal(kmEnLineaRecta(planta, obra) * FACTOR_RODEO), fuente: 'aprox' };
}
