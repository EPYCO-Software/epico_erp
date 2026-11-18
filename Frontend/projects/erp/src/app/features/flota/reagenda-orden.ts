import { Component, ElementRef, computed, effect, inject, input, output, resource, signal, viewChild } from '@angular/core';
import { CalendarClock, X } from 'lucide';
import { FechaZonaPipe, Icon, PedidoVista, isoEnZona, offsetEn } from 'ui';
import { permisosSesion } from '../../core/permisos';
import { VentasService, mensajeDe } from '../ventas/datos';
import { fechaEntregaLarga } from '../ventas/confirmar-orden';
import { FlotaApi, ORIGEN_REAGENDA, ResultadoReagenda, SolicitudReagenda } from './flota-api';

type Modo = 'reagendar' | 'solicitar' | 'aceptar' | 'rechazar';
const TITULO: Record<Modo, string> = {
  reagendar: 'Reagendar la entrega',
  solicitar: 'Solicitar reagendar',
  aceptar: 'Aceptar el cambio de fecha',
  rechazar: 'Rechazar la solicitud',
};
const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim());

/**
 * Cambiar la fecha y hora de entrega de una orden, en la hora de su planta. "Reagendar" la cambia de una vez y avisa al
 * cliente por correo (si no tiene, pide a qué correo); "Solicitar reagendar" (planta o logística) deja la propuesta para
 * que Ventas la acepte (y entonces se avisa) o la rechace. Si alguna unidad asignada ya no cabe a la nueva hora, el
 * backend la quita y se dice cuál.
 */
