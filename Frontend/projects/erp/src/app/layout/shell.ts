import { Component, DOCUMENT, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { BarraEncabezado } from './barra-encabezado';
import { Chats } from './chats';
import { Encabezado } from './encabezado';

/**
 * Shell del ERP: encabezado arriba y el contenido debajo, centrado hasta 1446 px (en el mockup de 1586 px deja 70 px
 * por lado). La navegación es la pantalla de módulos (/inicio): el logo siempre vuelve ahí.
 * En escritorio nunca hay scroll de página: el shell ocupa la ventana, el encabezado queda fijo y se desplaza el
 * <main> (páginas normales) o, en las páginas con barra en el encabezado (listas con vista previa, vistas completas),
 * cada columna por su lado, con todo y caja (COLUMNA): la tabla, el panel, la hoja y el historial. En celular, el
 * scroll normal.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Encabezado, Chats],
  host: { class: 'flex min-h-dvh flex-col lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden' },
  template: `
    <app-encabezado />
    <!-- tabindex -1: recibe el foco cuando nada lo tiene, para que AvPág / flechas desplacen sin tener que hacer clic -->
    <!-- Con barra (cajas) el <main> no se desplaza: se desplaza cada columna -->
    <main
      #principal
      tabindex="-1"
      class="flex-1 outline-none lg:flex lg:min-h-0 lg:flex-col"
      [class]="barra.plantilla() ? 'lg:overflow-hidden' : 'lg:scroll-caja'"
    >
      <!-- Con barra (cajas): la página es la única celda de una rejilla de minmax(0,1fr): llena el alto y nunca es más
           ancha que la pantalla (una tabla ancha se desplaza de lado dentro de su caja); cada caja con su scroll.
           Sin barra: centrado y crece; el que se desplaza es el <main>. -->
      <div
        [class]="
          barra.plantilla()
            ? 'w-full px-4 pt-2 pb-10 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:px-6 lg:pb-5 [&>router-outlet]:hidden'
            : 'mx-auto w-[min(100%-2rem,1446px)] pt-6 pb-10 sm:w-[min(100%-3rem,1446px)] lg:pt-8'
        "
      >
        <router-outlet />
      </div>
    </main>
    <app-chats />
  `,
})
export class Shell {
  protected readonly barra = inject(BarraEncabezado);
  // Opcional: el primer NavigationEnd puede llegar antes de que exista la vista.
  private readonly principal = viewChild<ElementRef<HTMLElement>>('principal');
  private readonly documento = inject(DOCUMENT);

  constructor() {
    afterNextRender(() => this.tomarFoco());
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        // El router solo regresa arriba la ventana; en escritorio el que se desplaza es el <main>.
        this.principal()?.nativeElement.scrollTo({ top: 0 });
        // Al cambiar de página el enlace pulsado puede desaparecer y el foco caer al <body>.
        this.tomarFoco();
      });
  }

  /** Solo si el foco está perdido (en <body>): nunca se lo quita a un campo, como el buscador. */
  private tomarFoco(): void {
    const activo = this.documento.activeElement;
    if (!activo || activo === this.documento.body) this.principal()?.nativeElement.focus({ preventScroll: true });
  }
}
