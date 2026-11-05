import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Search } from 'lucide';
import { Icon } from 'ui';
import { Modulo, ModulosService } from '../../core/modulos';
import { AccesoModulo } from './acceso-modulo';
import { BotonFiltroModulos } from './filtro-modulos';
import { IconoModulo } from './icono-modulo';

/**
 * Pantalla de inicio del ERP (destino tras el login): módulos en una cuadrícula compacta y centrada, como un app
 * launcher. Por defecto solo los activados; con el botón de filtros del buscador se suman los favoritos o se ven
 * todos (con los favoritos arriba). El buscador del encabezado busca dentro de los filtros; en celular va aquí arriba.
 * Los módulos no activados, al abrirlos, avisan con un diálogo.
 */
@Component({
  selector: 'app-inicio',
  imports: [AccesoModulo, BotonFiltroModulos, IconoModulo, Icon],
  template: `
    <h1 class="sr-only">Módulos</h1>

    <div class="mx-auto w-full sm:w-fit">
      <form role="search" class="mb-6 md:hidden" (submit)="$event.preventDefault()">
        <label for="buscar-modulo-movil" class="sr-only">Buscar un módulo</label>
        <div class="relative">
          <!-- z-1: el backdrop-blur del campo lo vuelve una capa propia que, si no, tapa la lupa -->
          <ui-icon
            [icono]="iconoBuscar"
            [tamano]="20"
            class="pointer-events-none absolute top-1/2 left-4 z-1 -translate-y-1/2 text-texto-suave"
          />
          <input
            id="buscar-modulo-movil"
            type="search"
            autocomplete="off"
            placeholder="Buscar un módulo"
            class="campo h-12 bg-white/70! pr-14 pl-12 text-base backdrop-blur-md"
            [value]="modulos.busqueda()"
            (input)="modulos.busqueda.set($any($event.target).value)"
            (keydown.escape)="modulos.busqueda.set('')"
          />
          <app-filtro-modulos class="absolute top-1/2 right-1.5 h-9 -translate-y-1/2" />
        </div>
      </form>

      <!-- Con el filtro "Todos" se ve como el launcher completo: favoritos arriba y luego todos -->
      @if (modulos.filtros().includes('todos') && !modulos.buscando()) {
        <section aria-labelledby="favoritos-titulo" class="mb-7">
          <h2 id="favoritos-titulo" class="px-9.25 text-lg font-bold tracking-[-0.01em] text-carbon">Favoritos</h2>
          <ul class="mt-3 grid grid-cols-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            @for (m of modulos.favoritos(); track m.id) {
              <li><app-acceso-modulo [modulo]="m" favorito (noActivado)="avisar($event)" /></li>
            }
          </ul>
        </section>
      }

      <section aria-labelledby="todos-titulo">
        <h2 id="todos-titulo" tabindex="-1" class="px-9.25 text-lg font-bold tracking-[-0.01em] text-carbon outline-none">
          {{ modulos.buscando() ? 'Resultados' : titulo() }}
        </h2>
        @if (modulos.resultados().length) {
          <ul class="mt-3 grid grid-cols-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            @for (m of modulos.resultados(); track m.id) {
              <li>
                <app-acceso-modulo
                  [modulo]="m"
                  [favorito]="modulos.filtros().includes('favoritos') && modulos.favoritos().includes(m)"
                  (noActivado)="avisar($event)"
                />
              </li>
            }
          </ul>
        } @else {
          <p class="mt-3 px-9.25 text-texto-suave">
            {{ vacio() }}
            @if (!modulos.filtros().includes('todos')) {
              <button
                type="button"
                class="font-semibold text-epico-oscuro underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
                (click)="buscarEnTodos()"
              >
                Buscar en todos los módulos
              </button>
            }
          </p>
        }
      </section>
    </div>

    <!-- Anuncia el resultado de la búsqueda a lectores de pantalla -->
    <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>

    <!-- Aviso de módulo no activado. <dialog> nativo: foco atrapado, Esc y devolución del foco los da el navegador. -->
    <dialog
      #aviso
      aria-labelledby="aviso-titulo"
      class="glass-strong m-auto w-[min(27rem,calc(100%-2rem))] p-6 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="noActivado.set(null)"
    >
      <!-- El contenido está siempre, para que el botón con autofocus exista al abrir el diálogo -->
      <div class="flex items-start gap-4">
        <span class="flex size-14 shrink-0 items-center justify-center rounded-[10px] border border-white bg-white shadow-[0_1px_2px_rgb(26_26_28/0.08),0_6px_14px_-6px_rgb(26_26_28/0.18)]">
          @if (noActivado(); as m) {
            <app-icono-modulo [modulo]="m.id" class="size-11" />
          }
        </span>
        <div>
          <h2 id="aviso-titulo" class="text-lg leading-snug font-bold">{{ noActivado()?.nombre }} no está activado</h2>
          <p class="mt-1.5 text-texto-suave">
            Este módulo no está activado actualmente para tu empresa. Si lo necesitas, pide a tu administrador que lo
            active.
          </p>
        </div>
      </div>
      <form method="dialog" class="mt-6 flex justify-end">
        <button type="submit" class="boton-primario h-11 w-auto px-6" autofocus>Entendido</button>
      </form>
    </dialog>
  `,
})
export default class Inicio {
  protected readonly modulos = inject(ModulosService);
  protected readonly iconoBuscar = Search;
  protected readonly noActivado = signal<Modulo | null>(null);
  private readonly aviso = viewChild.required<ElementRef<HTMLDialogElement>>('aviso');

  private readonly injector = inject(Injector);

  /** "Módulos activados", "Módulos activados y favoritos"… */
  protected readonly titulo = computed(() =>
    this.modulos.filtros().includes('todos') ? 'Todos los módulos' : `Módulos ${this.modulos.descripcion()}`,
  );
  /** Al buscar o cambiar de filtro se anuncia cuántos quedan. */
  protected readonly anuncio = computed(() => {
    const n = this.modulos.resultados().length;
    if (!this.modulos.buscando()) return `${this.titulo()}: ${n}`;
    return n === 1 ? '1 módulo encontrado' : `${n} módulos encontrados`;
  });
  protected readonly vacio = computed(() => {
    const texto = this.modulos.busqueda().trim();
    if (this.modulos.filtros().includes('todos')) return `No hay módulos que coincidan con «${texto}».`;
    const cuales = `módulos ${this.modulos.descripcion()}`;
    return texto ? `Ninguno de los ${cuales} coincide con «${texto}».` : `Aún no hay ${cuales}.`;
  });

  constructor() {
    effect(() => {
      const dialogo = this.aviso().nativeElement;
      if (this.noActivado() && !dialogo.open) dialogo.showModal();
    });
  }

  protected avisar(m: Modulo): void {
    this.noActivado.set(m);
  }

  /** El botón desaparece al haber resultados: el foco pasa al título de la lista. */
  protected buscarEnTodos(): void {
    this.modulos.alternarFiltro('todos');
    afterNextRender(() => document.getElementById('todos-titulo')?.focus(), { injector: this.injector });
  }
}
