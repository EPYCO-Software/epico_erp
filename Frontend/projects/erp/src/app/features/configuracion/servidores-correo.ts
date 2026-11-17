import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { X } from 'lucide';
import { AUTH_API_URL, AuthService, Buscador, FieldError, FiltrosElegidos, GrupoFiltro, Icon, opcionesDe, pasaFiltro } from 'ui';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { CAJAS_LISTA, FILA_LISTA, PanelLateral, vistaPrevia } from '../../layout/panel-lateral';
import { mensajeDe } from '../ventas/datos';
import { tiene } from './acceso';

type Seguridad = 'start_tls' | 'ssl' | 'ninguna';

export interface ServidorCorreo {
  id: string;
  nombre: string;
  host: string;
  puerto: number;
  seguridad: Seguridad;
  usuario: string | null;
  remitente: string | null;
  prioridad: number;
  activo: boolean;
  /** La contraseña nunca vuelve del servidor; solo si hay una guardada. */
  tienePassword: boolean;
}

const SEGURIDAD: Record<Seguridad, string> = { start_tls: 'STARTTLS', ssl: 'SSL/TLS', ninguna: 'Ninguna' };

const NUEVO = { nombre: '', host: '', puerto: 587, seguridad: 'start_tls' as Seguridad, usuario: '', remitente: '', prioridad: 10, activo: true, password: '', quitarPassword: false };

/**
 * Seguridad y plataforma → Servidores de correo (SMTP) con los que el sistema manda correos: se usan por prioridad
 * (menor primero). La contraseña solo se escribe: vacía conserva la guardada. "Probar conexión" la valida en el servidor.
 */
