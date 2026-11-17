import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  applyEach,
  email,
  form,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ChevronDown, Plus, Trash2 } from 'lucide';
import { FieldError, Icon } from 'ui';
import {
  AccesoService,
  AccesoUsuario,
  AjustesUsuario,
  DatosUsuario,
  SIN_AJUSTES,
  Usuario,
  tiene,
} from './acceso';
import { PermisosUsuario } from './permisos-usuario';

/** A qué empresa (y planta) entra. El rol es uno solo para el usuario (ModeloUsuario.rolId). */
interface AccesoForm {
  empresaId: string;
  /** '' = todas las plantas de la empresa. */
  sucursalId: string;
  predeterminado: boolean;
}

interface ModeloUsuario {
  correo: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  puesto: string;
  /** Solo en el alta (opcional): sin ella no puede entrar hasta que se le asigne. */
  password: string;
  /** Su rol: la plantilla de sus permisos (luego se ajustan por módulo). */
  rolId: string;
  accesos: AccesoForm[];
}

/** Lo que entrega el formulario al guardar. */
export interface UsuarioListo {
  datos: DatosUsuario;
  accesos: AccesoUsuario[];
  password: string | null;
  /** Lo que se le quita o agrega sobre su rol. */
  ajustes: AjustesUsuario;
}

/**
 * Alta y edición de un usuario interno: sus datos, su rol (uno solo), a qué empresas y plantas entra, y sus permisos por
 * módulo (los del rol, con lo que se le quite o agregue), los mismos en todas sus empresas. Solo se ofrecen las empresas
 * de quien edita y los roles cuyos permisos tiene él mismo (el backend aplica la misma regla).
 */
