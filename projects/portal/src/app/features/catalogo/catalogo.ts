import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { ArrowLeft, ArrowLeftRight, ChevronRight, Plus } from 'lucide';
import { Desvanecer, Icon } from 'ui';
import { CotizadorState, PASOS } from './cotizador.state';
import { PasoEspecificaciones } from './paso-especificaciones';
import { PasoServicios } from './paso-servicios';
import { PasoSolucion } from './paso-solucion';
import { Resumen } from './resumen';
import { ResumenCotizacion } from './resumen-cotizacion';

@Component({
  selector: 'app-catalogo',
  imports: [Desvanecer, Icon, PasoSolucion, PasoEspecificaciones, PasoServicios, Resumen, ResumenCotizacion],
  providers: [CotizadorState],
  templateUrl: './catalogo.html',
})
export default class Catalogo {
  protected readonly s = inject(CotizadorState);
  protected readonly pasos = PASOS;
  protected readonly iconos = { siguiente: ChevronRight, cambiar: ArrowLeftRight, volver: ArrowLeft, agregar: Plus };

  private readonly contenido = viewChild<ElementRef<HTMLElement>>('contenido');
  private pasoAnterior = this.s.paso();

  constructor() {
    // Al cambiar de paso: volver arriba y llevar el foco al título del paso (teclado y lector de pantalla).
    afterRenderEffect(() => {
      const paso = this.s.paso();
      if (paso === this.pasoAnterior) return;
      this.pasoAnterior = paso;
      this.contenido()?.nativeElement.scrollTo({ top: 0 });
      document.getElementById('paso-titulo')?.focus({ preventScroll: true });
    });
  }

  /** Paso numérico actual (1–3; 4 = enviando) para el indicador. */
  protected numeroPaso(): number {
    const p = this.s.paso();
    return p === 'enviar' ? 4 : p;
  }

  protected irAPaso(n: number): void {
    void this.s.irA(n as 1 | 2 | 3);
  }
}
