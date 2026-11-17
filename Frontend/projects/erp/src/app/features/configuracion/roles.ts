import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { coincide } from '../ventas/datos';
import { AccesoService, Rol, TODOS } from './acceso';
import { DetalleRol } from './detalle-rol';
import { permisosSesion } from '../../core/permisos';

/** Seguridad y plataforma → Roles: los del sistema y los de la organización, con cuántos permisos y accesos tienen. */
@Component({
  selector: 'app-roles',
  imports: [Buscador, EnEncabezado, PanelLateral, DetalleRol, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('config.roles.crear')) {
            <a routerLink="/configuracion/roles/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Roles</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-rol"
          etiqueta="Buscar roles por nombre o descripción"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ filas().length === 1 ? '1 rol' : filas().length + ' roles' }}</p>
      </div>
    </ng-template>

    @if (acceso.errorCarga(); as error) {
      <p role="alert" class="glass mb-4 px-5 py-4 text-sm font-medium text-[#8E332C]">{{ error }}</p>
    }

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <div tabindex="0" role="region" aria-label="Tabla de roles" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <caption class="sr-only">Roles. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa.</caption>
              <thead [class]="cajas.titulos">
                <tr>
                  <th scope="col" class="px-3 py-2.5 pl-4 font-semibold">Rol</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Descripción</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Permisos</th>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Usuarios</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track f.r.id) {
                  <tr
                    [id]="'fila-' + f.r.id"
                    tabindex="0"
                    [class]="fila"
                    [attr.aria-current]="f.r.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(f.r)"
                    (dblclick)="verCompleta(f.r)"
                    (keydown.enter)="abrir(f.r)"
                  >
                    <td class="px-3 py-2.5 pl-4 font-semibold">{{ f.r.nombre }}</td>
                    <td class="max-w-md truncate px-3 py-2.5" [class.hidden]="previa()">{{ f.r.descripcion || '—' }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ f.permisos }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ f.accesos }}</td>
                    <td class="px-3 py-2.5">{{ (f.r.sistema ?? f.r.organizacionId === null) ? 'Del sistema' : 'De la organización' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-3 py-12 text-center text-texto-suave">
                      {{ acceso.cargando() ? 'Cargando roles…' : 'Ningún rol coincide con la búsqueda.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as r) {
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-rol [r]="r" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Roles {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly router = inject(Router);
  protected readonly acceso = inject(AccesoService);

  protected readonly iconos = { buscar: Search };
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly texto = signal('');
  /** Filtros por columna, en el buscador: del sistema o de la organización y si lo usa alguien. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  private readonly tipoDe = (r: { sistema?: boolean; organizacionId?: string | null }) => ((r.sistema ?? r.organizacionId === null) ? 'sistema' : 'organizacion');
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const roles = this.acceso.roles();
    const usados = (r: (typeof roles)[number]) => (r.usuarios ?? this.acceso.usuariosConRol(r.id)) > 0;
    return [
      { id: 'tipo', titulo: 'Tipo', opciones: opcionesDe(roles, this.tipoDe, (t) => (t === 'sistema' ? 'Del sistema' : 'De la organización')) },
      {
        id: 'usuarios',
        titulo: 'Usuarios',
        opciones: [
          { id: 'si', nombre: 'Con usuarios', n: roles.filter(usados).length },
          { id: 'no', nombre: 'Sin usuarios', n: roles.filter((r) => !usados(r)).length },
        ],
      },
    ];
  });

  protected readonly filas = computed(() =>
    this.acceso
      .roles()
      .filter((r) => coincide(this.texto(), `${r.nombre} ${r.descripcion ?? ''}`))
      .map((r) => ({
        r,
        permisos: r.permisos?.includes(TODOS) ? 'Todos' : String(r.permisos?.length ?? '—'),
        accesos: r.usuarios ?? this.acceso.usuariosConRol(r.id),
      }))
      .filter((f) => pasaFiltro(this.filtros(), 'tipo', this.tipoDe(f.r)) && pasaFiltro(this.filtros(), 'usuarios', f.accesos ? 'si' : 'no'))
      .sort((a, b) => a.r.nombre.localeCompare(b.r.nombre)),
  );

  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.acceso.roles().find((r) => r.id === this.vista.abiertaId()) ?? null);
  private readonly detalle = viewChild(DetalleRol);

  private puedeDejarla(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando este rol. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }

  protected abrir(r: Rol): void {
    if (r.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(r.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(r: Rol): void {
    if (this.puedeDejarla()) void this.router.navigate(['/configuracion/roles', r.id]);
  }
}
