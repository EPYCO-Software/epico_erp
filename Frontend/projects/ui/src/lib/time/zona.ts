/** Fechas en la zona de la planta (la hora que se muestra siempre es la de la planta, no la del navegador). */

/** "-06:00": el offset de una zona IANA en esa fecha. */
export function offsetEn(zona: string, fecha: Date): string {
  const n = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(fecha)
    .find((p) => p.type === 'timeZoneName')!.value;
  return n === 'GMT' ? '+00:00' : n.slice(3);
}

/** ISO 8601 con el offset de la zona, p. ej. 2026-11-05T10:20:00-06:00 (la hora que se muestra es la de la planta). */
export function isoEnZona(zona: string, fecha = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  );
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}:${p['second']}${offsetEn(zona, fecha)}`;
}
