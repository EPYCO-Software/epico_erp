import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Search } from 'lucide';
import { FechaZonaPipe, Buscador, FiltrosElegidos, GrupoFiltro, enRango, opcionesDe, pasaFiltro } from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, seleccionMultiple, vistaPrevia } from '../../layout/panel-lateral';
import { coincide } from '../ventas/datos';
import { AccesoService, Usuario, estadoUsuario, nombreUsuario } from './acceso';
import { DetalleUsuario } from './detalle-usuario';
import { EstadoUsuarioEtiqueta } from './estado-usuario';
import { permisosSesion } from '../../core/permisos';

/**
 * Seguridad y plataforma → Usuarios: los usuarios internos con acceso a las empresas de quien administra, como la lista
 * de Odoo (Ajustes → Usuarios): clic o Enter abre la vista previa, doble clic la vista completa, "Nuevo" el alta.
 */
@Component({
  selector: 'app-usuarios',
  imports: [Buscador, EnEncabezado, EstadoUsuarioEtiqueta, FechaZonaPipe, PanelLateral, DetalleUsuario, RouterLink],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puede('config.usuarios.crear')) {
            <a routerLink="/configuracion/usuarios/nuevo" class="boton-primario h-9 w-auto px-3.5 text-[15px]">Nuevo</a>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Usuarios</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-usuario"
          etiqueta="Buscar usuarios por nombre, correo, puesto o rol"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <p class="text-right text-sm text-texto-suave max-md:sr-only" aria-live="polite">{{ conteo() }}</p>
      </div>
    </ng-template>

    @if (acceso.errorCarga(); as error) {
      <p role="alert" class="glass mb-4 px-5 py-4 text-sm font-medium text-[#8E332C]">{{ error }}</p>
    }

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <div tabindex="0" role="region" aria-label="Tabla de usuarios" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap" [class.min-w-200]="!previa()">
              <caption class="sr-only">Usuarios. Clic o Enter en una fila abre su vista previa; doble clic, su vista completa.</caption>
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
                  <th scope="col" class="px-3 py-2.5 font-semibold">Nombre</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Correo</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Puesto</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Roles</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="previa()">Último acceso</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track f.u.id) {
                  <tr
                    [id]="'fila-' + f.u.id"
                    tabindex="0"
                    [class]="fila + ' has-checked:bg-epico/6'"
                    [attr.aria-current]="f.u.id === vista.abiertaId() ? 'true' : null"
                    (click)="abrir(f.u)"
                    (dblclick)="verCompleta(f.u)"
                    (keydown.enter)="$event.target === $event.currentTarget && abrir(f.u)"
                  >
                    <td class="py-2.5 pr-1 pl-3" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()">
                      <input
                        type="checkbox"
                        class="casilla block"
                        [attr.aria-label]="'Marcar ' + f.nombre"
                        [checked]="casillas.marcadas().includes(f.u.id)"
                        (change)="casillas.alternar(f.u.id)"
                      />
                    </td>
                    <td class="px-3 py-2.5 font-semibold">{{ f.nombre }}</td>
                    <td class="px-3 py-2.5">{{ f.u.correo }}</td>
                    <td class="px-3 py-2.5" [class.hidden]="previa()">{{ f.u.puesto || '—' }}</td>
                    <td class="px-3 py-2.5">
                      @if (f.roles) {
                        {{ f.roles }}
                      } @else {
                        <span class="text-texto-suave">Sin accesos</span>
                      }
                    </td>
                    <td class="px-3 py-2.5 tabular-nums" [class.hidden]="previa()">
                      {{ f.u.ultimoAcceso ? (f.u.ultimoAcceso | fechaZona: zona()) : 'Nunca' }}
                    </td>
                    <td class="px-3 py-2"><app-estado-usuario [estado]="f.estado" /></td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="px-3 py-12 text-center text-texto-suave">
                      {{ acceso.cargando() ? 'Cargando usuarios…' : 'Ningún usuario coincide con la búsqueda.' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (previa(); as u) {
        <aside appPanelLateral (cerrar)="cerrar()">
          <app-detalle-usuario [u]="u" (cerrar)="cerrar()" />
        </aside>
      }
    </div>
  `,
})
export default class Usuarios {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly router = inject(Router);
  protected readonly acceso = inject(AccesoService);
  private readonly plantas = inject(PlantasService);

  protected readonly iconos = { buscar: Search };
  protected readonly fila = FILA_LISTA;
  protected readonly cajas = CAJAS_LISTA;
  protected readonly zona = computed(() => this.plantas.actual().zonaHoraria);
  protected readonly texto = signal('');

  /** Con sus roles (sin repetir) y su estado; activos primero y por nombre. */
  private readonly todas = computed(() =>
    this.acceso
      .usuarios()
      .map((u) => ({
        u,
        nombre: nombreUsuario(u),
        estado: estadoUsuario(u),
        roles: (u.rolId && this.acceso.rol(u.rolId)?.nombre) || '',
      }))
      .sort((a, b) => Number(a.estado === 'inactivo') - Number(b.estado === 'inactivo') || a.nombre.localeCompare(b.nombre)),
  );
  /** Filtros por columna, en el buscador: puesto, rol, último acceso y estado. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => {
    const todas = this.todas();
    return [
      { id: 'puesto', titulo: 'Puesto', opciones: opcionesDe(todas, (f) => f.u.puesto ?? '') },
      { id: 'rol', titulo: 'Rol', opciones: opcionesDe(todas, (f) => f.roles) },
      { id: 'acceso', titulo: 'Último acceso', rango: 'fecha' },
      { id: 'estado', titulo: 'Estado', opciones: opcionesDe(todas, (f) => f.estado, (e) => ({ activo: 'Activo', inactivo: 'Inactivo', bloqueado: 'Bloqueado' })[e] ?? e) },
    ];
  });
  protected readonly filas = computed(() => {
    const t = this.texto();
    const f = this.filtros();
    return this.todas().filter(
      (x) =>
        coincide(t, [x.nombre, x.u.correo, x.u.puesto ?? '', x.roles].join(' ')) &&
        pasaFiltro(f, 'puesto', x.u.puesto ?? '') &&
        pasaFiltro(f, 'rol', x.roles) &&
        enRango(f, 'acceso', x.u.ultimoAcceso) &&
        pasaFiltro(f, 'estado', x.estado),
    );
  });
  /** seleccionMultiple pide { id }. */
  protected readonly casillas = seleccionMultiple(computed(() => this.filas().map((f) => f.u)));
  protected readonly conteo = computed(() => {
    const n = this.filas().length;
    const m = this.casillas.marcadas().length;
    if (m) return `${m} de ${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}`;
    return n === 1 ? '1 usuario' : `${n} usuarios`;
  });

  protected readonly vista = vistaPrevia();
  protected readonly previa = computed(() => this.acceso.usuarios().find((u) => u.id === this.vista.abiertaId()) ?? null);
  private readonly detalle = viewChild(DetalleUsuario);

  private puedeDejarla(): boolean {
    return !this.detalle()?.enEdicion() || confirm('Estás editando este usuario. Si cambias, se perderán los cambios que no hayas guardado. ¿Continuar?');
  }

  protected abrir(u: Usuario): void {
    if (u.id === this.vista.abiertaId() || this.puedeDejarla()) this.vista.abrir(u.id);
  }

  protected cerrar(): void {
    if (this.puedeDejarla()) this.vista.cerrar();
  }

  protected verCompleta(u: Usuario): void {
    if (this.puedeDejarla()) void this.router.navigate(['/configuracion/usuarios', u.id]);
  }
}
