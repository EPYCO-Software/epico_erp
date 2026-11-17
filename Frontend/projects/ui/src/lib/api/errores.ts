import { HttpErrorResponse } from '@angular/common/http';

/** El mensaje de un error de la API para mostrarlo: el detail del ProblemDetails, o uno genérico según el status. */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Intenta de nuevo en un momento.';
    const detalle = (e.error as { detail?: string } | null)?.detail;
    if (detalle) return detalle;
    if (e.status === 403) return 'No tienes permiso para hacer esto.';
    if (e.status === 409) return 'No se puede: el registro está en uso.';
  }
  return 'No se pudo completar. Intenta de nuevo.';
}
