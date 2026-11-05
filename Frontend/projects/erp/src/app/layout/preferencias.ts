import {
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { ChevronDown, Mail, Monitor, Phone, X } from 'lucide';
import { AuthService, FechaZonaPipe, FieldError, Icon, iniciales } from 'ui';
import { PlantasService } from '../core/plantas';
import { moverEntrePestanas } from './pestanas';

interface ValoresPreferencias {
  telefono: string;
  firma: string;
  notificaciones: 'erp' | 'correo';
  plantaId: string;
  fueraDesde: string;
  fueraHasta: string;
  fueraMensaje: string;
}

type Pestana = 'preferencias' | 'calendario' | 'seguridad';

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'preferencias', nombre: 'Preferencias' },
  { id: 'calendario', nombre: 'Calendario' },
  { id: 'seguridad', nombre: 'Seguridad' },
];

/** "Windows · Chrome" a partir del user agent, para la lista de dispositivos. */
export function nombreDispositivo(ua: string): string {
  const so = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Equipo';
  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navegador';
  return `${so} · ${navegador}`;
}

/**
 * "Mis preferencias" (menú del avatar), como el de Odoo: datos del usuario arriba y pestañas Preferencias, Calendario
 * y Seguridad. Se edita una copia: "Actualizar preferencias" la guarda; Descartar, la X o Esc la tiran.
 */