@Component({
  selector: 'app-form-usuario',
  imports: [FieldError, FormField, Icon, NgTemplateOutlet, PermisosUsuario],
  host: { class: '@container block' },
  template: `
    <ng-template #campo let-c let-id="id" let-etiqueta="etiqueta" let-tipo="tipo" let-auto="auto">
      <div>
        <label [for]="id" class="mb-1 block text-sm font-medium">{{ etiqueta }}</label>
        <input
          [id]="id"
          [type]="tipo ?? 'text'"
          [attr.autocomplete]="auto ?? 'off'"
          class="campo h-10 px-3 text-sm"
          [attr.aria-invalid]="c().touched() && c().invalid()"
          [attr.aria-describedby]="id + '-error'"
          [formField]="c"
        />
        <ui-field-error [campo]="c" [errorId]="id + '-error'" />
      </div>
    </ng-template>

    <form
      id="form-usuario"
      novalidate
      aria-labelledby="form-usuario-titulo"
      (submit)="guardar($event)"
    >
      <p id="form-usuario-titulo" class="font-bold">
        {{ u() ? 'Editar usuario' : 'Usuario nuevo' }}
      </p>

      <details open [class]="seccion + ' mt-4'">
        <summary [class]="cabecera">
          <span class="font-bold">Datos</span>
          <span class="min-w-0 flex-1 truncate text-texto-suave">{{
            modelo().correo || 'Sin correo'
          }}</span>
          <ui-icon
            [icono]="iconos.abajo"
            [tamano]="18"
            class="shrink-0 text-texto-suave transition-transform group-open:rotate-180"
          />
        </summary>
        <fieldset class="px-3 pb-3">
          <legend class="sr-only">Datos</legend>
          <div class="grid gap-3 @lg:grid-cols-2">
            <ng-container
              *ngTemplateOutlet="
                campo;
                context: {
                  $implicit: f.nombre,
                  id: 'usuario-nombre',
                  etiqueta: 'Nombre',
                  auto: 'given-name',
                }
              "
            />
            <ng-container
              *ngTemplateOutlet="
                campo;
                context: {
                  $implicit: f.apellidos,
                  id: 'usuario-apellidos',
                  etiqueta: 'Apellidos',
                  auto: 'family-name',
                }
              "
            />
            <ng-container
              *ngTemplateOutlet="
                campo;
                context: {
                  $implicit: f.correo,
                  id: 'usuario-correo',
                  etiqueta: 'Correo (con él entra al ERP)',
                  tipo: 'email',
                  auto: 'email',
                }
              "
            />
            <ng-container
              *ngTemplateOutlet="
                campo;
                context: {
                  $implicit: f.telefono,
                  id: 'usuario-telefono',
                  etiqueta: 'Teléfono',
                  tipo: 'tel',
                }
              "
            />
            <ng-container
              *ngTemplateOutlet="
                campo;
                context: { $implicit: f.puesto, id: 'usuario-puesto', etiqueta: 'Puesto' }
              "
            />
            @if (!u()) {
              <div>
                <label for="usuario-password" class="mb-1 block text-sm font-medium"
                  >Contraseña inicial (opcional)</label
                >
                <input
                  id="usuario-password"
                  type="password"
                  autocomplete="new-password"
                  class="campo h-10 px-3 text-sm"
                  [attr.aria-invalid]="f.password().touched() && f.password().invalid()"
                  aria-describedby="usuario-password-error usuario-password-nota"
                  [formField]="f.password"
                />
                <ui-field-error [campo]="f.password" errorId="usuario-password-error" />
                <p id="usuario-password-nota" class="mt-1 text-xs text-texto-suave">
                  Mínimo 8 caracteres. Sin ella, no podrá entrar hasta que se la asignes.
                </p>
              </div>
            }
          </div>
        </fieldset>
      </details>

      <details open [class]="seccion + ' mt-3'">
        <summary [class]="cabecera">
          <span class="font-bold">Rol</span>
          <span class="min-w-0 flex-1 truncate text-texto-suave">{{
            nombreRol() || 'Sin rol'
          }}</span>
          <ui-icon
            [icono]="iconos.abajo"
            [tamano]="18"
            class="shrink-0 text-texto-suave transition-transform group-open:rotate-180"
          />
        </summary>
        <fieldset class="px-3 pb-3">
          <legend class="sr-only">Rol</legend>
          <div class="max-w-sm">
            <label for="usuario-rol" class="mb-1 block text-sm font-medium"
              >Rol (sus permisos por omisión)</label
            >
            <div class="relative">
              <select
                id="usuario-rol"
                class="campo h-10 appearance-none pr-9 pl-3 text-sm"
                [attr.aria-invalid]="f.rolId().touched() && f.rolId().invalid()"
                aria-describedby="usuario-rol-error"
                [formField]="f.rolId"
              >
                <option value="" disabled>Elige el rol</option>
                @for (r of roles(); track r.id) {
                  <option [value]="r.id">{{ r.nombre }}</option>
                }
              </select>
              <ui-icon
                [icono]="iconos.abajo"
                [tamano]="16"
                class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
              />
            </div>
            <ui-field-error [campo]="f.rolId" errorId="usuario-rol-error" />
          </div>
        </fieldset>
      </details>

      <details open [class]="seccion + ' mt-3'">
        <summary [class]="cabecera">
          <span class="font-bold">Empresas y plantas</span>
          <span class="min-w-0 flex-1 truncate text-texto-suave">{{ resumenAccesos() }}</span>
          <ui-icon
            [icono]="iconos.abajo"
            [tamano]="18"
            class="shrink-0 text-texto-suave transition-transform group-open:rotate-180"
          />
        </summary>
        <fieldset class="px-3 pb-3">
          <legend class="sr-only">Empresas y plantas</legend>
          <p class="mb-3 text-sm text-texto-suave">
            A qué empresas entra. Sin planta, a todas las de esa empresa. La predeterminada es con
            la que entra.
          </p>
          <ul class="space-y-3">
            @for (a of modelo().accesos; track $index; let i = $index) {
              <li class="rounded-xl bg-white/80 p-3">
                <div class="mb-2 flex items-center justify-between gap-2">
                  <label class="flex min-h-9 items-center gap-2 text-sm font-semibold">
                    <input
                      type="radio"
                      name="acceso-predeterminado"
                      class="casilla"
                      [checked]="a.predeterminado"
                      (change)="predeterminar(i)"
                    />
                    Predeterminado
                  </label>
                  <button
                    type="button"
                    [class]="botonIcono"
                    [attr.aria-label]="'Quitar el acceso ' + (i + 1)"
                    [disabled]="modelo().accesos.length === 1"
                    (click)="quitar(i)"
                  >
                    <ui-icon [icono]="iconos.quitar" [tamano]="17" />
                  </button>
                </div>
                <div class="grid gap-3 @lg:grid-cols-2">
                  @for (s of selects(i); track s.id) {
                    <div>
                      <label [for]="s.id" class="mb-1 block text-sm font-medium">{{
                        s.etiqueta
                      }}</label>
                      <div class="relative">
                        <select
                          [id]="s.id"
                          class="campo h-10 appearance-none pr-9 pl-3 text-sm"
                          [attr.aria-invalid]="s.campo().touched() && s.campo().invalid()"
                          [attr.aria-describedby]="s.id + '-error'"
                          [formField]="s.campo"
                        >
                          @for (o of s.opciones; track o.valor) {
                            <option
                              [value]="o.valor"
                              [disabled]="o.valor === '' && s.vacioDeshabilitado"
                            >
                              {{ o.texto }}
                            </option>
                          }
                        </select>
                        <ui-icon
                          [icono]="iconos.abajo"
                          [tamano]="16"
                          class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave"
                        />
                      </div>
                      <ui-field-error [campo]="s.campo" [errorId]="s.id + '-error'" />
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
          <button #botonAgregar type="button" [class]="botonTexto + ' mt-2'" (click)="agregar()">
            <ui-icon [icono]="iconos.agregar" [tamano]="17" />Agregar acceso
          </button>
        </fieldset>
      </details>

      @if (conPermisos()) {
        <details open [class]="seccion + ' mt-3'">
          <summary [class]="cabecera">
            <span class="font-bold">Permisos por módulo</span>
            <span class="min-w-0 flex-1 truncate text-texto-suave">{{ resumenPermisos() }}</span>
            <ui-icon
              [icono]="iconos.abajo"
              [tamano]="18"
              class="shrink-0 text-texto-suave transition-transform group-open:rotate-180"
            />
          </summary>
          <fieldset class="px-3 pb-3">
            <legend class="sr-only">Permisos por módulo</legend>
            @if (modelo().rolId) {
              <app-permisos-usuario [delRol]="delRol()" [(ajustes)]="ajustes" />
            } @else {
              <p class="text-sm text-texto-suave">
                Elige su rol: sus permisos aparecen aquí para que le quites o agregues lo que
                necesites.
              </p>
            }
          </fieldset>
        </details>
      } @else if (u()) {
        <p class="mt-5 text-sm text-texto-suave">
          Tus propios permisos los ajusta otro administrador.
        </p>
      }

      <div class="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          class="boton-primario h-10 w-auto px-4 text-sm"
          [disabled]="guardando()"
          [attr.aria-busy]="guardando()"
        >
          {{ u() ? 'Guardar cambios' : 'Crear usuario' }}
        </button>
        <button type="button" [class]="botonSecundario" (click)="descartar.emit()">
          Descartar
        </button>
      </div>
    </form>
  `,
})
export class FormUsuario implements OnInit {
  private readonly injector = inject(Injector);
  private readonly acceso = inject(AccesoService);

