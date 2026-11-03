import { TestBed } from '@angular/core/testing';
import { CotizacionService } from './cotizacion.service';
import { PedidosService } from './pedidos.service';

describe('PedidosService', () => {
  it('el pedido demo está ligado a la cotización demo CZM y usa la zona de su planta', () => {
    const s = TestBed.inject(PedidosService);
    const [p] = s.deCotizacion('c-demo-2');
    expect(p).toMatchObject({ folio: 'PED-26-0141', obraNombre: 'Torre Norte', zonaHoraria: 'America/Cancun' });
  });

  it('aceptar una cotización genera un pedido por partida, con su obra, entrega y planta', () => {
    const s = TestBed.inject(PedidosService);
    const c = TestBed.inject(CotizacionService).buscarCotizacion('c-demo-1')!;
    const nuevos = s.generarDesdeCotizacion(c);
    expect(nuevos.map((p) => [p.folio, p.obraId, p.plantaId, p.cotizacionId])).toEqual([
      ['PED-26-0142', 'o2', 'ESC', 'c-demo-1'],
      ['PED-26-0143', 'o1', 'CZM', 'c-demo-1'],
    ]);
    expect(nuevos[1].fechaHoraEntrega).toBe(c.partidas[1].entrega);
    expect(nuevos[0]).toMatchObject({ cobro: 'por_facturar', importe: 99528 }); // 20 m³ f´c 200 + bombeo + muestreo, con IVA
    expect(s.deCotizacion('c-demo-1')).toHaveLength(2);
  });

  it('obra con pedido en curso: bloqueada; con solo entregados: editable', () => {
    const s = TestBed.inject(PedidosService);
    expect(s.obraConPedidoEnCurso('o1')).toBe(true); // PED-26-0141 programado
    expect(s.obraConPedidoEnCurso('o2')).toBe(false); // todos entregados
  });

  it('resume importes: total, pagado y pendiente', () => {
    const r = TestBed.inject(PedidosService).resumen();
    expect(r).toEqual({ total: 109968 + 217210 + 107184 + 31088 + 68730, pagado: 109968 + 68730, pendiente: 217210 + 107184 + 31088 });
  });
});
