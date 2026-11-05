import { Component, ElementRef, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { Check, Mail, Phone, Upload, Users, X } from 'lucide';
import { DEFAULT_TIMEZONE, FieldError, Icon } from 'ui';
import { HistorialService, NuevaActividad, TIPOS_ACTIVIDAD, TipoActividad } from '../core/historial';
import { PERSONAS } from '../core/mensajeria';

export const ICONOS_ACTIVIDAD: Record<TipoActividad, typeof Check> = { pendiente: Check, correo: Mail, llamada: Phone, reunion: Users, documento: Upload };

/**
 * "Programar actividad" de un registro, como el de Odoo: tipo (Actividades pendientes, Correo electrónico, Llamada,
 * Reunión, Documento), resumen, fecha límite, a quién se asigna y una nota. Guardar la deja pendiente en el historial;
 * "Marcar como hecho" la registra ya realizada.
 */
@Component({
  selector: 'app-programar-actividad',
  imports: [FieldError, FormField, Icon],
  host: { class: 'contents' },
  template: `
    <!-- Esc cierra el diálogo y no debe llegar a quien lo contiene -->
    <dialog
      #dialogo
      aria-labelledby="actividad-titulo"
      class="glass-strong m-auto w-[min(52rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="abierto.set(false)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate (submit)="guardar($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="actividad-titulo" class="text-lg font-bold">Programar actividad</h2>
          <button
            type="button"
            aria-label="Cerrar sin guardar"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            (click)="abierto.set(false)"
          >
            <ui-icon [icono]="iconoCerrar" />
          </button>
        </div>

        <div class="grid gap-5 px-6 py-5">
          <fieldset>
            <legend class="sr-only">Tipo de actividad</legend>
            <div class="flex flex-wrap gap-2">
              @for (t of tipos; track t.id) {
                <label
                  class="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-acero-oscuro/60 bg-white/70 px-3 text-sm font-semibold transition-colors hover:border-carbon has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico"
                >
                  <input
                    type="radio"
                    class="sr-only"
                    [value]="t.id"
                    [formField]="f.tipo"
                    [attr.autofocus]="t.id === 'pendiente' ? '' : null"
                    (change)="alCambiarTipo(t.id)"
                  />
                  <ui-icon [icono]="t.icono" [tamano]="16" />{{ t.nombre }}
                </label>
              }
            </div>
          </fieldset>

          <div class="grid gap-x-5 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
            <label for="actividad-resumen" class="font-semibold sm:pt-2">Resumen</label>
            <div>
              <input
                id="actividad-resumen"
                type="text"
                class="campo h-10 px-3"
                aria-describedby="actividad-resumen-error"
                [formField]="f.resumen"
              />
              <ui-field-error [campo]="f.resumen" errorId="actividad-resumen-error" />
            </div>
            <label for="actividad-fecha" class="font-semibold sm:pt-2">Fecha límite</label>
            <div>
              <input
                id="actividad-fecha"
                type="date"
                class="campo h-10 w-auto px-3"
                aria-describedby="actividad-fecha-error"
                [formField]="f.fechaLimite"
              />
              <ui-field-error [campo]="f.fechaLimite" errorId="actividad-fecha-error" />
            </div>
            <label for="actividad-asignada" class="font-semibold sm:pt-2">Asignada a</label>
            <select id="actividad-asignada" class="campo h-10 w-auto min-w-60 px-3" [formField]="f.asignadaA">
              @for (p of personas(); track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
          </div>

          <div>
            <label for="actividad-nota" class="sr-only">Nota</label>
            <textarea
              id="actividad-nota"
              rows="3"
              placeholder="Registrar una nota…"
              class="campo resize-y px-3 py-2 text-sm"
              [formField]="f.nota"
            ></textarea>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" class="boton-primario h-11 w-auto px-5">Guardar</button>
          <button type="button" [class]="botonSecundario" (click)="hecha()">Marcar como hecho</button>
          <button type="button" [class]="botonSecundario" (click)="abierto.set(false)">Descartar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class ProgramarActividad {
  private readonly historial = inject(HistorialService);
  private readonly zona = inject(DEFAULT_TIMEZONE);

  /** Clave del registro ("cotizacion:…"). */
  readonly registro = input.required<string>();
  readonly abierto = model(false);
  /** Texto para avisar qué se hizo. */
  readonly listo = output<string>();

  protected readonly iconoCerrar = X;
  protected readonly tipos = (Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[]).map((id) => ({
    id,
    nombre: TIPOS_ACTIVIDAD[id],
    icono: ICONOS_ACTIVIDAD[id],
  }));
  protected readonly personas = computed(() => [this.historial.usuario(), ...PERSONAS.map((p) => p.nombre)]);
  protected readonly botonSecundario =
    'inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  private readonly modelo = signal<Omit<NuevaActividad, 'registro'>>({
    tipo: 'pendiente',
    resumen: '',
    fechaLimite: '',
    asignadaA: '',
    nota: '',
  });
  protected readonly f = form(this.modelo, (m) => {
    required(m.resumen, { message: 'Escribe de qué se trata.' });
    required(m.fechaLimite, { message: 'Elige la fecha límite.' });
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        // Como Odoo: Actividades pendientes, para dentro de 5 días y asignada a quien la programa.
        untracked(() =>
          this.f().reset({
            tipo: 'pendiente',
            resumen: TIPOS_ACTIVIDAD.pendiente,
            fechaLimite: new Date(Date.now() + 5 * 86_400_000).toLocaleDateString('en-CA', { timeZone: this.zona }),
            asignadaA: this.historial.usuario(),
            nota: '',
          }),
        );
        d.showModal();
      } else if (!this.abierto() && d.open) {
        d.close();
      }
    });
  }

  /** El resumen sigue al tipo mientras no se haya escrito otro. */
  protected alCambiarTipo(tipo: TipoActividad): void {
    if (!this.f.resumen().dirty()) this.f.resumen().value.set(TIPOS_ACTIVIDAD[tipo]);
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    await this.enviar((a) => {
      this.historial.programar(a);
      return `Actividad programada para el ${a.fechaLimite.split('-').reverse().join('/')}.`;
    });
  }

  protected async hecha(): Promise<void> {
    await this.enviar((a) => {
      this.historial.marcarHecha(a);
      return 'Actividad registrada como hecha.';
    });
  }

  /** Al enviar inválido, el foco va al primer campo con error. */
  private async enviar(accion: (a: NuevaActividad) => string): Promise<void> {
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.listo.emit(accion({ ...m, resumen: m.resumen.trim(), nota: m.nota.trim(), registro: this.registro() }));
      this.abierto.set(false);
      return undefined;
    });
    if (!valido) document.getElementById(this.f.resumen().invalid() ? 'actividad-resumen' : 'actividad-fecha')?.focus();
  }
}
