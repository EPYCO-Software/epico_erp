import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { Icon } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { VentasService } from './datos';
import { DetallePrograma } from './detalle-programa';
import { Programa, ProgramasService, plantilla, textoPrograma } from './lealtad';
import { PlantillasPrograma } from './plantillas-programa';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Ventas → Productos → Descuentos y programas de lealtad (/ventas/descuentos-y-lealtad), como en Odoo: los programas
 * en tabla (casillas, vista previa, vista completa) y, si no hay ninguno, las plantillas para empezar. Nuevo lleva a
 * elegir plantilla.
 */
@Component({
  selector: 'app-programas',
  imports: [Icon, RouterLink, EnEncabezado, PanelLateral, DetallePrograma, PlantillasPrograma],
  template: `
    <ng-template appEnEncabezado>
      <div
        class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6"
      >
        <div class="flex items-center gap-3">
          <a routerLink="/ventas/descuentos-y-lealtad/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Descuentos y programas de lealtad</h1>
        </div>
        <form role="search" class="relative min-w-0 flex-1" (submit)="$event.preventDefault()">
          <label for="buscar-programa" class="sr-only">Buscar programas por nombre, tipo o código</label>
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="17"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave max-sm:hidden"
          />
          <input
            id="buscar-programa"
            type="search"
            autocomplete="off"
            placeholder="Buscar…"
            class="campo h-9 rounded-lg bg-white/65! pr-3 pl-3 text-[15px] sm:pl-9"
            [value]="texto()"
            (input)="texto.set($any($event.target).value)"
            (keydown.escape)="texto.set('')"
          />
        </form>
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (!servicio.programas().length) {
      <section class="glass mx-auto max-w-6xl px-6 py-10" aria-labelledby="sin-programas">
        <h2 id="sin-programas" class="text-center text-2xl font-bold">Aún no hay programas</h2>
        <p class="mt-1 text-center text-texto-suave">Crea uno desde una de estas plantillas:</p>
        <app-plantillas-programa class="mt-8" />
      </section>
    } @else {
      <div [class]="cajas.contenedor">
        <div [class]="cajas.columna">
          <div [class]="cajas.tabla">
            <div tabindex="0" role="region" aria-label="Tabla de programas" [class]="cajas.region">
              <table class="w-full text-left text-sm" [class.min-w-240]="!previa()">
                <caption class="sr-only">
                  Programas de descuento y lealtad. Clic o Enter en una fila abre su vista previa; doble clic, su vista
                  completa. La casilla solo marca.
                </caption>
                <thead [class]="cajas.titulos">
                  <tr>
                    <th scope="col" class="w-10 py-2.5 pr-1 pl-3">
                      <input
                        type="checkbox"
                        class="casilla block"
                        aria-label="Marcar todos"
                        [checked]="casillas.todas()"
                        [indeterminate]="casillas.algunas()"
                        [disabled]="!filas().length"
                        (change)="casillas.marcarTodas($any($event.target).checked)"
                      />
                    </th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Programa</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold whitespace-nowrap">Tipo</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Regla</th>
                    <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of filas(); track p.id) {
                    <tr
                      [id]="'fila-' + p.id"
                      tabindex="0"
                      [class]="fila + ' has-checked:bg-epico/6'"
                      [attr.aria-current]="p.id === vista.abiertaId() ? 'true' : null"
                      (click)="abrir(p)"
                      (dblclick)="verCompleto(p)"
                      (keydown.enter)="$event.target === $event.currentTarget && abrir(p)"
                    >
                      <!-- La casilla solo marca: no abre la vista previa ni la completa -->
                      <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                        <input
                          type="checkbox"
                          class="casilla block"
                          [attr.aria-label]="'Marcar ' + p.nombre"
                          [checked]="casillas.marcadas().includes(p.id)"
                          (change)="casillas.alternar(p.id)"
                        />
                      </td>
                      <td class="px-3 py-2.5 font-semibold">{{ p.nombre }}</td>
                      <td class="px-3 py-2.5 whitespace-nowrap">{{ tipo(p) }}</td>
                      <td class="px-3 py-2.5 text-texto-suave" [class.hidden]="previa()">{{ regla(p) }}</td>
                      <td class="px-3 py-2.5">
                        <span class="rounded-md px-2 py-0.5 text-xs font-bold" [class]="p.activo ? 'bg-[#E3EFE9] text-[#2E5E4A]' : 'bg-carbon/8 text-texto-suave'">
                          {{ p.activo ? 'Activo' : 'Archivado' }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="px-3 py-12 text-center text-texto-suave">Ningún programa coincide con la búsqueda.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        @if (previa(); as p) {
          <aside appPanelLateral (cerrar)="cerrar()">
            <app-detalle-programa [p]="p" (cerrar)="cerrar()" />
          </aside>
        }
      </div>
    }
  `,
})
export default class Programas {
  protected readonly servicio = inject(ProgramasService);
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);

  protected readonly iconoBuscar = Search;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly texto = signal('');
  protected readonly filas = computed(() => {
    const q = normalizar(this.texto().trim());
    const todos = this.servicio.programas();
    return q ? todos.filter((p) => normalizar(`${p.nombre} ${this.tipo(p)} ${p.codigo}`).includes(q)) : todos;
  });
  protected tipo(p: Programa): string {
    return plantilla(p.tipo).nombre;
  }
  protected regla(p: Programa): string {
    return textoPrograma(p, this.ventas.productos());
  }

  protected readonly casillas = seleccionMultiple(this.filas);
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`;
    return n === 1 ? '1 programa' : `${n} programas`;
  });

  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.filas().find((p) => p.id === this.vista.abiertaId()) ?? null);
  private readonly detalle = viewChild(DetallePrograma);

  private puedeDejarla(): boolean {
    return !this.detalle()?.sinGuardar() || confirm('Hay cambios sin guardar en este programa. ¿Descartarlos?');
  }

  protected abrir(p: Programa): void {
    if (p.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(p.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleto(p: Programa): void {
    if (this.puedeDejarla()) void this.router.navigate(['/ventas/descuentos-y-lealtad', p.id]);
  }
}
