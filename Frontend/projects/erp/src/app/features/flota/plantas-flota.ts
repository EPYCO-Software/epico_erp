import { computed, inject } from '@angular/core';
import { AuthService } from 'ui';
import { PlantasService } from '../../core/plantas';

/**
 * Las plantas en Logística, como en Ventas: el selector global del encabezado (por código, "ESC") filtra las listas;
 * las unidades y operadores traen el id del backend (sucursalId). Llamar en un inicializador de campo.
 */
export function plantasFlota() {
  const auth = inject(AuthService);
  const seleccion = inject(PlantasService).seleccion;
  const todas = computed(() => (auth.sesion()?.empresas ?? []).flatMap((e) => e.plantas));
  const codigos = computed(() => new Map(todas().map((p) => [p.id, p.codigo])));
  return {
    /** id y nombre de todas las plantas de la sesión (para formularios). */
    lista: computed(() => todas().map((p) => ({ id: p.id, nombre: p.nombre }))),
    nombre: (id: string | null | undefined) => todas().find((p) => p.id === id)?.nombre ?? '—',
    /**
     * ¿Alguna de esas plantas (ids del backend) está elegida en el selector? Sin plantas, o si ninguna es de la sesión
     * (root ve otras empresas y el selector no las ofrece), no hay con qué filtrar: se ve.
     */
    visible: (ids: (string | null | undefined)[]) => {
      const conocidas = ids.filter((x): x is string => !!x && codigos().has(x));
      return !conocidas.length || conocidas.some((id) => seleccion().includes(codigos().get(id)!));
    },
    /** Lo mismo para el código del front (pedidos de Ventas). */
    visibleCodigo: (codigo: string) => seleccion().includes(codigo),
  };
}
