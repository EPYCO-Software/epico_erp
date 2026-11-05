import { Component, DOCUMENT, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { CdkMenu, CdkMenuBar, CdkMenuGroup, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, containsTree } from '@angular/router';
import { filter } from 'rxjs';
import { CircleHelp, Grip, Search, Settings } from 'lucide';
import { Icon, OpcionUsuario, UserMenu } from 'ui';
import { Modulo, ModulosService, buscarModulo, enlacesDelMenu } from '../core/modulos';
import { BotonFiltroModulos } from '../features/inicio/filtro-modulos';
import { IconoModulo } from '../features/inicio/icono-modulo';
import { Ayuda } from './ayuda';
import { BarraEncabezado } from './barra-encabezado';
import { MenuMensajeria } from './menu-mensajeria';
import { Preferencias } from './preferencias';
import { SelectorPlantas } from './selector-plantas';

/**
 * Encabezado de todo el ERP, de lado a lado y pegado arriba. La barra es invisible: sin fondo, borde ni sombra; solo
 * desenfoca lo que pasa por debajo al hacer scroll (sobre el fondo liso no se nota). Logo a la izquierda (vuelve a los
 * módulos), buscador de módulos al centro (⌘K / Ctrl+K; al final, el botón de filtros) y, pegados a la derecha, el globo de mensajes (notificaciones,
 * chats y canales, como Odoo), plantas y menú de usuario (al pasar el mouse: Ayuda, Mis preferencias, Cerrar sesión).
 * Dentro de un módulo (data.modulo de la ruta), como Odoo: en vez del logo y el buscador, el botón para volver a los
 * módulos, el icono y nombre del módulo y sus menús desplegables; debajo, la barra de la página si la declara
 * (barra-encabezado.ts).
 */
@Component({
  selector: 'app-encabezado',
  imports: [
    NgOptimizedImage,
    NgTemplateOutlet,
    CdkMenuBar,
    CdkMenu,
    CdkMenuGroup,
    CdkMenuItem,
    CdkMenuTrigger,
    RouterLink,
    RouterLinkActive,
    Icon,
    IconoModulo,
    UserMenu,
    SelectorPlantas,
    MenuMensajeria,
    Ayuda,
    Preferencias,
    BotonFiltroModulos,
  ],
  host: { class: 'sticky top-0 z-30 block', '(document:keydown)': 'atajo($event)' },
  template: `
    <header class="backdrop-blur-xl">
      <div
        class="flex items-center gap-3 px-4 lg:px-6"
        [class]="
          modulo()
            ? 'min-h-14 flex-wrap lg:flex-nowrap'
            : 'h-14 justify-between md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,730px)_minmax(max-content,1fr)] md:gap-6'
        "
      >
      @if (modulo(); as m) {
        <!-- Dentro de un módulo, como Odoo: volver a los módulos, icono y nombre del módulo y su menú -->
        <a
          routerLink="/inicio"
          aria-label="Volver a módulos"
          class="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-carbon transition-colors hover:bg-carbon/5 focus-visible:outline-2 focus-visible:outline-epico"
        >
          <ui-icon [icono]="iconos.modulos" [tamano]="22" />
        </a>
        <a
          [routerLink]="m.ruta"
          class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico lg:flex-none"
        >
          <app-icono-modulo [modulo]="m.id" class="size-7 shrink-0" />
          <span class="truncate text-lg font-semibold tracking-[-0.01em] text-carbon">{{ m.nombre }}</span>
        </a>
        @if (m.menu) {
          <!-- Menús desplegables como Odoo (CDK Menu: con uno abierto, al pasar el mouse por otro se abre ese; flechas
               entre menús). Se subraya el que contiene la página abierta. En celular, segunda fila con scroll de lado. -->
          <nav
            [attr.aria-label]="'Menú de ' + m.nombre"
            class="sin-barra order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-2 lg:order-0 lg:mx-0 lg:ml-3 lg:w-auto lg:px-0"
          >
            <div cdkMenuBar class="flex h-11 items-stretch lg:h-14">
              @for (g of m.menu; track g.nombre) {
                <button
                  type="button"
                  cdkMenuItem
                  [cdkMenuTriggerFor]="panel"
                  [attr.aria-current]="g === menuActivo() || null"
                  class="group relative flex items-center px-1 text-[15px] whitespace-nowrap text-texto-suave after:absolute after:inset-x-3 after:bottom-0 after:h-0.75 after:rounded-full hover:text-carbon focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-epico aria-current:font-semibold aria-current:text-carbon aria-current:after:bg-epico aria-expanded:text-carbon"
                >
                  <span class="rounded-lg px-2 py-1.5 transition-colors group-hover:bg-carbon/5 group-aria-expanded:bg-carbon/8">{{
                    g.nombre
                  }}</span>
                </button>
                <ng-template #panel>
                  <!-- El CDK lo pinta al final de <body>; la región con nombre lo deja dentro de un landmark (axe "region"). -->
                  <section [attr.aria-label]="g.nombre">
                    <div
                      cdkMenu
                      [attr.aria-label]="g.nombre"
                      class="glass-strong mt-1 max-h-[calc(100dvh-6rem)] min-w-52 scroll-caja p-1.5 text-[15px] text-carbon"
                    >
                      @for (e of g.enlaces; track e.ruta) {
                        <a cdkMenuItem [routerLink]="e.ruta" routerLinkActive ariaCurrentWhenActive="page" class="px-3" [class]="claseEnlace">{{
                          e.nombre
                        }}</a>
                      }
                      @for (s of g.secciones; track s.titulo; let i = $index) {
                        <div cdkMenuGroup [attr.aria-labelledby]="'menu-seccion-' + i" class="mt-1">
                          <div [id]="'menu-seccion-' + i" class="px-3 pt-2 pb-1 text-[13px] font-semibold text-texto-suave">
                            {{ s.titulo }}
                          </div>
                          @for (e of s.enlaces; track e.ruta) {
                            <a cdkMenuItem [routerLink]="e.ruta" routerLinkActive ariaCurrentWhenActive="page" class="pr-3 pl-6" [class]="claseEnlace">{{
                              e.nombre
                            }}</a>
                          }
                        </div>
                      }
                    </div>
                  </section>
                </ng-template>
              }
            </div>
          </nav>
        }
      } @else {
      <a
        routerLink="/inicio"
        aria-label="EPICO ERP, ir a módulos"
        class="flex w-fit items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-epico"
      >
        <img ngSrc="/ui/marca/logo-epico-erp-horizontal.webp" width="1200" height="383" priority alt="" class="h-8.5 w-auto" />
      </a>

      <form role="search" class="hidden md:block" (submit)="$event.preventDefault()">
        <label for="buscar-modulo" class="sr-only">Buscar un módulo</label>
        <div class="relative">
          <ui-icon
            [icono]="iconos.buscar"
            [tamano]="20"
            class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-texto-suave"
          />
          <input
            #buscador
            id="buscar-modulo"
            type="search"
            autocomplete="off"
            placeholder="Buscar un módulo"
            aria-keyshortcuts="Meta+K Control+K"
            class="campo h-9 rounded-lg bg-white/65! pr-28 pl-12 text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
            [value]="modulos.busqueda()"
            (input)="buscar($any($event.target).value)"
            (keydown.escape)="buscar('')"
          />
          <span class="pointer-events-none absolute top-1/2 right-10 flex -translate-y-1/2 gap-1" aria-hidden="true">
            @for (t of [teclaMod, 'K']; track t) {
              <kbd
                class="flex h-6 min-w-6 items-center justify-center rounded-md border border-carbon/10 bg-carbon/5 px-1.5 font-sans text-xs text-texto-suave"
                >{{ t }}</kbd
              >
            }
          </span>
          <app-filtro-modulos class="absolute top-1/2 right-1 h-7 -translate-y-1/2" />
        </div>
      </form>
      }

      <div class="ml-auto flex items-center justify-end gap-0.5 justify-self-end sm:gap-1.5">
        <app-menu-mensajeria />

        <span class="mx-2 hidden h-7 w-px bg-carbon/12 sm:block" aria-hidden="true"></span>

        <app-selector-plantas />

        <ui-user-menu [letras]="2" claro [opciones]="opcionesUsuario" (elegir)="abrirDialogo($event)" />
      </div>
      </div>

      @if (barra.plantilla(); as plantilla) {
        <!-- Barra de la página (barra-encabezado.ts): de lado a lado, alineada con el menú y con el <main> -->
        <div class="px-4 pb-2 lg:px-6">
          <ng-container [ngTemplateOutlet]="plantilla" />
        </div>
      }
    </header>

    <!-- Fuera del <header>: su backdrop-filter no debe envolver a los diálogos -->
    <app-ayuda [(abierto)]="ayudaAbierta" [teclaMod]="teclaMod" />
    <app-preferencias [(abierto)]="preferenciasAbiertas" />
  `,
})
export class Encabezado {
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly modulos = inject(ModulosService);
  protected readonly barra = inject(BarraEncabezado);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  /** Módulo de la página actual; sin módulo (inicio, avisos) el encabezado lleva logo y buscador. */
  protected readonly modulo = signal(this.moduloDeLaRuta());
  /** El menú del módulo con la página abierta (por segmentos: /ventas/cotizaciones/nueva es de "Órdenes"). */
  protected readonly menuActivo = computed(() => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl;
    return url && this.modulo()?.menu?.find((g) => enlacesDelMenu(g).some((e) => containsTree(url, this.router.parseUrl(e.ruta))));
  });
  protected readonly claseEnlace =
    'block rounded-lg py-1.5 whitespace-nowrap transition-colors hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico aria-[current=page]:font-semibold';

  private readonly nav = inject(DOCUMENT).defaultView?.navigator;
  protected readonly teclaMod = /Mac|iPhone|iPad/i.test(this.nav?.platform || this.nav?.userAgent || '') ? '⌘' : 'Ctrl';
  protected readonly iconos = { buscar: Search, modulos: Grip };
  protected readonly opcionesUsuario: OpcionUsuario[] = [
    { id: 'ayuda', etiqueta: 'Ayuda', icono: CircleHelp },
    { id: 'preferencias', etiqueta: 'Mis preferencias', icono: Settings },
  ];
  protected readonly ayudaAbierta = signal(false);
  protected readonly preferenciasAbiertas = signal(false);

  constructor() {
    // Al entrar a un módulo se limpia la búsqueda, para que al volver se vean todos.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        if (!e.urlAfterRedirects.startsWith('/inicio')) this.modulos.busqueda.set('');
        this.modulo.set(this.moduloDeLaRuta());
      });
  }

  /** data.modulo de la ruta más profunda (las secciones lo heredan de la ruta del módulo). */
  private moduloDeLaRuta(): Modulo | undefined {
    let ruta = this.router.routerState.snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    return buscarModulo(ruta.data['modulo']);
  }

  /** Buscar desde cualquier página lleva a la pantalla de módulos, que muestra los resultados. */
  protected buscar(texto: string): void {
    this.modulos.busqueda.set(texto);
    if (texto && !this.router.url.startsWith('/inicio')) void this.router.navigateByUrl('/inicio');
  }

  /**
   * Se abre por signal (el diálogo hace showModal en su effect, ya con el menú cerrado y el foco de vuelta en el
   * avatar): así, al cerrar el diálogo, el navegador devuelve el foco al avatar.
   */
  protected abrirDialogo(id: string): void {
    (id === 'ayuda' ? this.ayudaAbierta : this.preferenciasAbiertas).set(true);
  }

  protected atajo(e: KeyboardEvent): void {
    if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return;
    e.preventDefault();
    if (!this.modulo()) {
      this.buscador()?.nativeElement.focus();
      return;
    }
    // Dentro de un módulo no hay buscador de módulos: se vuelve a la lista y se enfoca el suyo.
    void this.router
      .navigateByUrl('/inicio')
      .then(() => afterNextRender(() => this.buscador()?.nativeElement.focus(), { injector: this.injector }));
  }
}
