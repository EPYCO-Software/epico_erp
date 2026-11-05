/**
 * Teclado de pestañas ARIA (role="tab"): flechas izquierda/derecha, Inicio y Fin. Enfoca la pestaña destino y
 * devuelve su índice, o -1 si la tecla no es de navegación. Uso: `(keydown)="elegir(moverEntrePestanas($event, i))"`.
 */
export function moverEntrePestanas(e: KeyboardEvent, i: number): number {
  const lista = (e.currentTarget as HTMLElement).closest('[role="tablist"]');
  const pestanas = [...(lista?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
  const n = pestanas.length;
  const destinos: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
  const destino = destinos[e.key] ?? -1;
  if (destino >= 0) {
    e.preventDefault();
    pestanas[destino].focus();
  }
  return destino;
}