@Component({
  selector: 'app-servidores-correo',
  imports: [Buscador, EnEncabezado, FieldError, FormField, Icon, PanelLateral],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex items-center gap-3 md:grid md:grid-cols-[minmax(max-content,1fr)_minmax(0,640px)_minmax(max-content,1fr)] md:gap-6">
        <div class="flex items-center gap-3">
          @if (puedo('crear')) {
            <button type="button" class="boton-primario h-9 w-auto px-3.5 text-[15px]" (click)="abrir('nuevo')">Nuevo</button>
          }
          <h1 class="text-xl font-bold tracking-[-0.02em] text-carbon max-md:sr-only">Servidores de correo</h1>
        </div>
        <ui-buscador
          class="min-w-0 flex-1"
          idBuscar="buscar-servidor"
          etiqueta="Buscar servidores por nombre, servidor o remitente"
          [(texto)]="texto"
          [grupos]="grupos()"
          [(filtros)]="filtros"
        />
        <div class="text-right">
          @if (soyRoot()) {
            <button type="button" class="text-sm font-semibold text-epico underline underline-offset-4" (click)="probarGlobal()">
              Probar servidor global
            </button>
          }
        </div>
      </div>
    </ng-template>

    @if (errorCarga()) {
      <p role="alert" class="glass mb-4 px-5 py-4 text-sm font-medium text-[#8E332C]">{{ errorCarga() }}</p>
    }
    <p class="mb-3 text-sm font-medium empty:hidden" [class]="avisoGlobal().error ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ avisoGlobal().texto }}</p>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <div [class]="cajas.tabla">
          <div tabindex="0" role="region" aria-label="Tabla de servidores de correo" [class]="cajas.region">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <caption class="sr-only">Servidores de correo, en el orden en que se usan. Clic o Enter en una fila la abre para editarla.</caption>
              <thead [class]="cajas.titulos">
                <tr>
                  <th scope="col" class="px-3 py-2.5 text-right font-semibold">Prioridad</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Nombre</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Servidor</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold" [class.hidden]="vista.abiertaId()">Remitente</th>
                  <th scope="col" class="px-3 py-2.5 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (s of visibles(); track s.id) {
                  <tr [id]="'fila-' + s.id" tabindex="0" [class]="fila" [attr.aria-current]="s.id === vista.abiertaId() ? 'true' : null" (click)="abrir(s.id)" (keydown.enter)="abrir(s.id)">
                    <td class="px-3 py-2.5 text-right tabular-nums">{{ s.prioridad }}</td>
                    <td class="px-3 py-2.5 font-semibold">{{ s.nombre }}</td>
                    <td class="px-3 py-2.5">{{ s.host }}:{{ s.puerto }} · {{ seguridad[s.seguridad] }}</td>
                    <td class="max-w-xs truncate px-3 py-2.5" [class.hidden]="vista.abiertaId()">{{ s.remitente || s.usuario || '—' }}</td>
                    <td class="px-3 py-2.5">{{ s.activo ? 'Activo' : 'Inactivo' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-3 py-12 text-center text-texto-suave">
                      {{
                        cargando()
                          ? 'Cargando servidores…'
                          : servidores().length
                            ? 'Ningún servidor coincide con la búsqueda o los filtros.'
                            : 'No hay servidores de correo: se usa el global de la plataforma, si existe.'
                      }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (vista.abiertaId(); as id) {
        <aside appPanelLateral (cerrar)="vista.cerrar()">
          <div class="flex items-start justify-between gap-3">
            <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ actual()?.nombre || 'Servidor nuevo' }}</h2>
            <button type="button" aria-label="Cerrar" [class]="botonIcono" (click)="vista.cerrar()"><ui-icon [icono]="iconoCerrar" [tamano]="18" /></button>
          </div>

          <form class="mt-3 grid gap-3" novalidate (submit)="guardar($event)">
            <fieldset class="contents" [disabled]="!puedo(actual() ? 'editar' : 'crear')">
              <div>
                <label for="sc-nombre" class="mb-1 block text-sm font-medium">Nombre</label>
                <input id="sc-nombre" class="campo h-10 px-3 text-sm" autocomplete="off" [formField]="f.nombre" aria-describedby="sc-nombre-error" [attr.aria-invalid]="f.nombre().touched() && f.nombre().invalid()" />
                <ui-field-error [campo]="f.nombre" errorId="sc-nombre-error" />
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                <div>
                  <label for="sc-host" class="mb-1 block text-sm font-medium">Servidor (host)</label>
                  <input id="sc-host" class="campo h-10 px-3 text-sm" autocomplete="off" placeholder="smtp.empresa.mx" [formField]="f.host" aria-describedby="sc-host-error" [attr.aria-invalid]="f.host().touched() && f.host().invalid()" />
                  <ui-field-error [campo]="f.host" errorId="sc-host-error" />
                </div>
                <div>
                  <label for="sc-puerto" class="mb-1 block text-sm font-medium">Puerto</label>
                  <input id="sc-puerto" type="number" class="campo h-10 px-3 text-sm" [formField]="f.puerto" aria-describedby="sc-puerto-error" [attr.aria-invalid]="f.puerto().touched() && f.puerto().invalid()" />
                  <ui-field-error [campo]="f.puerto" errorId="sc-puerto-error" />
                </div>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                <div>
                  <label for="sc-seguridad" class="mb-1 block text-sm font-medium">Seguridad</label>
                  <select id="sc-seguridad" class="campo h-10 px-3 text-sm" [formField]="f.seguridad">
                    @for (o of opcionesSeguridad; track o[0]) {
                      <option [value]="o[0]">{{ o[1] }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label for="sc-prioridad" class="mb-1 block text-sm font-medium">Prioridad</label>
                  <input id="sc-prioridad" type="number" class="campo h-10 px-3 text-sm" aria-describedby="sc-prioridad-ayuda" [formField]="f.prioridad" />
                </div>
              </div>
              <p id="sc-prioridad-ayuda" class="-mt-2 text-xs text-texto-suave">Se usa primero el de menor prioridad; si falla, el siguiente.</p>
              <div>
                <label for="sc-usuario" class="mb-1 block text-sm font-medium">Usuario (opcional)</label>
                <input id="sc-usuario" class="campo h-10 px-3 text-sm" autocomplete="off" [formField]="f.usuario" />
              </div>
              <div>
                <label for="sc-password" class="mb-1 block text-sm font-medium">Contraseña</label>
                <input
                  id="sc-password"
                  type="password"
                  autocomplete="new-password"
                  class="campo h-10 px-3 text-sm"
                  aria-describedby="sc-password-ayuda"
                  [placeholder]="actual()?.tienePassword ? '••••••••' : ''"
                  [formField]="f.password"
                />
                <p id="sc-password-ayuda" class="mt-1 text-xs text-texto-suave">
                  {{ actual()?.tienePassword ? 'Hay una guardada: déjala vacía para conservarla.' : 'No hay contraseña guardada.' }}
                </p>
                @if (actual()?.tienePassword) {
                  <label class="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" class="casilla" [formField]="f.quitarPassword" />Quitar la contraseña guardada</label>
                }
              </div>
              <div>
                <label for="sc-remitente" class="mb-1 block text-sm font-medium">Remitente (opcional)</label>
                <input id="sc-remitente" class="campo h-10 px-3 text-sm" autocomplete="off" placeholder="EPICO <ventas@empresa.mx>" aria-describedby="sc-remitente-ayuda" [formField]="f.remitente" />
                <p id="sc-remitente-ayuda" class="mt-1 text-xs text-texto-suave">Vacío: se manda como el usuario.</p>
              </div>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="casilla" [formField]="f.activo" />Activo</label>
            </fieldset>

            <p class="text-sm font-medium empty:hidden" [class]="aviso().error ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso().texto }}</p>

            <div class="flex flex-wrap gap-2">
              @if (puedo(actual() ? 'editar' : 'crear')) {
                <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm" [disabled]="ocupado()" [attr.aria-busy]="ocupado()">
                  {{ actual() ? 'Guardar cambios' : 'Crear servidor' }}
                </button>
              }
              @if (actual() && puedo('crear')) {
                <button type="button" [class]="botonSecundario" [disabled]="ocupado()" (click)="probar(id)">Probar conexión</button>
              }
              @if (actual() && puedo('eliminar')) {
                <button type="button" [class]="botonSecundario" [disabled]="ocupado()" (click)="eliminar(id)">Eliminar</button>
              }
            </div>
            @if (actual() && f().dirty()) {
              <p class="text-xs text-texto-suave">"Probar conexión" usa lo guardado: guarda primero tus cambios.</p>
            }
          </form>
        </aside>
      }
    </div>
  `,
})
export default class ServidoresCorreo {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = inject(AUTH_API_URL, { optional: true }) + '/servidores-correo';

  protected readonly cajas = CAJAS_LISTA;
  protected readonly fila = FILA_LISTA;
  protected readonly seguridad = SEGURIDAD;
  protected readonly opcionesSeguridad = Object.entries(SEGURIDAD);
  protected readonly iconoCerrar = X;
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-50';

  protected readonly servidores = signal<ServidorCorreo[]>([]);
  protected readonly texto = signal('');
  /** Filtros por columna, en el buscador: seguridad de la conexión y estado. */
  protected readonly filtros = signal<FiltrosElegidos>({});
  protected readonly grupos = computed<GrupoFiltro[]>(() => [
    { id: 'seguridad', titulo: 'Seguridad', opciones: opcionesDe(this.servidores(), (s) => s.seguridad, (s) => SEGURIDAD[s as Seguridad]) },
    { id: 'estado', titulo: 'Estado', opciones: opcionesDe(this.servidores(), (s) => (s.activo ? 'activo' : 'inactivo'), (e) => (e === 'activo' ? 'Activo' : 'Inactivo')) },
  ]);
  protected readonly visibles = computed(() => {
    const q = this.texto().trim().toLowerCase();
    const f = this.filtros();
    return this.servidores().filter(
      (s) =>
        pasaFiltro(f, 'seguridad', s.seguridad) &&
        pasaFiltro(f, 'estado', s.activo ? 'activo' : 'inactivo') &&
        (!q || `${s.nombre} ${s.host} ${s.remitente ?? ''} ${s.usuario ?? ''}`.toLowerCase().includes(q)),
    );
  });
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal('');
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal({ texto: '', error: false });
  protected readonly avisoGlobal = signal({ texto: '', error: false });

  private readonly mios = computed(() => this.auth.sesion()?.permisos ?? []);
  protected readonly soyRoot = computed(() => this.mios().includes('*'));
  protected puedo(accion: 'crear' | 'editar' | 'eliminar'): boolean {
    return tiene(this.mios(), `config.servidores_correo.${accion}`);
  }

  protected readonly vista = vistaPrevia();
  protected readonly actual = computed(() => this.servidores().find((s) => s.id === this.vista.abiertaId()) ?? null);

  protected readonly modelo = signal({ ...NUEVO });
  protected readonly f = form(this.modelo, (m) => {
    required(m.nombre, { message: 'Escribe un nombre, por ejemplo "Correo de ventas".' });
    required(m.host, { message: 'Escribe el servidor SMTP.' });
    required(m.puerto, { message: 'Escribe el puerto.' });
    min(m.puerto, 1, { message: 'Puerto entre 1 y 65535.' });
    max(m.puerto, 65535, { message: 'Puerto entre 1 y 65535.' });
  });

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const lista = await firstValueFrom(this.http.get<ServidorCorreo[]>(`${this.base}?take=200`));
      this.servidores.set([...lista].sort((a, b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre)));
      this.errorCarga.set('');
    } catch (e) {
      this.errorCarga.set(mensajeDe(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrir(id: string): void {
    const s = this.servidores().find((x) => x.id === id);
    this.modelo.set(
      s ? { ...NUEVO, ...s, usuario: s.usuario ?? '', remitente: s.remitente ?? '', password: '', quitarPassword: false } : { ...NUEVO },
    );
    this.f().reset();
    this.aviso.set({ texto: '', error: false });
    this.vista.abrir(id);
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const s = this.actual();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      const cuerpo = {
        nombre: m.nombre.trim(),
        host: m.host.trim(),
        puerto: m.puerto,
        seguridad: m.seguridad,
        usuario: m.usuario.trim() || null,
        remitente: m.remitente.trim() || null,
        prioridad: m.prioridad,
        activo: m.activo,
        // null conserva la guardada; "" la borra.
        password: m.quitarPassword ? '' : m.password || null,
      };
      this.ocupado.set(true);
      try {
        const r = s
          ? await firstValueFrom(this.http.put<ServidorCorreo>(`${this.base}/${s.id}`, { ...cuerpo, id: s.id }))
          : await firstValueFrom(this.http.post<ServidorCorreo>(this.base, cuerpo));
        await this.cargar();
        // Al crear, queda abierto el nuevo para poder probarlo
        this.abrir(r?.id ?? s!.id);
        this.aviso.set({ texto: s ? 'Cambios guardados.' : 'Servidor creado. Ya puedes probar la conexión.', error: false });
      } catch (err) {
        this.aviso.set({ texto: mensajeDe(err), error: true });
      } finally {
        this.ocupado.set(false);
      }
      return undefined;
    });
    if (!valido) (['nombre', 'host', 'puerto'] as const).some((c) => this.f[c]().invalid() && (document.getElementById('sc-' + c)?.focus(), true));
  }

  protected async probar(id: string): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set({ texto: 'Probando la conexión…', error: false });
    try {
      await firstValueFrom(this.http.post(`${this.base}/${id}/probar`, null));
      this.aviso.set({ texto: 'Conexión correcta: el servidor aceptó los datos.', error: false });
    } catch (err) {
      this.aviso.set({ texto: mensajeDe(err), error: true });
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async probarGlobal(): Promise<void> {
    this.avisoGlobal.set({ texto: 'Probando el servidor global…', error: false });
    try {
      await firstValueFrom(this.http.post(`${this.base}/global/probar`, null));
      this.avisoGlobal.set({ texto: 'El servidor global de la plataforma funciona.', error: false });
    } catch (err) {
      const no = (err as { status?: number }).status === 404;
      this.avisoGlobal.set({ texto: no ? 'No hay servidor global configurado en la plataforma.' : mensajeDe(err), error: true });
    }
  }

  protected async eliminar(id: string): Promise<void> {
    if (!confirm(`¿Eliminar el servidor "${this.actual()?.nombre}"?`)) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/${id}`));
      this.vista.cerrar();
      await this.cargar();
    } catch (err) {
      this.aviso.set({ texto: mensajeDe(err), error: true });
    }
  }
}
