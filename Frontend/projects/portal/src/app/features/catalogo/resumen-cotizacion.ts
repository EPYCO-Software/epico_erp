import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArrowLeft, CalendarClock, Check, CircleCheck, Download, GitBranch, Info, LoaderCircle, MapPin, Save, Trash2 } from 'lucide';
import { AuthService, Icon, MAQUINARIA, Mapa, PartidaCotizacion, SERVICIOS, agruparPorObra, descargarCotizacionPdf, etiquetas, fechaHoraCorta, lineasPartida, pesos, plantaPara, totales } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { CotizadorState } from './cotizador.state';

type Accion = 'descargar-guardar' | 'guardar' | 'descargar';

/** Resumen completo antes de pedir precios: todo lo cotizado, agrupado por obra de entrega, con importes de referencia. */
@Component({
  selector: 'app-resumen-cotizacion',
  imports: [DecimalPipe, Icon, Mapa, RouterLink],
  template: `
    <section aria-labelledby="paso-titulo" class="glass mx-auto max-w-6xl p-5 sm:p-7">
      @if (guardada(); as folio) {
        <div class="py-6 text-center">
          <ui-icon [icono]="iconos.listo" [tamano]="44" class="text-correcto" />
          <h1 id="paso-titulo" tabindex="-1" class="mt-3 text-2xl font-bold tracking-[-0.01em] outline-none">Cotización {{ folio }} guardada</h1>
          <p class="mt-1 text-texto-suave">La encuentras en Mis cotizaciones, donde también puedes descargarla en PDF.</p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <a routerLink="/cotizaciones" class="boton-primario h-12 w-auto px-6">Ver mis cotizaciones</a>
            <button type="button" [class]="botonSecundario" (click)="nueva()">Nueva cotización</button>
          </div>
        </div>
      } @else {
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id="paso-titulo" tabindex="-1" class="text-2xl font-bold tracking-[-0.01em] outline-none">Resumen de tu cotización</h1>
            <p class="mt-1 text-sm text-texto-suave">
              {{ s.partidas().length }} {{ s.partidas().length === 1 ? 'producto' : 'productos' }} · {{ s.volumenTotal() | number: '1.0-1' }} m³ ·
              {{ grupos().length }} {{ grupos().length === 1 ? 'obra' : 'obras' }}
            </p>
          </div>
          <button type="button" [class]="botonSecundario" (click)="s.paso.set(1)">
            <ui-icon [icono]="iconos.volver" [tamano]="18" />Seguir agregando
          </button>
        </div>

        @if (cotizacion.edicion(); as e) {
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/40 bg-[#EAF3F7] px-4 py-3 text-sm">
            <p class="flex items-start gap-2">
              <ui-icon [icono]="iconos.serie" [tamano]="18" class="mt-px shrink-0 text-[#2B5F75]" />
              <span>
                <span class="font-semibold">{{ e.modo === 'revision' ? 'Modificando ' + e.origen.folio : 'Nueva cotización tomando de base ' + e.origen.folio }}.</span>
                Se guardará como {{ e.modo === 'revision' ? cotizacion.referenciaEdicion() : 'cotización nueva' }}; la original no cambia.
              </span>
            </p>
            <button
              type="button"
              class="min-h-10 rounded font-semibold text-[#2B5F75] underline underline-offset-4 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
              (click)="descartar()"
            >
              Descartar cambios
            </button>
          </div>
        }

        @for (g of grupos(); track g.obra.id) {
          <section [attr.aria-labelledby]="'entrega-' + g.obra.id" class="mt-6 rounded-2xl bg-white/80 p-4 shadow-sm sm:p-5">
            <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div class="min-w-0">
                <h2 [id]="'entrega-' + g.obra.id" class="flex items-center gap-2 text-lg font-bold">
                  <ui-icon [icono]="iconos.obra" [tamano]="20" class="text-epico" />Entrega en {{ g.obra.nombre }}
                </h2>
                <p class="mt-0.5 text-sm text-texto-suave">{{ g.obra.direccion }} · {{ g.obra.municipio }}</p>
                @if (g.obra.referencias) {
                  <p class="mt-1 text-sm"><span class="font-medium">Referencias:</span> {{ g.obra.referencias }}</p>
                }
                <p class="mt-1 text-sm font-medium">{{ g.volumen | number: '1.0-1' }} m³ en esta obra</p>

                <ul class="mt-4 space-y-3">
                  @for (p of g.partidas; track p.id) {
                    <li class="rounded-xl border border-acero/60 bg-white p-4">
                      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 class="font-bold">{{ p.nombre }}</h3>
                        <p class="flex items-center gap-3 font-semibold">
                          {{ p.volumenM3 | number: '1.0-1' }} m³
                          <button
                            type="button"
                            class="flex size-9 items-center justify-center rounded-lg text-texto-suave hover:bg-carbon/5 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico"
                            [attr.aria-label]="'Quitar ' + p.nombre + ' de la cotización'"
                            (click)="s.quitarPartida(p.id)"
                          >
                            <ui-icon [icono]="iconos.quitar" [tamano]="18" />
                          </button>
                        </p>
                      </div>
                      <ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Especificaciones de {{ p.nombre }}">
                        @for (t of etiquetas(p); track t) {
                          <li class="rounded-lg bg-carbon/5 px-2.5 py-1 text-sm">{{ t }}</li>
                        }
                        @if (p.especificacion.colocacion === 'bombeo') {
                          <li class="flex items-center gap-1 rounded-lg bg-[#FDF2F2] px-2.5 py-1 text-sm font-medium text-epico-oscuro">
                            <ui-icon [icono]="iconos.check" [tamano]="14" />Bombeo incluido
                          </li>
                        }
                      </ul>
                      <dl class="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                        <dt class="text-texto-suave">Entrega</dt>
                        <dd class="flex items-center gap-1.5">
                          <ui-icon [icono]="iconos.fecha" [tamano]="15" class="text-texto-suave" />{{ fecha(p.entrega) }}
                          @if (p.servicios.includes('colado-nocturno')) {
                            <span class="text-texto-suave">· horario nocturno</span>
                          }
                        </dd>
                        <dt class="text-texto-suave">Servicios</dt>
                        <dd>{{ servicios(p) || 'Ninguno' }}</dd>
                        @if (p.maquinaria.length) {
                          <dt class="text-texto-suave">Maquinaria</dt>
                          <dd>{{ maquinaria(p) }}</dd>
                        }
                      </dl>
                      <div class="relative mt-3 overflow-x-auto rounded focus-visible:outline-2 focus-visible:outline-epico" tabindex="0" role="region" [attr.aria-label]="'Importes de ' + p.nombre">
                        <table class="w-full min-w-md text-sm">
                          <caption class="sr-only">Importes de {{ p.nombre }}</caption>
                          <thead>
                            <tr class="border-b border-acero/60 text-left text-xs tracking-wide text-texto-suave uppercase">
                              <th scope="col" class="py-1.5 pr-3 font-semibold">Concepto</th>
                              <th scope="col" class="px-3 py-1.5 text-right font-semibold">Precio</th>
                              <th scope="col" class="px-3 py-1.5 text-right font-semibold">Cantidad</th>
                              <th scope="col" class="py-1.5 pl-3 text-right font-semibold">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (l of lineas(p); track $index) {
                              <tr class="border-b border-acero/30 last:border-0">
                                <td class="py-1.5 pr-3">{{ l.concepto }}</td>
                                <td class="px-3 py-1.5 text-right whitespace-nowrap">\${{ pesos(l.precio) }}</td>
                                <td class="px-3 py-1.5 text-right whitespace-nowrap">{{ l.cantidad | number: '1.0-2' }} {{ l.unidad }}</td>
                                <td class="py-1.5 pl-3 text-right font-medium whitespace-nowrap">\${{ pesos(l.importe) }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </li>
                  }
                </ul>
              </div>
              <ui-mapa
                class="h-56 lg:h-full lg:min-h-72"
                [ubicacion]="g.obra.ubicacion"
                [direccion]="g.obra.direccion + ', ' + g.obra.municipio"
                [titulo]="'Mapa de la obra ' + g.obra.nombre"
              />
            </div>
          </section>
        } @empty {
          <p class="mt-6 rounded-xl bg-white/70 px-5 py-8 text-center text-texto-suave">Tu cotización está vacía. Agrega al menos un producto.</p>
        }

        @if (grupos().length) {
          <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div class="order-2 lg:order-1">
              <fieldset>
                <legend class="font-bold">¿Qué hacemos con tu cotización?</legend>
                <div class="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-carbon/5 p-1">
                  @for (o of opciones; track o.id) {
                    <label class="segmento px-4">
                      <input type="radio" name="accion" class="sr-only" [value]="o.id" [checked]="accion() === o.id" (change)="accion.set(o.id)" />
                      {{ o.texto }}
                    </label>
                  }
                </div>
              </fieldset>
              <button type="button" class="boton-primario mt-4 h-12 sm:w-auto sm:px-8" [disabled]="ocupado()" [attr.aria-busy]="ocupado()" (click)="confirmar()">
                <ui-icon [icono]="ocupado() ? iconos.cargando : accion() === 'guardar' ? iconos.guardar : iconos.descargar" [class.animate-spin]="ocupado()" />
                {{ textoBoton() }}
              </button>
              <p class="mt-2 text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-correcto'" aria-live="polite">{{ error() || aviso() }}</p>
            </div>

            <dl class="order-1 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-xl bg-white/80 p-4 shadow-sm lg:order-2">
              <dt class="text-texto-suave">Subtotal</dt>
              <dd class="text-right">\${{ pesos(total().subtotal) }}</dd>
              <dt class="text-texto-suave">IVA 16%</dt>
              <dd class="text-right">\${{ pesos(total().iva) }}</dd>
              <dt class="border-t border-acero/60 pt-1.5 text-lg font-bold">Neto</dt>
              <dd class="border-t border-acero/60 pt-1.5 text-right text-lg font-bold">\${{ pesos(total().neto) }}</dd>
            </dl>
          </div>
        }

        <p class="mt-6 flex items-start gap-3 rounded-xl bg-[#FDF2F2] px-4 py-3 text-sm">
          <ui-icon [icono]="iconos.info" [tamano]="20" class="mt-px shrink-0 text-epico" />
          Precios de referencia en MXN, sujetos a confirmación de tu asesor. Las fechas de entrega son estimadas. No se generará un pedido
          hasta que aceptes la cotización.
        </p>
      }
    </section>
  `,
})
export class ResumenCotizacion {
  protected readonly s = inject(CotizadorState);
  protected readonly cotizacion = inject(CotizacionService);
  private readonly auth = inject(AuthService);
  protected readonly iconos = {
    volver: ArrowLeft, obra: MapPin, check: Check, info: Info, fecha: CalendarClock,
    descargar: Download, guardar: Save, cargando: LoaderCircle, listo: CircleCheck, serie: GitBranch, quitar: Trash2,
  };
  protected readonly botonSecundario =
    'flex h-11 items-center gap-2 rounded-xl border border-acero-oscuro bg-white px-4 font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly opciones: { id: Accion; texto: string }[] = [
    { id: 'descargar-guardar', texto: 'Descargar y guardar' },
    { id: 'guardar', texto: 'Solo guardar' },
    { id: 'descargar', texto: 'Solo descargar' },
  ];
  protected readonly accion = signal<Accion>('descargar-guardar');
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  /** Folio de la cotización recién guardada (muestra la confirmación). */
  protected readonly guardada = signal<string | null>(null);
  /** Folio de una descarga sin guardar: se reutiliza si vuelve a descargar o después la guarda. */
  private folio: string | null = null;

  protected readonly etiquetas = (p: PartidaCotizacion) => etiquetas(p.especificacion);
  protected readonly lineas = lineasPartida;
  protected readonly pesos = pesos;
  protected readonly fecha = fechaHoraCorta;
  protected readonly grupos = computed(() => agruparPorObra(this.s.partidas(), this.s.obras()));
  protected readonly total = computed(() => totales(this.s.partidas().flatMap(lineasPartida)));
  protected readonly textoBoton = computed(() => this.opciones.find((o) => o.id === this.accion())!.texto);

  protected async confirmar(): Promise<void> {
    const accion = this.accion();
    const fecha = new Date();
    const folio = (this.folio ??= this.cotizacion.nuevoFolio(plantaPara(this.grupos()[0]?.obra).clave, fecha));
    this.error.set('');
    this.aviso.set('');
    this.ocupado.set(true);
    try {
      if (accion !== 'guardar') {
        const usuario = this.auth.sesion()?.usuario ?? { nombre: 'Cliente', correo: '' };
        const referencia = this.cotizacion.referenciaEdicion() ?? undefined;
        await descargarCotizacionPdf({ folio, fecha, cliente: usuario, partidas: this.s.partidas(), obras: this.s.obras(), referencia });
      }
      if (accion === 'descargar') {
        this.aviso.set(`Descargaste ${folio}.pdf. Aún no está guardada en Mis cotizaciones.`);
        return;
      }
      this.cotizacion.guardarCotizacion(folio, fecha);
      this.folio = null;
      this.guardada.set(folio);
      setTimeout(() => document.getElementById('paso-titulo')?.focus());
    } catch {
      this.error.set('No pudimos generar el PDF. Intenta de nuevo.');
    } finally {
      this.ocupado.set(false);
    }
  }

  protected descartar(): void {
    this.cotizacion.cancelarEdicion();
    this.folio = null;
    this.aviso.set('');
    this.s.paso.set(1);
  }

  protected nueva(): void {
    this.guardada.set(null);
    this.s.paso.set(1);
  }

  protected servicios(p: PartidaCotizacion): string {
    return SERVICIOS.filter((sv) => p.servicios.includes(sv.id) && sv.id !== 'renta-maquinaria')
      .map((sv) => sv.nombre)
      .join(', ');
  }

  protected maquinaria(p: PartidaCotizacion): string {
    return p.maquinaria.map((m) => `${MAQUINARIA.find((x) => x.id === m.tipo)!.nombre} (${m.dias} ${m.dias === 1 ? 'día' : 'días'})`).join(', ');
  }
}
