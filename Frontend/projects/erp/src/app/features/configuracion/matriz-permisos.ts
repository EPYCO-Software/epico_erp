import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ChevronDown } from 'lucide';
import { Icon } from 'ui';
import { AccesoService, agruparPermisos } from './acceso';

/**
 * La matriz de permisos por módulo y recurso (una casilla por acción y una por módulo para todo), con el catálogo del
 * backend. No sabe de roles ni de usuarios: quien la usa dice qué está marcado y qué puede tocar quien edita, y recibe
 * los cambios. La usan form-rol.ts (permisos del rol) y permisos-usuario.ts (ajustes de un usuario).
 */
@Component({
  selector: 'app-matriz-permisos',
  host: { class: 'block' },
  imports: [Icon],
  template: `
    @if (!grupos().length) {
      <p class="rounded-xl bg-white/80 p-3 text-sm text-texto-suave">
        El servidor aún no publica el catálogo de permisos; por ahora no se pueden cambiar aquí.
      </p>
    } @else {
      <div class="grid gap-3" [class.opacity-60]="deshabilitada()">
        @for (g of grupos(); track g.modulo) {
          <fieldset class="rounded-xl bg-white/80 p-3" [disabled]="deshabilitada()">
            <legend class="sr-only">{{ g.nombre }}</legend>
            <div class="flex items-center gap-2">
              <label class="flex min-h-9 flex-1 items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  class="casilla"
                  [checked]="g.estado === 'todas'"
                  [indeterminate]="g.estado === 'algunas'"
                  [disabled]="!g.editables.length"
                  (change)="
                    alternarModulo.emit({
                      claves: g.editables,
                      marcar: $any($event.target).checked,
                    })
                  "
                />
                {{ g.nombre }}
                <span class="text-sm font-normal text-texto-suave"
                  >({{ g.marcadas }} de {{ g.total }})</span
                >
              </label>
              <button
                type="button"
                class="flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-epico-oscuro hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico"
                [attr.aria-expanded]="abiertos().has(g.modulo)"
                [attr.aria-controls]="'acciones-' + g.modulo"
                (click)="alternarAbierto(g.modulo)"
              >
                {{ abiertos().has(g.modulo) ? 'Ocultar' : 'Ver acciones'
                }}<span class="sr-only"> de {{ g.nombre }}</span>
                <ui-icon
                  [icono]="flecha"
                  [tamano]="16"
                  [class.rotate-180]="abiertos().has(g.modulo)"
                  class="transition-transform"
                />
              </button>
            </div>
            <ul
              [id]="'acciones-' + g.modulo"
              class="mt-1 divide-y divide-acero/40"
              [hidden]="!abiertos().has(g.modulo)"
            >
              @for (r of g.recursos; track r.recurso) {
                <li
                  class="grid gap-x-4 gap-y-1 py-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center"
                >
                  <span class="text-sm font-medium">{{ r.nombre }}</span>
                  <span
                    class="flex flex-wrap gap-x-4 gap-y-1"
                    role="group"
                    [attr.aria-label]="r.nombre"
                  >
                    @for (a of r.acciones; track a.clave) {
                      <label
                        class="flex min-h-8 items-center gap-1.5 text-sm"
                        [class.text-texto-suave]="!puedo()(a.clave)"
                        [title]="a.descripcion ?? ''"
                      >
                        <input
                          type="checkbox"
                          class="casilla"
                          [checked]="marcada()(a.clave)"
                          [disabled]="!puedo()(a.clave)"
                          (change)="
                            alternar.emit({ clave: a.clave, marcar: $any($event.target).checked })
                          "
                        />
                        {{ a.accionNombre }}<span class="sr-only"> {{ r.nombre }}</span>
                        @if (nota()(a.clave); as n) {
                          <span
                            class="rounded bg-carbon/6 px-1 text-xs font-semibold text-texto-suave"
                            >{{ n }}</span
                          >
                        }
                      </label>
                    }
                  </span>
                </li>
              }
            </ul>
          </fieldset>
        }
      </div>
    }
  `,
})
export class MatrizPermisos {
  private readonly acceso = inject(AccesoService);

  /** ¿Esa clave está marcada? */
  readonly marcada = input.required<(clave: string) => boolean>();
  /** ¿Quien edita puede tocarla? (solo los permisos que él tiene). */
  readonly puedo = input.required<(clave: string) => boolean>();
  /** Una etiqueta junto a la acción ("Agregado", "Quitado"); vacía, nada. */
  readonly nota = input<(clave: string) => string>(() => '');
  readonly deshabilitada = input(false);
  readonly alternar = output<{ clave: string; marcar: boolean }>();
  readonly alternarModulo = output<{ claves: string[]; marcar: boolean }>();

  protected readonly flecha = ChevronDown;
  /** Módulos con sus acciones a la vista; los demás, compactos (una línea con su casilla y cuántas tiene). */
  protected readonly abiertos = signal(new Set<string>());
  protected alternarAbierto(modulo: string): void {
    this.abiertos.update((s) => {
      const n = new Set(s);
      if (!n.delete(modulo)) n.add(modulo);
      return n;
    });
  }

  protected readonly grupos = computed(() => {
    const marcada = this.marcada();
    const puedo = this.puedo();
    return agruparPermisos(this.acceso.catalogo()).map((g) => {
      const claves = g.recursos.flatMap((r) => r.acciones.map((a) => a.clave));
      const editables = claves.filter(puedo);
      const marcadasEditables = editables.filter(marcada).length;
      return {
        ...g,
        total: claves.length,
        marcadas: claves.filter(marcada).length,
        editables,
        estado:
          !editables.length || marcadasEditables === 0
            ? 'ninguna'
            : marcadasEditables === editables.length
              ? 'todas'
              : 'algunas',
      };
    });
  });
}
