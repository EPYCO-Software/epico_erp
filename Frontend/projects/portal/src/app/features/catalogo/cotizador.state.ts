import { Injectable, computed, inject, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { DisenoGuardado, EspecificacionConcreto, Maquinaria, Obra, PERSONALIZADO, RentaMaquinaria, ServicioObra, aIsoConOffset, avisos, buscarSolucion, colocacionParaServicios, deInputLocal, esNocturna, etiquetas, serviciosParaColocacion, validarEntrega } from 'ui';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { NuevaObra, ObrasService } from '../../core/services/obras.service';

export type Paso = 1 | 2 | 3 | 'enviar';
export const PASOS = ['Solución', 'Especificaciones', 'Servicios'] as const;

/** Estado de una página de cotización; lo comparten los pasos y el resumen (se provee en Catalogo). */
@Injectable()
export class CotizadorState {
  private readonly cotizacion = inject(CotizacionService);
  private readonly obrasService = inject(ObrasService);

  readonly paso = signal<Paso>(1);
  readonly pestana = signal<'soluciones' | 'disenos'>('soluciones');
  readonly solucionId = signal<string | null>(null);
  readonly solucion = computed(() => buscarSolucion(this.solucionId()));
  /** Nombre de la partida: el de la solución o el del diseño guardado que se usó. */
  readonly nombre = signal('');
  readonly especificacion = signal<EspecificacionConcreto>(PERSONALIZADO.sugerida);
  readonly servicios = signal<ServicioObra[]>([]);
  readonly faltaSolucion = signal(false);
  readonly maquinaria = signal<RentaMaquinaria[]>([]);
  /**
   * Obra de entrega de la partida en curso. Empieza vacía (el cliente debe elegirla) y después se conserva la
   * última elegida para el siguiente producto; si la cambia, se respeta.
   */
  readonly obraId = signal<string | null>(null);
  readonly obra = computed(() => this.obrasService.buscar(this.obraId()));
  readonly obras = this.obrasService.obras;
  readonly faltaObra = signal(false);
  /** "Renta de maquinaria" activada sin elegir ningún equipo. */
  readonly faltaMaquinaria = computed(() => this.servicios().includes('renta-maquinaria') && this.maquinaria().length === 0);
  readonly intentoAgregar = signal(false);

  /** Fecha de entrega en formato datetime-local. Se conserva para el siguiente producto, como la obra. */
  readonly entregaLocal = signal('');
  readonly errorEntrega = computed(() => validarEntrega(this.entregaLocal(), new Date()));
  readonly entregaNocturna = computed(() => {
    const d = deInputLocal(this.entregaLocal());
    return !!d && esNocturna(d);
  });
  /** El servicio nocturno lo agregó la fecha (no el cliente): se quita solo si la hora deja de ser nocturna. */
  private nocturnoAutomatico = false;
  /** Texto del botón principal (formulario, resumen y barra móvil): dice lo que realmente hará. */
  readonly textoAccion = computed(() =>
    ({ 1: 'Pasar a especificaciones', 2: 'Confirmar especificaciones', 3: 'Agregar a cotización', enviar: '' })[this.paso()],
  );
  /** Confirmación breve tras guardar o agregar (se anuncia a lectores de pantalla). */
  readonly mensaje = signal('');

  /** Si se viene a modificar una cotización guardada, se abre directo en su resumen. */
  constructor() {
    if (this.cotizacion.edicion()) this.paso.set('enviar');
  }

  readonly modelo = signal({ volumenM3: 10, nombreDiseno: '' });
  readonly f = form(this.modelo, (p) => {
    required(p.volumenM3, { message: 'Indica el volumen estimado.' });
    min(p.volumenM3, 1, { message: 'El volumen mínimo es 1 m³.' });
  });

  readonly etiquetas = computed(() => etiquetas(this.especificacion()));
  readonly avisos = computed(() => avisos(this.especificacion()));
  readonly disenos = this.cotizacion.disenos;
  readonly partidas = this.cotizacion.partidas;
  readonly volumenTotal = this.cotizacion.volumenTotal;
  readonly edicion = this.cotizacion.edicion;

  elegirSolucion(id: string): void {
    const s = buscarSolucion(id);
    if (!s) return;
    this.solucionId.set(s.id);
    this.nombre.set(s.nombre);
    this.especificacion.set(structuredClone(s.sugerida));
    this.servicios.set([...s.servicios]);
    this.maquinaria.set([]);
    this.nocturnoAutomatico = false;
    this.aplicarNocturno();
    this.faltaSolucion.set(false);
    this.mensaje.set('');
  }

  usarDiseno(d: DisenoGuardado): void {
    this.solucionId.set(d.solucionId);
    this.nombre.set(d.nombre);
    this.especificacion.set(structuredClone(d.especificacion));
    this.servicios.set(serviciosParaColocacion([], d.especificacion.colocacion));
    this.maquinaria.set([]);
    this.nocturnoAutomatico = false;
    this.aplicarNocturno();
    this.modelo.update((m) => ({ ...m, nombreDiseno: d.nombre }));
    this.mensaje.set('');
    this.paso.set(2);
  }

  actualizar(cambio: Partial<EspecificacionConcreto>): void {
    this.especificacion.update((e) => ({ ...e, ...cambio }));
    if (cambio.colocacion) this.servicios.update((s) => serviciosParaColocacion(s, cambio.colocacion!));
  }

  alternarServicio(id: ServicioObra): void {
    if (id === 'colado-nocturno' && this.entregaNocturna()) return; // obligatorio en horario nocturno
    if (id === 'colado-nocturno') this.nocturnoAutomatico = false;
    const s = this.servicios().includes(id) ? this.servicios().filter((x) => x !== id) : [...this.servicios(), id];
    this.servicios.set(s);
    if (!s.includes('renta-maquinaria')) this.maquinaria.set([]);
    this.especificacion.update((e) => ({ ...e, colocacion: colocacionParaServicios(s) }));
  }

  /**
   * Salto directo desde el indicador de pasos. Hacia atrás siempre; hacia adelante: sin solución elegida se
   * entra como "Configurar desde cero", y para llegar a Servicios se valida el volumen como en "Continuar".
   */
  async irA(destino: 1 | 2 | 3): Promise<void> {
    const actual = this.paso();
    if (actual === 'enviar' || destino <= actual) {
      this.paso.set(destino);
      return;
    }
    if (!this.solucion()) this.elegirSolucion(PERSONALIZADO.id);
    if (destino === 2) {
      this.paso.set(2);
      return;
    }
    this.paso.set(2);
    await this.siguiente();
  }

  definirEntrega(valor: string): void {
    this.entregaLocal.set(valor);
    this.aplicarNocturno();
  }

  /** Entregas de 18:00 a 07:00 son especiales: llevan el servicio nocturno de forma automática. */
  private aplicarNocturno(): void {
    const tiene = this.servicios().includes('colado-nocturno');
    if (this.entregaNocturna() && !tiene) {
      this.servicios.update((s) => [...s, 'colado-nocturno']);
      this.nocturnoAutomatico = true;
    } else if (!this.entregaNocturna() && tiene && this.nocturnoAutomatico) {
      this.servicios.update((s) => s.filter((x) => x !== 'colado-nocturno'));
      this.nocturnoAutomatico = false;
    }
  }

  alternarMaquinaria(tipo: Maquinaria): void {
    this.maquinaria.update((m) => (m.some((x) => x.tipo === tipo) ? m.filter((x) => x.tipo !== tipo) : [...m, { tipo, dias: 1 }]));
  }

  diasMaquinaria(tipo: Maquinaria, dias: number): void {
    const d = Math.min(30, Math.max(1, Math.round(dias) || 1));
    this.maquinaria.update((m) => m.map((x) => (x.tipo === tipo ? { ...x, dias: d } : x)));
  }

  elegirObra(id: string): void {
    this.obraId.set(id);
    this.faltaObra.set(false);
  }

  agregarObra(datos: NuevaObra): Obra {
    const obra = this.obrasService.agregar(datos);
    this.elegirObra(obra.id);
    return obra;
  }

  /** Avanza al siguiente paso validando el actual; en el último, agrega la partida. */
  async siguiente(): Promise<void> {
    const paso = this.paso();
    if (paso === 1) {
      if (!this.solucion()) {
        this.faltaSolucion.set(true);
        return;
      }
      this.paso.set(2);
    } else if (paso === 2) {
      await submit(this.f.volumenM3, async () => {
        this.paso.set(3);
        return undefined;
      });
      if (this.f.volumenM3().invalid()) document.getElementById('volumen')?.focus();
    } else if (paso === 3) {
      this.agregar();
    }
  }

  guardarDiseno(): void {
    const nombre = this.modelo().nombreDiseno.trim();
    const solucion = this.solucion();
    if (!nombre || !solucion) {
      document.getElementById('nombre-diseno')?.focus();
      this.mensaje.set('Escribe un nombre para guardar el diseño.');
      return;
    }
    this.cotizacion.guardarDiseno(nombre, solucion.id, this.especificacion());
    this.mensaje.set(`Diseño "${nombre}" guardado en Mis diseños.`);
  }

  agregar(): void {
    const solucion = this.solucion();
    if (!solucion) {
      this.paso.set(1);
      this.faltaSolucion.set(true);
      return;
    }
    if (this.f.volumenM3().invalid()) {
      this.paso.set(2);
      return;
    }
    const obraId = this.obraId();
    const entrega = deInputLocal(this.entregaLocal());
    const errorEntrega = validarEntrega(this.entregaLocal(), new Date());
    if (this.faltaMaquinaria() || errorEntrega || !obraId || !entrega) {
      this.intentoAgregar.set(true);
      this.faltaObra.set(!obraId);
      this.paso.set(3);
      // Llevar a la vista lo primero que falta, en el orden de la página.
      const id = this.faltaMaquinaria() ? 'paso-titulo' : errorEntrega ? 'entrega' : 'obra-titulo';
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    this.cotizacion.agregarPartida(this.nombre(), {
      solucionId: solucion.id,
      especificacion: this.especificacion(),
      volumenM3: this.modelo().volumenM3,
      servicios: this.servicios(),
      maquinaria: this.maquinaria(),
      obraId,
      entrega: aIsoConOffset(entrega),
    });
    this.mensaje.set(`${this.nombre()} agregado a tu cotización. Puedes agregar otro concreto o solicitar precios.`);
    this.solucionId.set(null);
    this.nombre.set('');
    this.servicios.set([]);
    this.maquinaria.set([]);
    this.intentoAgregar.set(false);
    this.nocturnoAutomatico = false;
    this.aplicarNocturno();
    this.modelo.set({ volumenM3: 10, nombreDiseno: '' });
    this.paso.set(1);
  }

  alternarFavorito(id: string): void {
    this.cotizacion.alternarFavorito(id);
  }

  quitarPartida(id: string): void {
    this.cotizacion.quitarPartida(id);
  }
}