@Component({
  selector: 'app-reagenda-orden',
  imports: [FechaZonaPipe, Icon],
  host: { class: 'block' },
  template: `
    <section aria-labelledby="reagenda-titulo" class="rounded-xl bg-white/70 p-3 text-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        @if (nivel() === 2) {
          <h2 id="reagenda-titulo" class="font-semibold">Fecha de entrega</h2>
        } @else {
          <h3 id="reagenda-titulo" class="font-semibold">Fecha de entrega</h3>
        }
        @if (cambiable()) {
          <div class="flex flex-wrap gap-2">
            @if (puede('ventas.pedidos.reagendar')) {
              <button type="button" [class]="boton" (click)="abrir('reagendar')">Reagendar</button>
            }
            @if (puede('operacion.reagenda.solicitar') && !pendiente()) {
              <button type="button" [class]="boton" (click)="abrir('solicitar')">Solicitar reagendar</button>
            }
          </div>
        }
      </div>
      <p class="mt-1 first-letter:uppercase">{{ larga(p().fechaHoraEntrega) }}</p>

      @if (pendiente(); as s) {
        <div class="mt-2 rounded-lg border border-[#E9C98B] bg-[#FBF0DD] px-3 py-2 text-[#5C3F0C]">
          <p class="font-semibold">
            {{ origen[s.origen] }} pide cambiarla a <span class="first-letter:uppercase">{{ larga(s.fechaPropuesta) }}</span>
          </p>
          <p>Motivo: {{ s.motivo }}</p>
          @if (puede('ventas.pedidos.reagendar')) {
            <div class="mt-2 flex flex-wrap gap-2">
              <button type="button" class="boton-primario h-8 w-auto px-3 text-xs" (click)="abrir('aceptar')">Aceptar y avisar al cliente</button>
              <button type="button" [class]="botonChico" (click)="abrir('rechazar')">Rechazar</button>
            </div>
          }
        </div>
      }
      @if (historial().length) {
        <details class="mt-2">
          <summary class="cursor-pointer text-texto-suave">Solicitudes anteriores ({{ historial().length }})</summary>
          <ul class="mt-1 grid gap-1">
            @for (s of historial(); track s.id) {
              <li class="text-texto-suave">
                {{ s.solicitadoEn | fechaZona: p().zonaHoraria : 'dd/MM HH:mm' }} · {{ origen[s.origen] }} pidió {{ s.fechaPropuesta | fechaZona: p().zonaHoraria }}
                · {{ s.estado === 'aceptada' ? 'Aceptada' : 'Rechazada' }}{{ s.notaResolucion ? ': ' + s.notaResolucion : '' }}
              </li>
            }
          </ul>
        </details>
      }
      <p class="mt-2 font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>
    </section>

    <dialog
      #dialogo
      aria-labelledby="reagenda-dialogo-titulo"
      class="glass-strong m-auto w-[min(34rem,calc(100%-2rem))] p-0 text-carbon backdrop:bg-carbon/25 backdrop:backdrop-blur-[2px] scroll-caja"
      (close)="modo.set(null)"
      (keydown.escape)="$event.stopPropagation()"
    >
      <form novalidate (submit)="enviar($event)">
        <div class="flex items-center justify-between gap-4 border-b border-acero/50 py-2.5 pr-2.5 pl-6">
          <h2 id="reagenda-dialogo-titulo" class="text-lg font-bold">{{ titulo() }} · {{ p().folio }}</h2>
          <button
            type="button"
            aria-label="Cerrar sin cambiar"
            class="flex size-11 items-center justify-center rounded-xl text-texto-suave transition-colors hover:bg-carbon/5 hover:text-carbon focus-visible:outline-2 focus-visible:outline-epico"
            (click)="modo.set(null)"
          >
            <ui-icon [icono]="iconos.cerrar" />
          </button>
        </div>
        <div class="grid gap-4 px-6 py-5">
          <p class="flex items-center gap-2 rounded-xl bg-white/85 px-4 py-3">
            <ui-icon [icono]="iconos.fecha" [tamano]="18" class="shrink-0 text-epico" />
            <span>Hoy: <span class="inline-block font-semibold first-letter:uppercase">{{ larga(p().fechaHoraEntrega) }}</span> · {{ p().obraNombre }}</span>
          </p>

          @if (modo() !== 'rechazar') {
            <div>
              <label for="reagenda-fecha" class="block text-sm font-bold">{{ modo() === 'solicitar' ? 'Fecha y hora propuesta' : 'Nueva fecha y hora' }} (hora de {{ p().plantaNombre }})</label>
              <input
                id="reagenda-fecha"
                type="datetime-local"
                class="campo mt-1 h-10 px-3"
                [attr.aria-invalid]="!!errorFecha()"
                aria-describedby="reagenda-fecha-error"
                [value]="fecha()"
                (input)="fecha.set($any($event.target).value)"
              />
              <p id="reagenda-fecha-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ errorFecha() }}</p>
            </div>
          }
          @if (modo() === 'reagendar' || modo() === 'solicitar') {
            <div>
              <label for="reagenda-motivo" class="block text-sm font-bold">Motivo</label>
              <input
                id="reagenda-motivo"
                class="campo mt-1 h-10 px-3"
                placeholder="Lluvia, unidad en taller, lo pidió el cliente…"
                [attr.aria-invalid]="intento() && !motivo().trim()"
                aria-describedby="reagenda-motivo-error"
                [value]="motivo()"
                (input)="motivo.set($any($event.target).value)"
              />
              <p id="reagenda-motivo-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !motivo().trim() ? 'Escribe el motivo.' : '' }}</p>
            </div>
          }
          @if (modo() === 'rechazar') {
            <div>
              <label for="reagenda-nota" class="block text-sm font-bold">Por qué se rechaza</label>
              <input
                id="reagenda-nota"
                class="campo mt-1 h-10 px-3"
                [attr.aria-invalid]="intento() && !motivo().trim()"
                aria-describedby="reagenda-nota-error"
                [value]="motivo()"
                (input)="motivo.set($any($event.target).value)"
              />
              <p id="reagenda-nota-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ intento() && !motivo().trim() ? 'Escribe el motivo.' : '' }}</p>
            </div>
          }
          @if (avisaCliente()) {
            @if (p().clienteTieneCorreo === false) {
              <div>
                <label for="reagenda-correo" class="block text-sm font-bold">Correo para avisar del cambio</label>
                <input
                  id="reagenda-correo"
                  type="email"
                  class="campo mt-1 h-10 px-3"
                  autocomplete="email"
                  [attr.aria-invalid]="!!errorCorreo()"
                  aria-describedby="reagenda-correo-nota reagenda-correo-error"
                  [value]="correo()"
                  (input)="correo.set($any($event.target).value)"
                />
                <p id="reagenda-correo-nota" class="mt-1 text-xs text-texto-suave">{{ p().clienteNombre }} no tiene correo registrado: el aviso es obligatorio.</p>
                <p id="reagenda-correo-error" class="mt-1 text-sm font-medium text-critico empty:hidden">{{ errorCorreo() }}</p>
              </div>
            } @else {
              <p class="rounded-lg bg-[#E6F0F4] px-3 py-2 text-sm text-[#24485A]">
                Se avisa a {{ p().clienteNombre }} por correo{{ correoCliente() ? ' (' + correoCliente() + ')' : '' }} y en su portal. Las unidades ya asignadas
                que no quepan a la nueva hora se quitan.
              </p>
            }
          } @else if (modo() === 'solicitar') {
            <p class="rounded-lg bg-[#E6F0F4] px-3 py-2 text-sm text-[#24485A]">Ventas la revisa; al aceptarla se avisa al cliente.</p>
          }
          <p class="text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
        </div>
        <div class="flex flex-wrap gap-3 border-t border-acero/50 px-6 py-4">
          <button type="submit" [class]="modo() === 'rechazar' ? botonGrande : 'boton-primario h-11 w-auto px-5'" [disabled]="ocupado()">{{ accion() }}</button>
          <button type="button" [class]="botonGrande" (click)="modo.set(null)">Cancelar</button>
        </div>
      </form>
    </dialog>
  `,
})
export class ReagendaOrden {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  private readonly ventas = inject(VentasService);