  /** Sin él, alta. */
  readonly u = input<Usuario | null>(null);
  readonly accesosIniciales = input<AccesoUsuario[]>([]);
  /** Sus ajustes actuales sobre el rol (en la edición). */
  readonly ajustesIniciales = input<AjustesUsuario>(SIN_AJUSTES);
  /** Sin la matriz cuando el usuario se edita a sí mismo (nadie cambia sus propios permisos). */
  readonly conPermisos = input(true);
  /** Mientras quien lo usa guarda (deshabilita el botón). */
  readonly guardando = input(false);
  readonly listo = output<UsuarioListo>();
  readonly descartar = output();

  protected readonly iconos = { quitar: Trash2, agregar: Plus, abajo: ChevronDown };
  /** Cada sección se pliega (detalles nativos): con su resumen en la cabecera para no tener que abrirla. */
  protected readonly seccion = 'group rounded-xl border border-acero/50 bg-white/40';
  protected readonly cabecera =
    'flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm hover:bg-carbon/3 focus-visible:outline-2 focus-visible:outline-epico [&::-webkit-details-marker]:hidden';
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico disabled:opacity-40';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonTexto =
    'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico';

  protected readonly modelo = signal<ModeloUsuario>({
    correo: '',
    nombre: '',
    apellidos: '',
    telefono: '',
    puesto: '',
    password: '',
    rolId: '',
    accesos: [],
  });
  protected readonly f = form(this.modelo, (m) => {
    required(m.nombre, { message: 'Escribe el nombre.' });
    required(m.correo, { message: 'Escribe el correo.' });
    email(m.correo, { message: 'Escribe un correo válido.' });
    validate(m.telefono, ({ value }) =>
      !value() || /^\d{10}$/.test(value().replace(/\D/g, ''))
        ? undefined
        : { kind: 'telefono', message: 'El teléfono tiene 10 dígitos.' },
    );
    validate(m.password, ({ value }) =>
      !value() || value().length >= 8
        ? undefined
        : { kind: 'password', message: 'Mínimo 8 caracteres.' },
    );
    required(m.rolId, { message: 'Elige el rol.' });
    applyEach(m.accesos, (a) => {
      required(a.empresaId, { message: 'Elige la empresa.' });
    });
  });

