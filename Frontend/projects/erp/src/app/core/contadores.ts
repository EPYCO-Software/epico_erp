import { Injector, Service, computed, inject } from '@angular/core';
import { VentasService } from '../features/ventas/datos';
import { sinCamion } from '../features/flota/flota-api';
import { ClaveContador } from './modulos';
import { PlantasService } from './plantas';

/**
 * Los marcadores del menú del encabezado (p. ej. "Órdenes 16" en Logística). Cada uno se calcula solo cuando el menú lo
 * pide: así VentasService (que carga los datos de ventas) no se crea en módulos que no lo usan.
 */
@Service()
export class ContadoresMenu {
  private readonly injector = inject(Injector);
  private sinCamionCalc?: () => number;

  valor(clave: ClaveContador): number {
    switch (clave) {
      case 'logistica.sin-camion': {
        if (!this.sinCamionCalc) {
          const ventas = this.injector.get(VentasService);
          const plantas = this.injector.get(PlantasService);
          // Las de las plantas elegidas en el encabezado, igual que la página de Órdenes
          this.sinCamionCalc = computed(() => sinCamion(ventas.pedidos().filter((p) => plantas.seleccion().includes(p.plantaId))));
        }
        return this.sinCamionCalc();
      }
    }
  }
}
