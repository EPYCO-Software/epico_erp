import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, linkedSignal, output, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KeyRound, Maximize2, Monitor, PencilLine, Power, X } from 'lucide';
import { FechaZonaPipe, Icon } from 'ui';
import { PlantasService } from '../../core/plantas';
import { nombreDispositivo } from '../../layout/preferencias';
import { mensajeDe } from '../ventas/datos';
import { AccesoService, AjustesUsuario, PermisosUsuario as Permisos, SIN_AJUSTES, SesionUsuario, Usuario, agruparPermisos, estadoUsuario, expandir, nombreUsuario, permitido } from './acceso';
import { EstadoUsuarioEtiqueta } from './estado-usuario';
import { FormUsuario, UsuarioListo } from './form-usuario';
import { permisosSesion } from '../../core/permisos';

/**
 * Un usuario: sus datos, sus accesos (empresa, planta y rol) y lo que se hace con él: editar, asignar contraseña,
 * activar o desactivar y cerrar sus sesiones. Igual en la vista previa de Usuarios y en su vista completa.
 */
@Component({
  selector: 'app-detalle-usuario',
  host: { class: 'block' },
  imports: [EstadoUsuarioEtiqueta, FechaZonaPipe, FormUsuario, Icon, RouterLink],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ nombre() }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ nombre() }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ u().correo }}{{ u().puesto ? ' · ' + u().puesto : '' }}</p>
        <app-estado-usuario class="mt-2" [estado]="estado()" />
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/configuracion/usuarios', u().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (!editando()) {
      <div class="mt-3 flex flex-wrap gap-2">
        @if (puede('config.usuarios.editar')) {
          <button #botonEditar type="button" [class]="botonSecundario" [disabled]="!listoParaEditar()" (click)="editar()">
            <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
          </button>
        }
        @if (puede('config.usuarios.editar')) {
          <button type="button" [class]="botonSecundario" [attr.aria-expanded]="asignando()" aria-controls="asignar-password" (click)="asignando.set(!asignando())">
            <ui-icon [icono]="iconos.clave" [tamano]="16" />Asignar contraseña
          </button>
        }
        @if (!esYo()) {
          <button type="button" [class]="botonSecundario" (click)="alternarActivo()">
            <ui-icon [icono]="iconos.activo" [tamano]="16" />{{ u().activo ? 'Desactivar' : 'Activar' }}
          </button>
        }
      </div>
    }
    <p class="mt-2 text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>

    @if (asignando() && !editando()) {
      <div id="asignar-password" role="group" aria-labelledby="asignar-password-titulo" class="mt-3 grid max-w-sm gap-2 rounded-xl bg-white/80 p-3">
        <p id="asignar-password-titulo" class="text-sm font-semibold">Contraseña nueva para {{ nombre() }}</p>
        <label for="asignar-password-campo" class="sr-only">Contraseña nueva (mínimo 8 caracteres)</label>
        <input
          #campoPassword
          id="asignar-password-campo"
          type="password"
          autocomplete="new-password"
          placeholder="Mínimo 8 caracteres"
          class="campo h-10 px-3 text-sm"
          [value]="password()"
          (input)="password.set($any($event.target).value)"
          (keydown.enter)="$event.preventDefault(); asignar()"
        />
        <p class="text-xs text-texto-suave">También lo desbloquea si se bloqueó por intentos fallidos. Compártela por un medio seguro.</p>
        <div class="flex gap-2">
          <button type="button" class="boton-primario h-9 w-auto px-3.5 text-sm" [disabled]="ocupado()" (click)="asignar()">Asignar</button>
          <button type="button" [class]="botonSecundario" (click)="asignando.set(false)">Cancelar</button>
        </div>
      </div>
    }

    @if (editando()) {
      <app-form-usuario
        class="mt-4 border-t border-acero/60 pt-4"
        [u]="u()"
        [accesosIniciales]="accesos()"
        [ajustesIniciales]="permisos() ?? sinAjustes"
        [conPermisos]="!esYo() && !!permisos()"
        [guardando]="ocupado()"
        (listo)="guardar($event)"
        (descartar)="terminar('')"
      />
    } @else {
      <div class="mt-4 grid gap-5 text-sm" [class]="completa() ? 'lg:grid-cols-2 lg:gap-x-10' : ''">
        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Datos</p>
          <dl class="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1">
            <dt class="text-texto-suave">Correo</dt>
            <dd>{{ u().correo }}</dd>
            <dt class="text-texto-suave">Teléfono</dt>
            <dd>{{ u().telefono || '—' }}</dd>
            <dt class="text-texto-suave">Puesto</dt>
            <dd>{{ u().puesto || '—' }}</dd>
            <dt class="text-texto-suave">Último acceso</dt>
            <dd>{{ u().ultimoAcceso ? (u().ultimoAcceso! | fechaZona: zona()) : 'Nunca ha entrado' }}</dd>
            <dt class="text-texto-suave">Alta</dt>
            <dd>{{ u().createdAt | fechaZona: zona() : 'dd/MM/yyyy' }}</dd>
          </dl>
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Rol</p>
          <p class="mb-4 font-semibold">{{ roles() || 'Sin rol' }}</p>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Empresas y plantas</p>
          <ul class="space-y-2">
            @for (a of accesosVista(); track $index) {
              <li class="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 p-3">
                <span class="font-semibold">{{ a.empresa }}</span><span class="text-texto-suave">· {{ a.planta }}</span>
                @if (a.predeterminado) {
                  <span class="rounded-md bg-carbon/6 px-1.5 py-0.5 text-xs font-semibold text-texto-suave">Predeterminada</span>
                }
              </li>
            } @empty {
              <li class="text-texto-suave">Sin accesos: no puede entrar a ninguna empresa.</li>
            }
          </ul>
        </section>

        <section id="permisos-usuario" [class]="completa() ? 'lg:col-span-2' : ''">
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Permisos</p>
          @if (permisos(); as p) {
            <p class="mb-2">{{ textoAjustes() }}</p>
            <ul class="flex flex-wrap gap-2">
              @for (m of modulos(); track m.nombre) {
                <li class="rounded-lg bg-white/80 px-2.5 py-1">
                  <span class="font-semibold">{{ m.nombre }}</span> <span class="text-texto-suave">{{ m.marcadas }} de {{ m.total }}</span>
                </li>
              } @empty {
                <li class="text-texto-suave">Ningún permiso: solo puede entrar.</li>
              }
            </ul>
            <p class="mt-2 text-texto-suave">
              {{ esYo() ? 'Tus propios permisos los ajusta otro administrador.' : 'Para quitarle o darle módulos y acciones, usa Editar.' }}
            </p>
          } @else {
            <p class="text-texto-suave">{{ errorPermisos() || 'Cargando permisos…' }}</p>
          }
        </section>

        <section [class]="completa() ? 'lg:col-span-2' : ''">
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Sesiones abiertas</p>
          @if (sesiones(); as lista) {
            <ul class="space-y-2">
              @for (s of lista; track s.id) {
                <li class="flex flex-wrap items-center gap-3 rounded-xl bg-white/80 p-3">
                  <ui-icon [icono]="iconos.equipo" [tamano]="22" [grosor]="1.6" />
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ s.agente ? dispositivo(s.agente) : 'Dispositivo desconocido' }}</p>
                    <p class="text-texto-suave">Desde el {{ s.creadaEn | fechaZona: zona() }}{{ s.ip ? ' · ' + s.ip : '' }}</p>
                  </div>
                  <button type="button" [class]="botonSecundario" (click)="cerrarSesion(s)">
                    Cerrar sesión<span class="sr-only"> en {{ s.agente ? dispositivo(s.agente) : 'ese dispositivo' }}</span>
                  </button>
                </li>
              } @empty {
                <li class="text-texto-suave">Ninguna abierta.</li>
              }
            </ul>
          } @else {
            <button type="button" [class]="botonSecundario" (click)="verSesiones()">Ver sesiones abiertas</button>
          }
        </section>
      </div>
    }
  `,
})
export class DetalleUsuario {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly injector = inject(Injector);
  private readonly acceso = inject(AccesoService);
  private readonly plantas = inject(PlantasService);

  readonly u = input.required<Usuario>();
  readonly vista = input<'previa' | 'completa'>('previa');
  readonly cerrar = output();

  protected readonly iconos = { completa: Maximize2, cerrar: X, editar: PencilLine, clave: KeyRound, activo: Power, equipo: Monitor };
  protected readonly sinAjustes = SIN_AJUSTES;
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly dispositivo = nombreDispositivo;

  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly nivel = computed(() => (this.completa() ? 2 : 3));
  protected readonly zona = computed(() => this.plantas.actual().zonaHoraria);
  protected readonly nombre = computed(() => nombreUsuario(this.u()));
  protected readonly estado = computed(() => estadoUsuario(this.u()));
  /** Nadie se desactiva a sí mismo. */
  protected readonly esYo = computed(() => this.u().id === this.acceso.yoId());
  protected readonly accesos = computed(() => this.acceso.accesosDe(this.u().id));
  protected readonly accesosVista = computed(() =>
    this.accesos()
      .map((a) => ({ ...this.acceso.describirAcceso(a), predeterminado: a.predeterminado }))
      .sort((a, b) => Number(b.predeterminado) - Number(a.predeterminado)),
  );

  // Al pasar a otro usuario (la misma ficha con otro `u`) se sale de la edición: nunca se edita a otro por arrastre.
  private readonly id = computed(() => this.u().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  /** Para la lista y la vista completa: preguntar antes de dejarlo. */
  readonly enEdicion = this.editando.asReadonly();
  protected readonly asignando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly password = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly ocupado = signal(false);
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly error = linkedSignal({ source: this.id, computation: () => false });
  /** null hasta pedirlas; al cambiar de usuario se vuelven a pedir. */
  protected readonly sesiones = linkedSignal<string, SesionUsuario[] | null>({ source: () => this.u().id, computation: () => null });

  /** Lo que da su rol y sus ajustes (los comodines ya cambiados por claves, como trabaja la matriz). */
  protected readonly permisos = linkedSignal<string, Permisos | null>({ source: () => this.u().id, computation: () => null });
  protected readonly errorPermisos = signal('');
  /** Editar espera a sus permisos (para no pisar sus ajustes); si el servidor no los da, se edita sin ellos. */
  protected readonly listoParaEditar = computed(() => !!this.permisos() || !!this.errorPermisos());
  protected readonly roles = computed(() => {
    const id = this.u().rolId;
    return id ? (this.acceso.rol(id)?.nombre ?? 'Rol desconocido') : '';
  });

  private readonly cargarPermisos = effect(() => {
    this.u().id;
    this.acceso.catalogo();
    untracked(() => void this.recargarPermisos());
  });

  private async recargarPermisos(): Promise<void> {
    const id = this.u().id;
    const catalogo = this.acceso.catalogo().map((p) => p.clave);
    this.errorPermisos.set('');
    try {
      const p = await this.acceso.permisosDe(id);
      if (id !== this.u().id) return;
      this.permisos.set({ delRol: p.delRol, agregados: expandir(p.agregados, catalogo), quitados: expandir(p.quitados, catalogo) });
    } catch (e) {
      this.errorPermisos.set((e as { status?: number }).status === 404 ? 'El servidor aún no permite ajustar permisos por usuario.' : mensajeDe(e));
    }
  }

  /** "Los de su rol" o "Los de su rol, con 2 agregados y 1 quitado". */
  protected readonly textoAjustes = computed(() => {
    const p = this.permisos();
    if (!p || (!p.agregados.length && !p.quitados.length)) return 'Los de su rol.';
    const partes = [
      p.agregados.length ? `${p.agregados.length} ${p.agregados.length === 1 ? 'agregado' : 'agregados'}` : '',
      p.quitados.length ? `${p.quitados.length} ${p.quitados.length === 1 ? 'quitado' : 'quitados'}` : '',
    ].filter(Boolean);
    return `Los de su rol, con ${partes.join(' y ')}.`;
  });
  /** Los módulos a los que entra y cuántos permisos tiene de cada uno. */
  protected readonly modulos = computed(() => {
    const p = this.permisos();
    if (!p) return [];
    return agruparPermisos(this.acceso.catalogo())
      .map((g) => {
        const claves = g.recursos.flatMap((r) => r.acciones.map((a) => a.clave));
        return { nombre: g.nombre, total: claves.length, marcadas: claves.filter((c) => permitido(p.delRol, p, c)).length };
      })
      .filter((m) => m.marcadas);
  });


  private readonly formulario = viewChild(FormUsuario);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  private readonly campoPassword = viewChild<ElementRef<HTMLInputElement>>('campoPassword');
  /** Con cambios sin guardar en el formulario (la lista pregunta antes de dejarlo). */
  readonly sinGuardar = computed(() => !!this.formulario()?.sinGuardar());

  private avisar(texto: string, error = false): void {
    this.aviso.set(texto);
    this.error.set(error);
  }

  protected editar(): void {
    this.avisar('');
    this.asignando.set(false);
    this.editando.set(true);
  }

  protected async guardar(l: UsuarioListo): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.acceso.guardarUsuario(this.u().id, l.datos, l.accesos);
      // Los permisos solo si cambiaron (y nunca los propios: el backend no lo permite)
      const p = this.permisos();
      if (p && !this.esYo() && JSON.stringify([l.ajustes.agregados, l.ajustes.quitados]) !== JSON.stringify([p.agregados, p.quitados])) {
        await this.acceso.guardarPermisos(this.u().id, l.ajustes);
      }
      await this.recargarPermisos();
      this.terminar('Cambios guardados. Los permisos aplican cuando vuelva a entrar o renueve su sesión.');
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Al salir de la edición el foco vuelve a "Editar". */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.avisar(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async asignar(): Promise<void> {
    if (this.password().length < 8) {
      this.avisar('La contraseña debe tener al menos 8 caracteres.', true);
      return this.campoPassword()?.nativeElement.focus();
    }
    this.ocupado.set(true);
    try {
      await this.acceso.asignarPassword(this.u().id, this.password());
      this.asignando.set(false);
      this.password.set('');
      this.avisar(`Contraseña asignada a ${this.nombre()}.`);
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async alternarActivo(): Promise<void> {
    const activo = !this.u().activo;
    if (!activo && !confirm(`¿Desactivar a ${this.nombre()}? No podrá entrar al ERP hasta que lo vuelvas a activar.`)) return;
    try {
      await this.acceso.activar(this.u().id, activo);
      this.avisar(activo ? `${this.nombre()} puede volver a entrar.` : `${this.nombre()} ya no puede entrar.`);
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    }
  }

  protected async verSesiones(): Promise<void> {
    try {
      this.sesiones.set(await this.acceso.sesiones(this.u().id));
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    }
  }

  protected async cerrarSesion(s: SesionUsuario): Promise<void> {
    try {
      await this.acceso.cerrarSesion(s.id);
      this.sesiones.update((l) => l?.filter((x) => x.id !== s.id) ?? null);
      this.avisar('Sesión cerrada. Su acceso termina en máximo 15 minutos.');
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    }
  }
}
