import { Component, Injector, OnInit, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { FieldError } from 'ui';
import { AccesoService, Rol, TODOS, alternarClave, tiene } from './acceso';
import { MatrizPermisos } from './matriz-permisos';

/** Desmarca todas las claves (deshaciendo los comodines que las cubrían). */
function quitarTodas(s: Set<string>, claves: string[], catalogo: string[]): Set<string> {
  let n = s;
  for (const c of claves) if (tiene([...n].filter((p) => p !== TODOS), c)) n = alternarClave(n, c, catalogo);
  return n;
}

export interface RolListo {
  nombre: string;
  descripcion: string;
  permisos: string[];
}

/**
 * Alta y edición de un rol: nombre, descripción y sus permisos en una matriz por módulo (una casilla por acción y una
 * por módulo para todo). Solo se pueden marcar los permisos que tiene quien edita; "Acceso total" solo lo da root.
 * Los que el rol ya tenía y quien edita no tiene se conservan (no se pueden quitar ni dar).
 */
@Component({
  selector: 'app-form-rol',
  imports: [FieldError, FormField, MatrizPermisos],
  host: { class: 'block' },
  template: `
    <form id="form-rol" novalidate aria-labelledby="form-rol-titulo" (submit)="guardar($event)">
      <p id="form-rol-titulo" class="font-bold">{{ rol() ? 'Editar rol' : 'Rol nuevo' }}</p>

      <div class="mt-4 grid max-w-2xl gap-3">
        <div>
          <label for="rol-nombre" class="mb-1 block text-sm font-medium">Nombre</label>
          <input
            id="rol-nombre"
            class="campo h-10 px-3 text-sm"
            autocomplete="off"
            [attr.aria-invalid]="f.nombre().touched() && f.nombre().invalid()"
            aria-describedby="rol-nombre-error"
            [formField]="f.nombre"
          />
          <ui-field-error [campo]="f.nombre" errorId="rol-nombre-error" />
        </div>
        <div>
          <label for="rol-descripcion" class="mb-1 block text-sm font-medium">Descripción (opcional)</label>
          <textarea id="rol-descripcion" rows="2" class="campo resize-y px-3 py-2 text-sm" [formField]="f.descripcion"></textarea>
        </div>
      </div>

      <div class="mt-5">
        <p class="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">Permisos</p>
        @if (acceso.soyRoot()) {
          <label class="mb-3 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-sm">
            <input type="checkbox" class="casilla mt-0.5" [checked]="total()" (change)="alternar(TODOS)" />
            <span><span class="font-semibold">Acceso total</span> · todos los permisos, también los que se agreguen después.</span>
          </label>
        }

        <app-matriz-permisos
          [marcada]="marcada()"
          [puedo]="puedoFn()"
          [deshabilitada]="total()"
          (alternar)="alternar($event.clave)"
          (alternarModulo)="alternarModulo($event.claves, $event.marcar)"
        />
        @if (!acceso.catalogo().length && seleccion().size) {
          <p class="mt-2 text-sm text-texto-suave">Este rol tiene: {{ [...seleccion()].join(', ') }}.</p>
        }
        @if (acceso.catalogo().length && !acceso.soyRoot()) {
          <p class="mt-2 text-xs text-texto-suave">Los permisos en gris no los tienes tú: no se pueden dar ni quitar.</p>
        }
      </div>

      <div class="mt-5 flex flex-wrap gap-2">
        <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="guardando()" [attr.aria-busy]="guardando()">
          {{ rol() ? 'Guardar cambios' : 'Crear rol' }}
        </button>
        <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
      </div>
    </form>
  `,
})
export class FormRol implements OnInit {
  private readonly injector = inject(Injector);
  protected readonly acceso = inject(AccesoService);
  protected readonly TODOS = TODOS;

  readonly rol = input<Rol | null>(null);
  readonly guardando = input(false);
  readonly listo = output<RolListo>();
  readonly descartar = output();

  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly modelo = signal({ nombre: '', descripcion: '' });
  protected readonly f = form(this.modelo, (m) => required(m.nombre, { message: 'Escribe el nombre del rol.' }));
  protected readonly seleccion = signal(new Set<string>());
  protected readonly total = computed(() => this.seleccion().has(TODOS));

  /** Para la matriz: marcada si el rol la tiene (también por comodín; "*" solo cuenta en su casilla). */
  protected readonly marcada = computed(() => {
    const s = [...this.seleccion()].filter((p) => p !== TODOS);
    return (clave: string) => tiene(s, clave);
  });
  protected readonly puedoFn = computed(() => {
    const mios = this.acceso.mios();
    return (clave: string) => tiene(mios, clave);
  });

  private inicial = '';
  readonly sinGuardar = computed(() => JSON.stringify([this.modelo(), [...this.seleccion()].sort()]) !== this.inicial);

  ngOnInit(): void {
    const r = this.rol();
    this.modelo.set({ nombre: r?.nombre ?? '', descripcion: r?.descripcion ?? '' });
    this.seleccion.set(new Set(r?.permisos ?? []));
    this.inicial = JSON.stringify([this.modelo(), [...this.seleccion()].sort()]);
    afterNextRender(() => document.getElementById('rol-nombre')?.focus(), { injector: this.injector });
  }

  protected alternar(clave: string): void {
    if (clave === TODOS) {
      this.seleccion.update((s) => {
        const n = new Set(s);
        if (!n.delete(TODOS)) n.add(TODOS);
        return n;
      });
      return;
    }
    this.seleccion.update((s) => alternarClave(s, clave, this.acceso.catalogo().map((p) => p.clave)));
  }

  protected alternarModulo(claves: string[], marcar: boolean): void {
    this.seleccion.update((s) => {
      const n = new Set(s);
      if (!marcar) return quitarTodas(n, claves, this.acceso.catalogo().map((p) => p.clave));
      for (const c of claves) n.add(c);
      return n;
    });
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.listo.emit({ nombre: m.nombre.trim(), descripcion: m.descripcion.trim(), permisos: [...this.seleccion()].sort() });
      return undefined;
    });
    if (!valido) document.getElementById('rol-nombre')?.focus();
  }
}