@Component({
  selector: 'app-preferencias',
  imports: [FechaZonaPipe, FieldError, FormField, Icon],
  host: { class: 'contents' },
  template: `
    <!-- Anclado arriba (como Odoo): al cambiar de pestaña cambia el alto, pero el encabezado no se mueve. -->
    <dialog
      #dialogo
      aria-labelledby="pref-titulo"
      class="glass-strong mx-auto mt-[max(1rem,6dvh)] max-h-(--alto-max) w-[min(64rem,calc(100%-2rem))] overflow-hidden p-0 [--alto-max:calc(100dvh-max(1rem,6dvh)-1rem)] text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px]"
      (close)="abierto.set(false)"
    >
      <form novalidate class="flex max-h-(--alto-max) flex-col" (submit)="guardar($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="pref-titulo" class="text-lg font-bold">Cambiar mis preferencias</h2>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            aria-label="Cerrar sin guardar"
            (click)="abierto.set(false)"
          >
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>

        <div class="min-h-0 flex-1 scroll-caja px-6 pt-6 pb-8">
          <!-- Usuario -->
          <div class="flex items-center gap-5">
            <span
              class="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#dfe4ea] text-3xl font-semibold text-[#1f2a44] inset-shadow-[0_1px_0_rgb(255_255_255/0.8)] sm:size-28 sm:text-4xl"
              aria-hidden="true"
            >
              {{ iniciales() }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-2xl font-bold tracking-[-0.02em] sm:text-3xl">{{ nombre() }}</p>
              <p class="mt-1.5 flex items-center gap-2 text-texto-suave">
                <ui-icon [icono]="iconos.correo" [tamano]="18" />
                <span class="truncate">{{ correo() }}</span>
              </p>
              <div class="mt-1.5 flex items-center gap-2 text-texto-suave">
                <ui-icon [icono]="iconos.telefono" [tamano]="18" />
                <label for="pref-telefono" class="sr-only">Teléfono</label>
                <input
                  id="pref-telefono"
                  type="tel"
                  autocomplete="tel"
                  placeholder="Teléfono"
                  class="campo h-9 w-56 px-3 text-sm"
                  [formField]="f.telefono"
                />
              </div>
            </div>
          </div>

          <!-- Pestañas como las de Odoo: la elegida se abre hacia el contenido -->
          <div class="mt-7 flex">
            <div role="tablist" aria-label="Secciones de mis preferencias" class="flex">
              @for (t of pestanas; track t.id; let i = $index) {
                <button
                  type="button"
                  role="tab"
                  [id]="'pref-tab-' + t.id"
                  [attr.aria-controls]="'pref-panel-' + t.id"
                  [attr.aria-selected]="pestana() === t.id"
                  [attr.autofocus]="i === 0 ? '' : null"
                  [tabIndex]="pestana() === t.id ? 0 : -1"
                  class="h-11 border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-epico sm:px-5 sm:text-[15px]"
                  [class]="
                    pestana() === t.id
                      ? 'rounded-t-lg border-acero/60 border-t-2 border-t-epico border-b-transparent bg-white/70 text-carbon'
                      : 'border-transparent border-b-acero/60 text-texto-suave hover:text-carbon'
                  "
                  (click)="pestana.set(t.id)"
                  (keydown)="elegirPestana(moverEntrePestanas($event, i))"
                >
                  {{ t.nombre }}
                </button>
              }
            </div>
            <span class="flex-1 border-b border-acero/60" aria-hidden="true"></span>
          </div>

          <!-- Preferencias -->
          <div
            role="tabpanel"
            id="pref-panel-preferencias"
            aria-labelledby="pref-tab-preferencias"
            class="grid gap-x-12 gap-y-5 pt-6 lg:grid-cols-2"
            [hidden]="pestana() !== 'preferencias'"
          >
            <div class="grid content-start gap-5">
              <div [class]="fila">
                <span class="font-semibold">Idioma</span>
                <span>Español (México)</span>
              </div>
              <div [class]="fila">
                <label for="pref-firma" class="font-semibold">Firma de correo electrónico</label>
                <textarea id="pref-firma" rows="4" class="campo resize-y px-3 py-2 text-sm" [formField]="f.firma"></textarea>
              </div>
            </div>
            <div class="grid content-start gap-5">
              <div [class]="fila">
                <span id="pref-notificaciones" class="font-semibold">Notificaciones</span>
                <div role="radiogroup" aria-labelledby="pref-notificaciones" class="flex flex-wrap gap-x-6 gap-y-2">
                  <label class="flex cursor-pointer items-center gap-2">
                    <input type="radio" value="erp" class="casilla" [formField]="f.notificaciones" />En el ERP
                  </label>
                  <label class="flex cursor-pointer items-center gap-2">
                    <input type="radio" value="correo" class="casilla" [formField]="f.notificaciones" />Por
                    correo
                  </label>
                </div>
              </div>
              <div [class]="fila">
                <label for="pref-planta" class="font-semibold sm:pt-2">Planta predeterminada</label>
                <div class="relative">
                  <select id="pref-planta" class="campo h-10 appearance-none pr-10 pl-3 text-sm" [formField]="f.plantaId">
                    @for (r of plantas.razones; track r.id) {
                      <optgroup [label]="r.nombre">
                        @for (p of r.plantas; track p.id) {
                          <option [value]="p.id">{{ p.nombre }}</option>
                        }
                      </optgroup>
                    }
                  </select>
                  <ui-icon
                    [icono]="iconos.abajo"
                    [tamano]="18"
                    class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Calendario -->
          <div
            role="tabpanel"
            id="pref-panel-calendario"
            aria-labelledby="pref-tab-calendario"
            class="grid max-w-3xl gap-6 pt-6"
            [hidden]="pestana() !== 'calendario'"
          >
            <div [class]="fila">
              <span class="font-semibold">Zona horaria</span>
              <div>
                <ul class="grid gap-1">
                  @for (p of plantasElegidas(); track p.id) {
                    <li>
                      {{ p.nombre }}: {{ p.zonaHoraria }}
                      <span class="text-texto-suave">({{ ahora() | fechaZona: p.zonaHoraria }})</span>
                    </li>
                  }
                </ul>
                <p class="mt-1.5 text-sm text-texto-suave">Cada fecha del ERP se muestra con la hora de su planta.</p>
              </div>
            </div>
            <div [class]="fila">
              <span id="pref-fuera" class="font-semibold sm:pt-2">Fuera de la oficina</span>
              <div role="group" aria-labelledby="pref-fuera" class="grid gap-3">
                <div class="flex flex-wrap gap-x-5 gap-y-3">
                  <label class="flex items-center gap-2 text-sm">
                    Desde
                    <input type="date" class="campo h-10 w-auto px-3 text-sm" [formField]="f.fueraDesde" />
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    Hasta
                    <input
                      id="pref-fuera-hasta"
                      type="date"
                      class="campo h-10 w-auto px-3 text-sm"
                      aria-describedby="pref-fuera-error"
                      [formField]="f.fueraHasta"
                    />
                  </label>
                </div>
                <ui-field-error [campo]="f.fueraHasta" errorId="pref-fuera-error" />
                <label for="pref-fuera-mensaje" class="sr-only">Mensaje de fuera de la oficina</label>
                <textarea
                  id="pref-fuera-mensaje"
                  rows="4"
                  placeholder="Tu mensaje para cuando no estés en la oficina…"
                  class="campo resize-y px-3 py-2 text-sm"
                  [formField]="f.fueraMensaje"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Seguridad -->
          <div
            role="tabpanel"
            id="pref-panel-seguridad"
            aria-labelledby="pref-tab-seguridad"
            class="grid max-w-4xl gap-6 pt-6"
            [hidden]="pestana() !== 'seguridad'"
          >
            @for (s of seguridad; track s.id) {
              <div [class]="filaSeguridad">
                <div>
                  <p class="font-semibold">{{ s.titulo }}</p>
                  <p class="text-sm text-texto-suave">{{ s.detalle }}</p>
                </div>
                <div>
                  <button type="button" [class]="botonSecundario" (click)="aviso.set(s.id)">{{ s.boton }}</button>
                  <!-- shortcut: sin backend todavía; solo se avisa. -->
                  <p class="mt-1.5 text-sm text-texto-suave empty:hidden" aria-live="polite">
                    {{ aviso() === s.id ? 'Disponible cuando el ERP se conecte al servidor.' : '' }}
                  </p>
                </div>
              </div>
            }
            <div [class]="filaSeguridad">
              <div>
                <p class="font-semibold">Dispositivos</p>
                <p class="text-sm text-texto-suave">Revisa que todos sean tuyos.</p>
              </div>
              <!-- shortcut: solo este dispositivo; las demás sesiones vendrán del backend. -->
              <div class="flex flex-wrap items-center gap-4 rounded-xl border border-acero/60 bg-white/60 px-4 py-3">
                <ui-icon [icono]="iconos.equipo" [tamano]="28" [grosor]="1.6" />
                <div class="min-w-0 flex-1">
                  <p class="font-semibold">{{ dispositivo }}</p>
                  <p class="flex items-center gap-1.5 text-sm text-texto-suave">
                    <span class="size-2 rounded-full bg-correcto" aria-hidden="true"></span>Este dispositivo · activo ahora
                  </p>
                </div>
                <button type="button" [class]="botonSecundario" (click)="cerrarSesion()">Cerrar sesión</button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto px-5">Actualizar preferencias</button>
          <button type="button" [class]="botonSecundario + ' h-11'" (click)="abierto.set(false)">Descartar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class Preferencias {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly plantas = inject(PlantasService);

  readonly abierto = model(false);

  protected readonly pestanas = PESTANAS;
  protected readonly moverEntrePestanas = moverEntrePestanas;
  protected readonly iconos = { cerrar: X, correo: Mail, telefono: Phone, abajo: ChevronDown, equipo: Monitor };
  protected readonly fila = 'grid gap-1.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start sm:gap-4';
  protected readonly filaSeguridad = 'grid gap-3 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-start sm:gap-6';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly seguridad = [
    { id: 'contrasena', titulo: 'Cambiar contraseña', detalle: 'Actualízala si crees que está en riesgo.', boton: 'Cambiar contraseña' },
    {
      id: 'dos-pasos',
      titulo: 'Verificación en dos pasos',
      detalle: 'Recomendada para mayor seguridad.',
      boton: 'Activar verificación en dos pasos',
    },
  ];
  protected readonly dispositivo = nombreDispositivo(inject(DOCUMENT).defaultView?.navigator.userAgent ?? '');

  protected readonly nombre = computed(() => this.auth.sesion()?.usuario.nombre ?? '');
  protected readonly correo = computed(() => this.auth.sesion()?.usuario.correo ?? '');
  protected readonly iniciales = computed(() => iniciales(this.nombre(), 2));
  protected readonly plantasElegidas = computed(() =>
    this.plantas.razones.flatMap((r) => r.plantas).filter((p) => this.plantas.seleccion().includes(p.id)),
  );

  protected readonly pestana = signal<Pestana>('preferencias');
  protected readonly aviso = signal('');
  /** Hora de referencia para la zona de cada planta: la de cuando se abrió el diálogo. */
  protected readonly ahora = signal('');

  // shortcut: las preferencias viven en este componente (se pierden al recargar o salir) y nada las usa todavía;
  // con backend, cargarlas y guardarlas por usuario, y aplicar la planta predeterminada al entrar.
  private readonly guardadas = signal<ValoresPreferencias>({
    telefono: '',
    firma: this.nombre(),
    notificaciones: 'erp',
    plantaId: this.plantas.actualId(),
    fueraDesde: '',
    fueraHasta: '',
    fueraMensaje: '',
  });
  protected readonly modelo = signal<ValoresPreferencias>({ ...this.guardadas() });
  protected readonly f = form(this.modelo, (p) => {
    validate(p.fueraHasta, ({ value, valueOf }) => {
      const desde = valueOf(p.fueraDesde);
      return desde && value() && value() < desde
        ? { kind: 'rango', message: 'La fecha final no puede ser antes de la inicial.' }
        : undefined;
    });
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        // Cada vez que se abre parte de lo guardado: lo que se descartó no regresa.
        untracked(() => {
          this.f().reset({ ...this.guardadas() });
          this.pestana.set('preferencias');
          this.aviso.set('');
          this.ahora.set(new Date().toISOString());
        });
        d.showModal();
      } else if (!this.abierto() && d.open) {
        d.close();
      }
    });
  }

  protected elegirPestana(i: number): void {
    if (i >= 0) this.pestana.set(PESTANAS[i].id);
  }

  protected async guardar(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      this.guardadas.set({ ...this.modelo() });
      this.abierto.set(false);
      return undefined;
    });
    // El único campo que puede fallar está en Calendario: se muestra esa pestaña y se lleva el foco al error.
    if (this.f.fueraHasta().invalid()) {
      this.pestana.set('calendario');
      afterNextRender(() => document.getElementById('pref-fuera-hasta')?.focus(), { injector: this.injector });
    }
  }

  protected cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
