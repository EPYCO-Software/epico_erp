import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Maximize2, PencilLine, Trash2, X } from 'lucide';
import { Icon } from 'ui';
import { mensajeDe } from '../ventas/datos';
import { AccesoService, Rol, TODOS, agruparPermisos, tiene } from './acceso';
import { FormRol, RolListo } from './form-rol';
import { permisosSesion } from '../../core/permisos';

/**
 * Un rol: qué permite (por módulo) y cuántos usuarios lo tienen. Editar con form-rol.ts; eliminar solo si nadie lo usa.
 * Los roles del sistema solo los cambia root; nadie cambia un rol con permisos que él no tiene.
 */
@Component({
  selector: 'app-detalle-rol',
  host: { class: 'block' },
  imports: [FormRol, Icon, RouterLink],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ r().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ r().nombre }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ r().descripcion || 'Sin descripción' }}</p>
        <p class="mt-2 flex flex-wrap gap-2 text-sm">
          @if (sistema()) {
            <span class="rounded-md bg-carbon/6 px-2 py-0.5 font-semibold text-texto-suave">Rol del sistema</span>
          }
          <span class="rounded-md bg-carbon/6 px-2 py-0.5 font-semibold text-texto-suave">
            {{ usuarios() === 1 ? '1 usuario lo tiene' : usuarios() + ' usuarios lo tienen' }}
          </span>
        </p>
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a [routerLink]="['/configuracion/roles', r().id]" aria-label="Abrir en vista completa" title="Abrir en vista completa" [class]="botonIcono">
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (!editando()) {
      @if (editable()) {
        <div class="mt-3 flex flex-wrap gap-2">
          @if (puede('config.roles.editar')) {
            <button #botonEditar type="button" [class]="botonSecundario" (click)="editar()">
              <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
            </button>
          }
          @if (puede('config.roles.eliminar')) {
            <button type="button" [class]="botonSecundario" [disabled]="usuarios() > 0" (click)="eliminar()">
              <ui-icon [icono]="iconos.eliminar" [tamano]="16" />Eliminar
            </button>
          }
        </div>
        @if (usuarios() > 0) {
          <p class="mt-1 text-xs text-texto-suave">Para eliminarlo, primero quítalo de los usuarios que lo tienen.</p>
        }
      } @else {
        <p class="mt-3 text-sm text-texto-suave">{{ porQueNo() }}</p>
      }
    }
    <p class="mt-2 text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>

    @if (editando()) {
      <app-form-rol class="mt-4 border-t border-acero/60 pt-4" [rol]="r()" [guardando]="ocupado()" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
      <section class="mt-4 text-sm">
        <p role="heading" [attr.aria-level]="completa() ? 2 : 3" class="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">Permite</p>
        @if (permisos().includes(TODOS)) {
          <p class="rounded-xl bg-white/80 p-3 font-semibold">Acceso total: todos los permisos.</p>
        } @else {
          <ul class="space-y-2" [class]="completa() ? 'lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0' : ''">
            @for (g of resumen(); track g.modulo) {
              <li class="rounded-xl bg-white/80 p-3">
                <p class="font-semibold">{{ g.nombre }}</p>
                <ul class="mt-1 space-y-0.5">
                  @for (r of g.recursos; track r.nombre) {
                    <li><span class="text-texto-suave">{{ r.nombre }}:</span> {{ r.acciones }}</li>
                  }
                </ul>
              </li>
            } @empty {
              <li class="text-texto-suave">Ningún permiso: quien lo tenga solo puede entrar.</li>
            }
          </ul>
          @if (sinCatalogo().length) {
            <p class="mt-2 text-texto-suave">Otros: {{ sinCatalogo().join(', ') }}</p>
          }
        }
      </section>
    }
  `,
})
export class DetalleRol {
  /** Lo que la sesión puede hacer (se ocultan las acciones sin permiso; el backend también las rechaza). */
  protected readonly puede = permisosSesion();
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly acceso = inject(AccesoService);
  protected readonly TODOS = TODOS;

  readonly r = input.required<Rol>();
  readonly vista = input<'previa' | 'completa'>('previa');
  readonly cerrar = output();

  protected readonly iconos = { completa: Maximize2, cerrar: X, editar: PencilLine, eliminar: Trash2 };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico disabled:opacity-50';

  protected readonly completa = computed(() => this.vista() === 'completa');
  protected readonly permisos = computed(() => this.r().permisos ?? []);
  protected readonly sistema = computed(() => this.r().sistema ?? this.r().organizacionId === null);
  /** Si el backend no manda el conteo, lo cuenta con los accesos cargados. */
  protected readonly usuarios = computed(() => this.r().usuarios ?? this.acceso.usuariosConRol(this.r().id));
  /** Root puede todo; los demás, roles de su organización con permisos que ellos tienen. */
  protected readonly editable = computed(
    () => this.acceso.soyRoot() || (!this.sistema() && this.permisos().every((p) => tiene(this.acceso.mios(), p))),
  );
  protected readonly porQueNo = computed(() =>
    this.sistema()
      ? 'Es un rol del sistema: solo el administrador de la plataforma lo cambia.'
      : 'Tiene permisos que tú no tienes: no puedes cambiarlo.',
  );

  /** "Cotizaciones: Ver, Crear, Enviar" por módulo, en el orden del catálogo. */
  protected readonly resumen = computed(() => {
    const s = this.permisos();
    return agruparPermisos(this.acceso.catalogo())
      .map((g) => ({
        modulo: g.modulo,
        nombre: g.nombre,
        recursos: g.recursos
          .map((r) => ({ nombre: r.nombre, acciones: r.acciones.filter((a) => tiene(s, a.clave)).map((a) => a.accionNombre).join(', ') }))
          .filter((r) => r.acciones),
      }))
      .filter((g) => g.recursos.length);
  });
  /** Claves que el catálogo no conoce (o todas, si el backend aún no lo publica). */
  protected readonly sinCatalogo = computed(() => {
    // Los comodines ("ventas.*") ya se ven como sus claves
    const conocidas = new Set(this.acceso.catalogo().map((p) => p.clave));
    return this.permisos().filter((p) => p !== TODOS && !p.endsWith('.*') && !conocidas.has(p));
  });

  // Al pasar a otro rol (la misma ficha con otro `r`) se sale de la edición.
  private readonly id = computed(() => this.r().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  /** Para la lista y la vista completa: preguntar antes de dejarlo. */
  readonly enEdicion = this.editando.asReadonly();
  protected readonly ocupado = signal(false);
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly error = linkedSignal({ source: this.id, computation: () => false });

  private readonly formulario = viewChild(FormRol);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  readonly sinGuardar = computed(() => !!this.formulario()?.sinGuardar());

  private avisar(texto: string, error = false): void {
    this.aviso.set(texto);
    this.error.set(error);
  }

  protected editar(): void {
    this.avisar('');
    this.editando.set(true);
  }

  protected async guardar(l: RolListo): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.acceso.guardarRol(this.r().id, l.nombre, l.descripcion, l.permisos);
      this.terminar('Cambios guardados. Aplican cuando sus usuarios vuelvan a entrar o renueven su sesión.');
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.avisar(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async eliminar(): Promise<void> {
    if (!confirm(`¿Eliminar el rol "${this.r().nombre}"?`)) return;
    try {
      await this.acceso.eliminarRol(this.r().id);
      if (this.completa()) void this.router.navigateByUrl('/configuracion/roles');
      else this.cerrar.emit();
    } catch (e) {
      this.avisar(mensajeDe(e), true);
    }
  }
}
