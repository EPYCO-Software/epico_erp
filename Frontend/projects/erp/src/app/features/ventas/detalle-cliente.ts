import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Mail, MapPin, Maximize2, MonitorCheck, PencilLine, Phone, Trash2, X } from 'lucide';
import { AuthService, Cliente, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, pesos } from 'ui';
import { TODOS, tiene } from '../../core/permisos';
import { HistorialService } from '../../core/historial';
import { CambiosCliente, ESTADOS_COTIZACION, VentasService, mensajeDe, registro, telefono } from './datos';
import { CreditoCliente } from './credito-cliente';
import { CuentaPortalCliente } from './cuenta-portal';
import { EditorCliente } from './editor-cliente';

/**
 * Un cliente con lo mismo que captura en el portal: su contacto y su empresa (Mi perfil), sus receptores fiscales
 * (Facturación) y sus obras; además, por separado, sus cotizaciones y sus pedidos, cada uno con enlace y del editado más
 * recientemente al más antiguo. Igual en la vista previa de Clientes y en su vista completa (dos columnas). Editar
 * cambia los datos por editor-cliente.ts.
 */
@Component({
  selector: 'app-detalle-cliente',
  // Bloque: un host en línea con bloques adentro hace que el navegador lo ponga encima de sus botones al apuntar.
  host: { class: 'block' },
  imports: [CreditoCliente, CuentaPortalCliente, EditorCliente, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, RouterLink],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ c().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ c().nombre }}</h2>
        }
        @if (subtitulo()) {
          <p class="text-sm text-texto-suave">{{ subtitulo() }}</p>
        }
        @if (c().portal) {
          <p class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#E5F0EA] px-2 py-0.5 text-sm font-semibold text-[#2E5E4A]">
            <ui-icon [icono]="iconos.portal" [tamano]="15" />Conectado al portal
          </p>
        } @else {
          <p class="mt-2 inline-flex rounded-md bg-carbon/6 px-2 py-0.5 text-sm font-semibold text-texto-suave">
            Sin cuenta en el portal
          </p>
        }
      </div>
      @if (!completa()) {
        <div class="-mt-1 -mr-1 flex shrink-0">
          <a
            [routerLink]="['/ventas/clientes', c().id]"
            aria-label="Abrir en vista completa"
            title="Abrir en vista completa"
            [class]="botonIcono"
          >
            <ui-icon [icono]="iconos.completa" [tamano]="17" />
          </a>
          <button type="button" aria-label="Cerrar vista previa" [class]="botonIcono" (click)="cerrar.emit()">
            <ui-icon [icono]="iconos.cerrar" [tamano]="18" />
          </button>
        </div>
      }
    </div>

    @if (!editando() && (puedeEditar() || puedeEliminar())) {
      <div class="mt-3 flex flex-wrap gap-2">
        @if (puedeEditar()) {
          <button #botonEditar type="button" [class]="botonSecundario" (click)="editar()">
            <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
          </button>
        }
        @if (puedeEliminar()) {
          <button
            type="button"
            [class]="botonSecundario + ' disabled:cursor-not-allowed disabled:opacity-50'"
            [disabled]="!!enUso()"
            [attr.aria-describedby]="enUso() ? 'cliente-en-uso' : null"
            (click)="eliminar()"
          >
            <ui-icon [icono]="iconos.eliminar" [tamano]="16" />Eliminar
          </button>
        }
      </div>
      @if (puedeEliminar() && enUso()) {
        <p id="cliente-en-uso" class="mt-1 text-xs text-texto-suave">No se puede eliminar: {{ enUso() }}.</p>
      }
    }
    <p class="mt-2 text-sm font-medium empty:hidden" [class]="error() ? 'text-[#8E332C]' : 'text-[#2E5E4A]'" aria-live="polite">{{ aviso() }}</p>

    @if (editando()) {
      <app-editor-cliente class="mt-4 border-t border-acero/60 pt-4" [c]="c()" (listo)="guardar($event)" (descartar)="terminar('')" />
    } @else {
      <div class="mt-4 grid gap-5 text-sm" [class]="completa() ? 'lg:grid-cols-2 lg:gap-x-10' : ''">
        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Contacto</p>
          @if (c().contacto.nombre || c().contacto.correo) {
            <p class="font-semibold">{{ c().contacto.nombre }} {{ c().contacto.apellidos }}</p>
            @if (c().contacto.puesto) {
              <p class="text-texto-suave">{{ c().contacto.puesto }}</p>
            }
            <p class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              @if (c().contacto.correo) {
                <a [href]="'mailto:' + c().contacto.correo" [class]="enlace">
                  <ui-icon [icono]="iconos.correo" [tamano]="15" />{{ c().contacto.correo }}
                </a>
              }
              @if (c().contacto.telefono) {
                <a [href]="'tel:' + c().contacto.telefono" [class]="enlace">
                  <ui-icon [icono]="iconos.telefono" [tamano]="15" />{{ telefono(c().contacto.telefono) }}
                </a>
              }
            </p>
          } @else {
            <p class="text-texto-suave">Sin contacto registrado (venta de mostrador).</p>
          }
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Empresa</p>
          @if (empresa().length) {
            <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
              @for (d of empresa(); track d.etiqueta) {
                <dt class="text-texto-suave">{{ d.etiqueta }}</dt>
                <dd>{{ d.valor }}</dd>
              }
            </dl>
          } @else {
            <p class="text-texto-suave">{{ c().empresa.razonSocial ? c().empresa.razonSocial + ": sin" : "Sin" }} más datos de empresa.</p>
          }
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Facturación</p>
          <ul class="space-y-2">
            @for (f of facturacion(); track f.id) {
              <li class="rounded-xl bg-white/80 p-3">
                <p class="flex flex-wrap items-center gap-2 font-semibold">
                  {{ f.alias }}
                  @if (f.predeterminado) {
                    <span class="rounded-md bg-carbon/6 px-1.5 py-0.5 text-xs font-semibold text-texto-suave">Predeterminado</span>
                  }
                </p>
                <dl class="mt-1 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                  @for (d of f.datos; track d.etiqueta) {
                    <dt class="text-texto-suave">{{ d.etiqueta }}</dt>
                    <dd>{{ d.valor }}</dd>
                  }
                </dl>
              </li>
            } @empty {
              <li class="text-texto-suave">Sin datos de facturación.</li>
            }
          </ul>
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Obras ({{ obras().length }})</p>
          <ul class="space-y-2">
            @for (o of obras(); track o.id) {
              <li class="rounded-xl bg-white/80 p-3">
                <a [routerLink]="['/ventas/obras', o.id]" class="flex items-center gap-1.5 font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-epico">
                  <ui-icon [icono]="iconos.obra" [tamano]="15" class="text-epico" />{{ o.nombre }}
                </a>
                <p class="text-texto-suave">{{ lugar(o) }}</p>
                @if (o.responsable.nombre) {
                  <p class="mt-1">Responsable: {{ o.responsable.nombre }}</p>
                }
                @for (k of o.contactos; track $index) {
                  <p class="text-texto-suave">
                    {{ k.nombre }} ·
                    <a [href]="'tel:' + k.lada + k.numero" [class]="enlace">{{ telefono(k.numero, k.lada) }}</a>
                  </p>
                }
              </li>
            } @empty {
              <li class="text-texto-suave">Sin obras registradas.</li>
            }
          </ul>
          @if (puedeCrearObra()) {
            <a [routerLink]="['/ventas/obras/nueva']" [queryParams]="{ cliente: c().id }" [class]="enlace + ' mt-2 font-semibold text-epico-oscuro'">
              <ui-icon [icono]="iconos.obra" [tamano]="15" />Agregar obra
            </a>
          }
        </section>

        @if (!ventas.esPublico(c().id)) {
          <app-credito-cliente [c]="c()" [nivel]="nivel()" />
        }

        @if (ventas.conBackend && (puedeEditar() || puedeCrear()) && !ventas.esPublico(c().id)) {
          <app-cuenta-portal [c]="c()" [nivel]="nivel()" />
        }

        <!-- Cotizaciones y pedidos por separado, del editado más recientemente al más antiguo -->
        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Cotizaciones ({{ cotizaciones().length }})</p>
          <ul [class]="lista">
            @for (x of cotizaciones(); track x.q.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <div class="min-w-0">
                  <a [routerLink]="['/ventas/cotizaciones', x.q.id]" [class]="enlace + ' font-semibold'">{{ x.q.folio }}</a>
                  <p class="text-xs text-texto-suave">{{ x.editadaEn ? 'Editada' : 'Creada' }} {{ x.fecha | fechaZona: x.q.zonaHoraria }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <span class="inline-block rounded-md px-2 py-0.5 text-xs font-bold {{ estados[x.q.estado].clase }}">{{
                    estados[x.q.estado].nombre
                  }}</span>
                  <p class="mt-0.5 text-xs tabular-nums">\${{ pesos(x.q.total) }}</p>
                </div>
              </li>
            } @empty {
              <li class="px-3 py-2 text-texto-suave">Aún sin cotizaciones.</li>
            }
          </ul>
        </section>

        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Pedidos ({{ pedidos().length }})</p>
          <ul [class]="lista">
            @for (x of pedidos(); track x.p.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <div class="min-w-0">
                  <a [routerLink]="['/ventas/ordenes', x.p.folio]" [class]="enlace + ' font-semibold'">{{ x.p.folio }}</a>
                  <p class="text-xs text-texto-suave">{{ x.editadoEn ? 'Editado' : 'Entrega' }} {{ x.fecha | fechaZona: x.p.zonaHoraria }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <ui-estado-pedido [estado]="x.p.estado" />
                  <p class="mt-0.5 text-xs tabular-nums">\${{ pesos(x.p.importe) }}</p>
                </div>
              </li>
            } @empty {
              <li class="px-3 py-2 text-texto-suave">Aún sin pedidos.</li>
            }
          </ul>
        </section>
      </div>
    }
  `,
})
export class DetalleCliente {
  protected readonly ventas = inject(VentasService);
  private readonly auth = inject(AuthService);
  private readonly historial = inject(HistorialService);
  private readonly injector = inject(Injector);

  private readonly router = inject(Router);
  readonly c = input.required<Cliente>();
  readonly vista = input<'panel' | 'completa'>('panel');
  readonly cerrar = output();

  protected readonly iconos = {
    cerrar: X,
    completa: Maximize2,
    portal: MonitorCheck,
    correo: Mail,
    telefono: Phone,
    obra: MapPin,
    editar: PencilLine,
    eliminar: Trash2,
  };
  protected readonly botonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly enlace =
    'inline-flex items-center gap-1.5 rounded underline-offset-4 hover:text-epico hover:underline focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly lista = 'divide-y divide-acero/40 rounded-xl bg-white/80';
  protected readonly telefono = telefono;
  protected readonly pesos = pesos;
  protected readonly estados = ESTADOS_COTIZACION;

  protected readonly completa = computed(() => this.vista() === 'completa');
  /** Sin el permiso de editar clientes (su rol o un quitado) no se ofrece: el backend lo rechazaría. */
  protected readonly puedeEditar = computed(() => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.clientes.editar'));
  /** "Dirección, Municipio" con lo que tenga. */
  protected lugar(o: { direccion: string; municipio: string }): string {
    return [o.direccion, o.municipio].filter(Boolean).join(', ');
  }
  protected readonly puedeEliminar = computed(
    () => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.clientes.eliminar') && !this.ventas.esPublico(this.c().id),
  );
  /** Por qué no se puede eliminar (lo que lo usa), o '' si se puede. */
  protected readonly enUso = computed(() =>
    [
      this.cotizaciones().length ? 'tiene cotizaciones' : '',
      this.pedidos().length ? 'tiene órdenes' : '',
      this.obras().length ? 'tiene obras' : '',
    ]
      .filter(Boolean)
      .join(', '),
  );
  protected async eliminar(): Promise<void> {
    if (!confirm(`¿Eliminar el cliente "${this.c().nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.ventas.eliminarCliente(this.c().id);
      if (this.completa()) void this.router.navigateByUrl('/ventas/clientes');
      else this.cerrar.emit();
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    }
  }
  /** Quien da de alta clientes también les crea su cuenta del portal (solo portal; reenviar o desactivar pide editar). */
  protected readonly puedeCrear = computed(() => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.clientes.crear'));
  protected readonly puedeCrearObra = computed(() => tiene(this.auth.sesion()?.permisos ?? [TODOS], 'ventas.obras.crear'));
  /** Los títulos de sección, un nivel debajo del título (h2 en el panel, h1 en la vista completa). */
  protected readonly nivel = computed(() => (this.completa() ? 2 : 3));

  // Al pasar a otro cliente (otra fila) se sale de la edición y se borra el aviso; guardar no los reinicia.
  private readonly id = computed(() => this.c().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  protected readonly error = linkedSignal({ source: this.id, computation: () => false });
  /** Para la lista y la vista completa: preguntar antes de dejarlo mientras se edita. */
  readonly enEdicion = this.editando.asReadonly();
  private readonly editor = viewChild(EditorCliente);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

  /** "Razón social · RFC …", solo con lo que tenga (el de contado puede no tener ninguno). */
  protected readonly subtitulo = computed(() => {
    const e = this.c().empresa;
    return [e.razonSocial, e.rfc && `RFC ${e.rfc}`].filter(Boolean).join(' · ');
  });

  /** Solo lo que tiene valor (el de mostrador casi no tiene datos). */
  protected readonly empresa = computed(() => {
    const e = this.c().empresa;
    return [
      { etiqueta: 'Giro', valor: e.giro },
      { etiqueta: 'Correo', valor: e.correo },
      { etiqueta: 'Teléfono', valor: e.telefono && telefono(e.telefono) },
      { etiqueta: 'Sitio web', valor: e.sitioWeb },
      { etiqueta: 'Domicilio fiscal', valor: e.domicilioFiscal },
    ].filter((d) => d.valor);
  });
  protected readonly facturacion = computed(() =>
    this.c().facturacion.map((f) => ({
      ...f,
      datos: [
        { etiqueta: 'Razón social', valor: f.razonSocial },
        { etiqueta: 'RFC', valor: f.rfc },
        { etiqueta: 'Régimen fiscal', valor: f.regimenFiscal },
        { etiqueta: 'Uso de CFDI', valor: f.usoCfdi },
        { etiqueta: 'Código postal', valor: f.codigoPostal },
        { etiqueta: 'Correo', valor: f.correo },
        { etiqueta: 'Dirección fiscal', valor: f.direccionFiscal },
      ].filter((d) => d.valor),
    })),
  );
  protected readonly obras = computed(() => this.ventas.obras().filter((o) => o.clienteId === this.c().id));

  /** Su fecha de edición es lo último de su historial que no sea nota ni actividad. */
  protected readonly cotizaciones = computed(() =>
    this.ventas
      .cotizaciones()
      .filter((q) => q.clienteId === this.c().id)
      .map((q) => {
        const editadaEn = this.historial.ultimaEdicion(registro.cotizacion(q.id));
        return { q, editadaEn, fecha: editadaEn ?? q.fecha };
      })
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)),
  );
  protected readonly pedidos = computed(() =>
    this.ventas
      .pedidos()
      .filter((p) => p.clienteId === this.c().id)
      .map((p) => {
        const editadoEn = this.historial.ultimaEdicion(registro.pedido(p.folio));
        return { p, editadoEn, fecha: editadoEn ?? p.fechaHoraEntrega };
      })
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)),
  );

  protected editar(): void {
    this.aviso.set('');
    this.error.set(false);
    this.editando.set(true);
  }

  protected async guardar(cambios: CambiosCliente): Promise<void> {
    try {
      await this.ventas.guardarCliente(this.c().id, cambios);
      this.terminar('Cambios guardados.');
    } catch (e) {
      this.aviso.set(mensajeDe(e));
      this.error.set(true);
    }
  }

  /** Al salir de la edición el foco vuelve a "Editar". */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    this.error.set(false);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }
}