  readonly p = input.required<PedidoVista>();
  readonly nivel = input<2 | 3>(3);
  /** Tras reagendar, aceptar o rechazar (quien lo usa recarga lo suyo: viajes, tablero…). */
  readonly cambio = output<void>();

  protected readonly iconos = { cerrar: X, fecha: CalendarClock };
  protected readonly origen = ORIGEN_REAGENDA;
  protected readonly boton =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-3 text-xs font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonChico = this.boton;
  protected readonly botonGrande =
    'inline-flex h-11 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  /** Ya en camino, entregada o cancelada: la fecha no se mueve. */
  protected readonly cambiable = computed(() => ['programado', 'en_planta'].includes(this.p().estado));
  protected larga(iso: string): string {
    return fechaEntregaLarga(iso, this.p().zonaHoraria);
  }
  protected readonly correoCliente = computed(() => this.ventas.cliente(this.p().clienteId)?.contacto.correo || '');

  private readonly solicitudesRes = resource({
    params: () => ({ id: this.p().id, marca: this.p().reagendaPendiente?.id ?? '' }),
    loader: ({ params }) => this.api.solicitudes(params.id).catch(() => [] as SolicitudReagenda[]),
  });
  private readonly solicitudes = computed(() => (this.solicitudesRes.hasValue() ? this.solicitudesRes.value() : []));
  protected readonly pendiente = computed(() => this.p().reagendaPendiente ?? this.solicitudes().find((s) => s.estado === 'pendiente') ?? null);
  protected readonly historial = computed(() => this.solicitudes().filter((s) => s.estado !== 'pendiente'));