  /** Solo los roles cuyos permisos tiene quien edita (si el backend aún no los manda, todos). */
  private readonly roles = computed(() =>
    this.acceso
      .roles()
      .filter((r) => !r.permisos || r.permisos.every((p) => tiene(this.acceso.mios(), p)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  );

  /** Los dos selects de un acceso (empresa y planta) con sus opciones. */
  protected selects(i: number) {
    const a = this.modelo().accesos[i];
    const empresa = this.acceso.empresas().find((e) => e.id === a.empresaId);
    const fa = this.f.accesos[i];
    return [
      {
        id: `acceso-${i}-empresa`,
        etiqueta: 'Empresa',
        campo: fa.empresaId,
        vacioDeshabilitado: true,
        opciones: [
          { valor: '', texto: 'Elige la empresa' },
          ...this.acceso.empresas().map((e) => ({ valor: e.id, texto: e.nombre })),
        ],
      },
      {
        id: `acceso-${i}-planta`,
        etiqueta: 'Planta',
        campo: fa.sucursalId,
        vacioDeshabilitado: false,
        opciones: [
          { valor: '', texto: 'Todas las plantas' },
          ...(empresa?.plantas ?? []).map((p) => ({ valor: p.id, texto: p.nombre })),
        ],
      },
    ];
  }

  /** Ajustes sobre el rol: quitados y agregados. */
  protected readonly ajustes = signal<AjustesUsuario>(SIN_AJUSTES);
  protected readonly nombreRol = computed(() => this.acceso.rol(this.modelo().rolId)?.nombre ?? '');
  /** "Concretos Demo · Planta Norte y 1 más". */
  protected readonly resumenAccesos = computed(() => {
    const accesos = this.modelo().accesos.filter((a) => a.empresaId);
    if (!accesos.length) return 'Sin empresas';
    const primero = accesos.find((a) => a.predeterminado) ?? accesos[0];
    const d = this.acceso.describirAcceso({ ...primero, sucursalId: primero.sucursalId || null });
    return `${d.empresa} · ${d.planta}${accesos.length > 1 ? ` y ${accesos.length - 1} más` : ''}`;
  });
  protected readonly resumenPermisos = computed(() => {
    const { agregados, quitados } = this.ajustes();
    if (!agregados.length && !quitados.length) return 'Los de su rol';
    return [
      agregados.length ? `${agregados.length} agregados` : '',
      quitados.length ? `${quitados.length} quitados` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  /** Lo que da su rol. */
  protected readonly delRol = computed(() =>
    this.acceso.permisosDeRoles([this.modelo().rolId].filter(Boolean)),
  );
  private ajustesIniciales_ = '';

  private readonly botonAgregar = viewChild<ElementRef<HTMLButtonElement>>('botonAgregar');
  private inicial = '';
  readonly sinGuardar = computed(
    () =>
      JSON.stringify(this.modelo()) !== this.inicial ||
      JSON.stringify(this.ajustes()) !== this.ajustesIniciales_,
  );

  ngOnInit(): void {
    const u = this.u();
    const iniciales = this.accesosIniciales();
    const accesos = iniciales.map((a) => ({
      empresaId: a.empresaId,
      sucursalId: a.sucursalId ?? '',
      predeterminado: a.predeterminado,
    }));
    const rolId = u?.rolId ?? '';
    this.ajustes.set(this.ajustesIniciales());
    this.ajustesIniciales_ = JSON.stringify(this.ajustes());
    this.modelo.set({
      correo: u?.correo ?? '',
      nombre: u?.nombre ?? '',
      apellidos: u?.apellidos ?? '',
      telefono: u?.telefono ?? '',
      puesto: u?.puesto ?? '',
      password: '',
      rolId,
      // Un alta empieza con un acceso a la primera empresa (la mayoría solo tiene una)
      accesos: accesos.length ? accesos : [this.accesoNuevo(true)],
    });
    this.inicial = JSON.stringify(this.modelo());
    this.enfocar('#usuario-nombre');
  }

  private accesoNuevo(predeterminado: boolean): AccesoForm {
    const empresas = this.acceso.empresas();
    return {
      empresaId: empresas.length === 1 ? empresas[0].id : '',
      sucursalId: '',
      predeterminado,
    };
  }

  protected predeterminar(i: number): void {
    this.modelo.update((m) => ({
      ...m,
      accesos: m.accesos.map((a, j) => ({ ...a, predeterminado: j === i })),
    }));
  }

  protected agregar(): void {
    const n = this.modelo().accesos.length;
    this.modelo.update((m) => ({ ...m, accesos: [...m.accesos, this.accesoNuevo(n === 0)] }));
    this.enfocar(`#acceso-${n}-empresa`);
  }

  /** Si se quita el predeterminado, el primero que quede pasa a serlo. */
  protected quitar(i: number): void {
    this.modelo.update((m) => {
      const resto = m.accesos.filter((_, j) => j !== i);
      if (resto.length && !resto.some((a) => a.predeterminado))
        resto[0] = { ...resto[0], predeterminado: true };
      return { ...m, accesos: resto };
    });
    afterNextRender(() => this.botonAgregar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      const m = this.modelo();
      this.listo.emit({
        datos: {
          correo: m.correo.trim().toLowerCase(),
          nombre: m.nombre.trim(),
          apellidos: m.apellidos.trim() || null,
          telefono: m.telefono.replace(/\D/g, '') || null,
          puesto: m.puesto.trim() || null,
          rolId: m.rolId,
        },
        accesos: m.accesos.map((a) => ({ ...a, sucursalId: a.sucursalId || null })),
        password: m.password || null,
        ajustes: this.ajustes(),
      });
      return undefined;
    });
    if (!valido) {
      // Un campo con error puede estar en una sección plegada: se abren para llegar a él
      document
        .querySelectorAll<HTMLDetailsElement>('#form-usuario details')
        .forEach((d) => (d.open = true));
      this.enfocar('#form-usuario [aria-invalid="true"]');
    }
  }

  private enfocar(selector: string): void {
    afterNextRender(() => document.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
