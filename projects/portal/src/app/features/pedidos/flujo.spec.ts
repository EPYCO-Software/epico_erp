import { CotizacionGuardada } from 'ui';
import { etapasFlujo } from './flujo';

const cot = { id: 'c1', folio: 'EPI-WEB-CZM-26002' } as CotizacionGuardada;

describe('etapasFlujo', () => {
  it('cotización sin pedido: la cotización es la etapa actual y no se enlaza a sí misma', () => {
    const e = etapasFlujo(cot, [], 'cotizacion');
    expect(e.map((x) => x.estado)).toEqual(['actual', 'pendiente', 'pendiente', 'pendiente']);
    expect(e[0].enlace).toBeUndefined();
  });

  it('desde el pedido se puede regresar a la cotización', () => {
    const e = etapasFlujo(cot, [{ folio: 'PED-26-0141', estado: 'programado' }], 'pedido');
    expect(e.map((x) => x.estado)).toEqual(['hecha', 'actual', 'pendiente', 'pendiente']);
    expect(e[0].enlace).toBe('/cotizaciones/EPI-WEB-CZM-26002');
    expect(e[1]).toMatchObject({ detalle: 'PED-26-0141', enlace: undefined });
  });

  it('desde la cotización se va al pedido; avanza con el pedido más adelantado e ignora cancelados', () => {
    const e = etapasFlujo(cot, [{ folio: 'PED-1', estado: 'en_ruta' }, { folio: 'PED-2', estado: 'cancelado' }], 'cotizacion');
    expect(e.map((x) => x.estado)).toEqual(['hecha', 'hecha', 'actual', 'pendiente']);
    expect(e[1]).toMatchObject({ detalle: 'PED-1', enlace: '/pedidos/PED-1' });
  });
});
