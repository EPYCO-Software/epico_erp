import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, submit, validate } from '@angular/forms/signals';
import { FieldError } from 'ui';
import { RAZONES_SOCIALES } from '../../core/plantas';
import { DatosLista, ListaPrecios, ListasPreciosService, MONEDAS, Moneda } from './precios';

/**
 * Nombre (sin repetir), moneda con la que se cobra y plantas donde aplica (ninguna marcada = todas) de una lista de
 * precios. Lo usan el alta (nueva-lista.ts, con Guardar en la barra) y la edición (detalle-lista.ts, con sus botones).
 */
@Component({
  selector: 'app-editor-lista',
  imports: [FieldError, FormField],
  host: { class: 'block' },
  template: `
    <form [id]="formId()" novalidate [attr.aria-label]="lista() ? 'Editar lista de precios' : 'Nueva lista de precios'" class="grid gap-5 text-sm" (submit)="guardar($event)">
      <div>
        <label for="lista-nombre" [class]="etiqueta">Nombre de la lista</label>
        <input id="lista-nombre" class="campo mt-1 h-10 px-3 text-base" placeholder="p. ej. Planta Cancún" aria-describedby="lista-nombre-error" [formField]="f.nombre" />
        <ui-field-error [campo]="f.nombre" errorId="lista-nombre-error" />
      </div>
      <div>
        <p id="lista-moneda" [class]="etiqueta">Moneda con la que se cobra</p>
        <div role="radiogroup" aria-labelledby="lista-moneda" class="mt-2 flex flex-wrap gap-1.5">
          @for (m of monedas; track m.id) {
            <label [class]="chip">
              <input type="radio" class="sr-only" [value]="m.id" [formField]="f.moneda" />{{ m.id }}
              <span class="font-normal text-texto-suave">{{ m.nombre }}</span>
            </label>
          }
        </div>
        @if (lista()?.reglas?.length && modelo().moneda !== lista()!.moneda) {
          <p class="mt-2 rounded-lg bg-[#FBF2E7] px-3 py-2 text-[#7A4210]">
            Los importes de sus líneas no se convierten: revisa sus precios en {{ modelo().moneda }}.
          </p>
        }
      </div>
      <fieldset>
        <legend [class]="etiqueta">Plantas donde aplica</legend>
        <p class="mt-1 text-texto-suave">{{ modelo().plantas.length ? '' : 'Ninguna marcada: aplica en todas las plantas.' }}</p>
        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          @for (r of razones; track r.id) {
            <div>
              <p class="font-semibold">{{ r.nombre }}</p>
              <div class="mt-1 flex flex-wrap gap-1.5">
                @for (p of r.plantas; track p.id) {
                  <label [class]="chip">
                    <input type="checkbox" class="sr-only" [checked]="modelo().plantas.includes(p.id)" (change)="alternar(p.id)" />{{ p.nombre }}
                  </label>
                }
              </div>
            </div>
          }
        </div>
      </fieldset>
      @if (botones()) {
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
          <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
        </div>
      }
    </form>
  `,
})
export class EditorLista implements OnInit {
  private readonly servicio = inject(ListasPreciosService);

  /** Para editar; sin ella, es un alta. */
  readonly lista = input<ListaPrecios | null>(null);
  readonly formId = input('editor-lista');
  /** Guardar y Descartar al pie (la página de alta los tiene en la barra). */
  readonly botones = input(true);
  readonly listo = output<DatosLista>();
  readonly descartar = output();

  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly chip =
    'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-acero/80 bg-white/80 px-3 text-sm font-semibold transition-colors hover:border-carbon/40 has-checked:border-epico has-checked:bg-epico/8 has-checked:text-epico-oscuro has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly monedas = (Object.keys(MONEDAS) as Moneda[]).map((id) => ({ id, nombre: MONEDAS[id] }));
  protected readonly razones = RAZONES_SOCIALES;

  protected readonly modelo = signal<DatosLista>({ nombre: '', moneda: 'MXN', plantas: [] });
  protected readonly f = form(this.modelo, (m) => {
    validate(m.nombre, ({ value }) => {
      const nombre = value().trim().toLowerCase();
      if (!nombre) return { kind: 'required', message: 'Escribe el nombre de la lista.' };
      return this.servicio.listas().some((l) => l.id !== this.lista()?.id && l.nombre.toLowerCase() === nombre)
        ? { kind: 'repetido', message: 'Ya hay una lista con ese nombre.' }
        : undefined;
    });
  });

  private inicial = '';
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  ngOnInit(): void {
    const l = this.lista();
    if (l) this.modelo.set({ nombre: l.nombre, moneda: l.moneda, plantas: l.plantas });
    this.inicial = JSON.stringify(this.modelo());
  }

  protected alternar(id: string): void {
    this.modelo.update((m) => ({ ...m, plantas: m.plantas.includes(id) ? m.plantas.filter((x) => x !== id) : [...m.plantas, id] }));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      this.inicial = JSON.stringify(this.modelo());
      this.listo.emit(this.modelo());
      return undefined;
    });
    if (!valido) document.getElementById('lista-nombre')?.focus();
  }
}
