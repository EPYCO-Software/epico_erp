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
import { RouterLink } from '@angular/router';
import { Mail, MapPin, Maximize2, MonitorCheck, PencilLine, Phone, X } from 'lucide';
import { Cliente, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, pesos } from 'ui';
import { HistorialService } from '../../core/historial';
import { CambiosCliente, ESTADOS_COTIZACION, VentasService, registro, telefono } from './datos';
import { EditorCliente } from './editor-cliente';

/**
 * Un cliente con lo mismo que captura en el portal: su contacto y su empresa (Mi perfil), sus receptores fiscales
 * (Facturación) y sus obras; además, por separado, sus cotizaciones y sus pedidos, cada uno con enlace y del editado más
 * recientemente al más antiguo. Igual en la vista previa de Clientes y en su vista completa (dos columnas). Editar
 * cambia los datos por editor-cliente.ts.
 */
@Component({
  selector: 'app-detalle-cliente',
  imports: [EditorCliente, EstadoPedidoEtiqueta, FechaZonaPipe, Icon, RouterLink],
  template: `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        @if (completa()) {
          <h1 class="text-2xl font-bold tracking-[-0.02em]">{{ c().nombre }}</h1>
        } @else {
          <h2 id="previa-titulo" tabindex="-1" class="text-lg font-bold outline-none">{{ c().nombre }}</h2>
        }
        <p class="text-sm text-texto-suave">{{ c().empresa.razonSocial }} · RFC {{ c().empresa.rfc }}</p>
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

    @if (!editando()) {
      <button #botonEditar type="button" [class]="botonSecundario + ' mt-3'" (click)="editar()">
        <ui-icon [icono]="iconos.editar" [tamano]="16" />Editar
      </button>
    }
    <p class="mt-2 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>

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
            <p class="text-texto-suave">{{ c().empresa.razonSocial }}: sin más datos de empresa.</p>
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
                <p class="flex items-center gap-1.5 font-semibold">
                  <ui-icon [icono]="iconos.obra" [tamano]="15" class="text-epico" />{{ o.nombre }}
                </p>
                <p class="text-texto-suave">{{ o.direccion }}, {{ o.municipio }}</p>
                <p class="mt-1">Responsable: {{ o.responsable.nombre }}</p>
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
        </section>

        <!-- Cotizaciones y pedidos por separado, del editado más recientemente al más antiguo -->
        <section>
          <p role="heading" [attr.aria-level]="nivel()" [class]="titulo">Cotizaciones ({{ cotizaciones().length }})</p>
          <ul [class]="lista">
            @for (x of cotizaciones(); track x.q.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <div class="min-w-0">
                  <a [routerLink]="['/ventas/cotizaciones', x.q.id]" [class]="enlace + ' font-semibold'">{{ x.q.folio }}</a>
                  <p class="text-xs text-texto-suave">Editada {{ x.editada | fechaZona: x.q.zonaHoraria }}</p>
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
                  <p class="text-xs text-texto-suave">Editado {{ x.editada | fechaZona: x.p.zonaHoraria }}</p>
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
  private readonly ventas = inject(VentasService);
  private readonly historial = inject(HistorialService);
  private readonly injector = inject(Injector);

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
  /** Los títulos de sección, un nivel debajo del título (h2 en el panel, h1 en la vista completa). */
  protected readonly nivel = computed(() => (this.completa() ? 2 : 3));

  // Al pasar a otro cliente (otra fila) se sale de la edición y se borra el aviso; guardar no los reinicia.
  private readonly id = computed(() => this.c().id);
  protected readonly editando = linkedSignal({ source: this.id, computation: () => false });
  protected readonly aviso = linkedSignal({ source: this.id, computation: () => '' });
  private readonly editor = viewChild(EditorCliente);
  private readonly botonEditar = viewChild<ElementRef<HTMLButtonElement>>('botonEditar');
  /** Cambios sin guardar en el editor: la lista pregunta antes de cambiar de fila o cerrar. */
  readonly sinGuardar = computed(() => this.editor()?.sinGuardar() ?? false);

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
      .map((q) => ({ q, editada: this.historial.ultimaEdicion(registro.cotizacion(q.id)) ?? q.fecha }))
      .sort((a, b) => Date.parse(b.editada) - Date.parse(a.editada)),
  );
  protected readonly pedidos = computed(() =>
    this.ventas
      .pedidos()
      .filter((p) => p.clienteId === this.c().id)
      .map((p) => ({ p, editada: this.historial.ultimaEdicion(registro.pedido(p.folio)) ?? p.fechaHoraEntrega }))
      .sort((a, b) => Date.parse(b.editada) - Date.parse(a.editada)),
  );

  protected editar(): void {
    this.aviso.set('');
    this.editando.set(true);
  }

  protected guardar(cambios: CambiosCliente): void {
    this.ventas.guardarCliente(this.c().id, cambios);
    this.terminar('Cambios guardados.');
  }

  /** Al salir de la edición el foco vuelve a "Editar". */
  protected terminar(aviso: string): void {
    this.editando.set(false);
    this.aviso.set(aviso);
    afterNextRender(() => this.botonEditar()?.nativeElement.focus(), { injector: this.injector });
  }
}