  // ---------- Diálogo ----------
  protected readonly modo = signal<Modo | null>(null);
  protected readonly fecha = signal('');
  protected readonly motivo = signal('');
  protected readonly correo = signal('');
  protected readonly intento = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly titulo = computed(() => (this.modo() ? TITULO[this.modo()!] : ''));
  protected readonly avisaCliente = computed(() => this.modo() === 'reagendar' || this.modo() === 'aceptar');
  protected readonly accion = computed(
    () => ({ reagendar: 'Reagendar y avisar', solicitar: 'Enviar solicitud', aceptar: 'Aceptar y avisar', rechazar: 'Rechazar solicitud' })[this.modo() ?? 'reagendar'],
  );
  protected readonly errorFecha = computed(() => {
    if (!this.intento() || this.modo() === 'rechazar') return '';
    if (!this.fecha()) return 'Elige la fecha y hora.';
    if (Date.parse(this.aUtc(this.fecha())) <= Date.now()) return 'Esa fecha ya pasó.';
    return '';
  });
  protected readonly errorCorreo = computed(() => {
    if (!this.intento() || !this.avisaCliente() || this.p().clienteTieneCorreo !== false) return '';
    return correoValido(this.correo()) ? '' : 'Escribe un correo válido para avisar al cliente.';
  });

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.modo() && !d.open) d.showModal();
      else if (!this.modo() && d.open) d.close();
    });
  }

  /** "YYYY-MM-DDTHH:mm" en la hora de la planta → ISO UTC. */
  private aUtc(local: string): string {
    return new Date(`${local}:00${offsetEn(this.p().zonaHoraria, new Date(local))}`).toISOString();
  }
  private aLocal(iso: string): string {
    return isoEnZona(this.p().zonaHoraria, new Date(iso)).slice(0, 16);
  }

  protected abrir(m: Modo): void {
    this.intento.set(false);
    this.error.set('');
    this.aviso.set('');
    this.motivo.set('');
    this.correo.set('');
    const s = this.pendiente();
    this.fecha.set(m === 'aceptar' && s ? this.aLocal(s.fechaPropuesta) : this.aLocal(this.p().fechaHoraEntrega));
    this.modo.set(m);
  }

  protected async enviar(e: Event): Promise<void> {
    e.preventDefault();
    this.intento.set(true);
    const m = this.modo();
    if (!m || this.errorFecha() || this.errorCorreo() || ((m === 'reagendar' || m === 'solicitar' || m === 'rechazar') && !this.motivo().trim())) return;
    const correo = this.p().clienteTieneCorreo === false ? this.correo().trim() : null;
    this.ocupado.set(true);
    this.error.set('');
    try {
      let texto = '';
      if (m === 'reagendar') {
        const r = await this.api.reagendar(this.p().id, { fechaHoraEntrega: this.aUtc(this.fecha()), motivo: this.motivo().trim(), correo });
        texto = this.textoResultado('Entrega reagendada', r);
      } else if (m === 'solicitar') {
        await this.api.solicitar(this.p().id, { fechaPropuesta: this.aUtc(this.fecha()), motivo: this.motivo().trim() });
        texto = 'Solicitud enviada a Ventas.';
      } else if (m === 'aceptar') {
        const r = await this.api.aceptar(this.pendiente()!.id, { correo, fechaHoraEntrega: this.aUtc(this.fecha()) });
        texto = this.textoResultado('Cambio aceptado', r);
      } else {
        await this.api.rechazar(this.pendiente()!.id, this.motivo().trim());
        texto = 'Solicitud rechazada.';
      }
      this.modo.set(null);
      await this.ventas.refrescarPedido(this.p().id).catch(() => undefined);
      this.solicitudesRes.reload();
      this.aviso.set(texto);
      this.cambio.emit();
    } catch (err) {
      this.error.set(mensajeDe(err));
    } finally {
      this.ocupado.set(false);
    }
  }

  private textoResultado(inicio: string, r: ResultadoReagenda): string {
    const avisado = r.notificadoA?.length ? ` Se avisó a ${r.notificadoA.join(', ')}.` : '';
    const quitados = r.quitados?.length ? ` Ya no cabían y se quitaron: ${r.quitados.join(', ')}.` : '';
    return `${inicio}.${avisado}${quitados}`;
  }
}
