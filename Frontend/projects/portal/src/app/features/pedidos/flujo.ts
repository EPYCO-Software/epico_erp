import { CotizacionGuardada, EstadoPedido, EtapaPipeline, Pedido } from 'ui';

const FASE: Record<EstadoPedido, number> = { programado: 1, en_planta: 1, en_ruta: 2, en_obra: 2, entregado: 3, cancelado: -1 };

/**
 * Etapas del flujo cotización → pedido → entrega para la barra del encabezado. Cada etapa con documento enlaza a
 * él, salvo la de la página en la que se está.
 */
export function etapasFlujo(
  cotizacion: CotizacionGuardada | null,
  pedidos: Pick<Pedido, 'folio' | 'estado'>[],
  pagina: 'cotizacion' | 'pedido',
): EtapaPipeline[] {
  const fase = Math.max(0, ...pedidos.map((p) => FASE[p.estado]));
  const estado = (i: number): EtapaPipeline['estado'] => (i < fase ? 'hecha' : i === fase ? 'actual' : 'pendiente');
  const activos = pedidos.filter((p) => p.estado !== 'cancelado');
  return [
    {
      etiqueta: 'Cotización',
      estado: cotizacion ? estado(0) : 'pendiente',
      detalle: cotizacion?.folio ?? 'Sin cotización',
      enlace: cotizacion && pagina !== 'cotizacion' ? `/cotizaciones/${cotizacion.folio}` : undefined,
    },
    {
      etiqueta: 'Pedido',
      estado: estado(1),
      detalle: activos.length === 1 ? activos[0].folio : activos.length ? `${activos.length} pedidos` : undefined,
      enlace: activos.length === 1 && pagina !== 'pedido' ? `/pedidos/${activos[0].folio}` : activos.length > 1 ? '/pedidos' : undefined,
    },
    { etiqueta: 'En entrega', estado: estado(2) },
    { etiqueta: 'Entregado', estado: estado(3) },
  ];
}
