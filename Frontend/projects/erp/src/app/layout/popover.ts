/**
 * Coloca un `popover` (capa superior, sin layout del padre) bajo su botón, alineado a su borde derecho y sin salirse
 * de la ventana. `anchoMax` es el ancho de la clase del panel en px (p. ej. 480 para `w-[min(30rem,calc(100vw-1rem))]`):
 * cerrado no se puede medir. Usar en `(beforetoggle)` al abrir.
 */
export function colocarBajo(panel: HTMLElement, boton: HTMLElement, anchoMax: number): void {
  const r = boton.getBoundingClientRect();
  const ancho = Math.min(anchoMax, innerWidth - 16);
  panel.style.top = `${r.bottom + 8}px`;
  panel.style.right = `${Math.max(8, Math.min(innerWidth - r.right, innerWidth - ancho - 8))}px`;
}
