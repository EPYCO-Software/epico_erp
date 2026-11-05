import { Component, Injector, afterNextRender, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CdkMenu, CdkMenuItemRadio, CdkMenuTrigger } from '@angular/cdk/menu';
import { Router } from '@angular/router';
import { FormField, applyEach, email, form, max, min, required, submit, validate } from '@angular/forms/signals';
import { Check, ChevronDown, Download, LoaderCircle, MapPin, Plus, Save, Trash2 } from 'lucide';
import {
  ADITIVOS,
  Aditivo,
  AuthService,
  EXPOSICIONES,
  EspecificacionConcreto,
  FieldError,
  Icon,
  OPCIONES,
  PERSONALIZADO,
  PartidaCotizacion,
  SERVICIOS,
  SOLUCIONES,
  ServicioObra,
  avisos,
  buscarSolucion,
  colocacionParaServicios,
  deInputLocal,
  descargarCotizacionPdf,
  esNocturna,
  kmExtra,
  lineasPartida,
  pesos,
  precioConcreto,
  totales,
  totalesCotizacion,
} from 'ui';
import { PlantasService } from '../../core/plantas';
import { EnEncabezado } from '../../layout/barra-encabezado';
import { COLUMNA } from '../../layout/panel-lateral';
import { CAJAS_VISTA, RutaNavegacion } from '../../layout/vista-completa';
import { FuenteDistancia, distanciaDeManejo } from './distancia';
import { ElegirUbicacion, UbicacionElegida } from './elegir-ubicacion';
import { PLANTAS_ERP, PUBLICO_GENERAL, VentasService, isoEnZona, offsetEn, plantaDeMunicipio, siguienteFolio } from './datos';

type Accion = 'guardar' | 'guardar-descargar' | 'descargar' | 'orden' | 'orden-cotizacion';

/** Un producto mientras se captura. */
interface Producto {
  id: string;
  solucionId: string;
  nombre: string;
  obraId: string;
  /** datetime-local, en la hora de la planta. */
  entrega: string;
  volumen: number | null;
  especificacion: EspecificacionConcreto;
  /** Los que eligió quien cotiza; el colado nocturno lo agrega solo la hora de entrega (serviciosDe). */
  servicios: ServicioObra[];
  /** Precio especial del concreto por m³; vacío, el del tarifario. */
  precio: number | null;
  /** Km de la planta a la obra: calculados si la obra tiene punto en el mapa, o escritos por quien cotiza. */
  distancia: number | null;
  fuenteDistancia: FuenteDistancia | null;
  /** Planta|obra de la distancia calculada: si cambia, se vuelve a calcular. */
  claveDistancia: string;
}

interface Borrador {
  clienteId: string;
  plantaId: string;
  productos: Producto[];
  descuento: number | null;
  /** Para todos los productos: km incluidos en el precio y cuánto cuesta cada km adicional por m³. */
  traslado: { incluidosKm: number | null; precioKm: number | null };
}

// shortcut: tarifa de ejemplo (20 km, como dice el PDF); con backend, la de la configuración de la concretera.
const TRASLADO = { incluidosKm: 20, precioKm: 12 };

const diezDigitos = ({ value }: { value: () => string }) =>
  !value() || /^\d{10}$/.test(value().replace(/\D/g, '')) ? undefined : { kind: 'telefono', message: 'El teléfono lleva 10 dígitos.' };

/** Como en el portal: entregas de 18:00 a 06:59 llevan colado nocturno. */
const nocturna = (p: Producto) => {
  const d = deInputLocal(p.entrega);
  return !!d && esNocturna(d);
};
const serviciosDe = (p: Producto): ServicioObra[] =>
  nocturna(p) && !p.servicios.includes('colado-nocturno') ? [...p.servicios, 'colado-nocturno'] : p.servicios;

/** El producto como partida de la cotización: la colocación sale de los servicios (bomba = bombeo), como en el portal. */
function partidaDe(p: Producto, offset: string, t: Borrador['traslado']): PartidaCotizacion {
  const servicios = serviciosDe(p);
  const partida: PartidaCotizacion = {
    id: p.id,
    nombre: p.nombre.trim() || buscarSolucion(p.solucionId)?.nombre || 'Concreto',
    solucionId: p.solucionId,
    especificacion: { ...p.especificacion, colocacion: colocacionParaServicios(servicios) },
    volumenM3: p.volumen ?? 0,
    servicios,
    maquinaria: [],
    obraId: p.obraId,
    entrega: p.entrega ? `${p.entrega}:00${offset}` : '',
    // Con distancia, se guarda aunque esté dentro del radio (lineasPartida solo cobra lo que pasa de él).
    ...(p.distancia != null ? { traslado: { distanciaKm: p.distancia, incluidosKm: t.incluidosKm ?? 0, precioKm: t.precioKm ?? 0 } } : {}),
  };
  return p.precio && p.precio !== precioConcreto(partida) ? { ...partida, precioM3: p.precio } : partida;
}

function productoDe(solucionId: string, obraId: string, entrega: string): Producto {
  const s = buscarSolucion(solucionId) ?? PERSONALIZADO;
  return {
    id: crypto.randomUUID(),
    solucionId: s.id,
    nombre: s.nombre,
    obraId,
    entrega,
    volumen: null,
    especificacion: structuredClone(s.sugerida),
    servicios: [...s.servicios],
    precio: null,
    distancia: null,
    fuenteDistancia: null,
    claveDistancia: '',
  };
}

/**
 * Ventas → Cotizaciones → Nuevo (/ventas/cotizaciones/nueva) y, en modo "orden", Órdenes → Nuevo
 * (/ventas/ordenes/nueva: crear la orden de venta directo, con o sin su cotización de respaldo): el cotizador del portal en una sola hoja, para quien
 * cotiza todos los días. Sin pasos: cliente y planta arriba; cada producto con su solución (aplica la especificación
 * y los servicios sugeridos del portal), obra, entrega, volumen, especificación, servicios y precio especial; abajo
 * el resumen económico a la derecha (como en el portal), con el descuento, los totales y un botón dividido: Guardar
 * por omisión y, en su flecha, Guardar y descargar o Solo descargar (PDF sin guardar). Las recomendaciones técnicas del portal se ven en cada producto y se aplican con un
 * clic, pero no bloquean. "Guardar" la crea en borrador (VentasService.crear) y abre su vista completa para enviarla
 * o confirmarla. Con cambios sin guardar, salir pregunta.
 * Sin cliente en la lista: "Cliente nuevo" lo da de alta rápido (nombre, contacto, teléfono) o "Sin cliente" cotiza a
 * público en general. Si es sin cliente o el cliente no tiene obras, se pide el lugar de entrega (dirección,
 * municipio y quién recibe, con su teléfono): se guarda como obra y su municipio elige la planta que lo atiende.
 * Traslado: en el resumen, km incluidos y $ por km adicional (por m³); cada producto lleva su distancia desde la
 * planta, calculada por carretera si la obra tiene punto en el mapa (distancia.ts) o escrita por quien cotiza. Lo que
 * pase de los incluidos se vuelve la línea "Traslado adicional" (lineasPartida de ui): totales, PDF y pedidos.
 */
@Component({
  selector: 'app-nueva-cotizacion',
  imports: [CdkMenu, CdkMenuItemRadio, CdkMenuTrigger, DecimalPipe, ElegirUbicacion, EnEncabezado, FieldError, FormField, Icon, RutaNavegacion],
  template: `
    <ng-template appEnEncabezado>
      <div class="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <app-ruta-navegacion [lista]="orden() ? 'Órdenes de venta' : 'Cotizaciones'" [ruta]="lista()" [actual]="titulo()" />
        <div class="ml-auto flex gap-2">
          <button type="button" [class]="botonSecundario" (click)="descartar()">Descartar</button>
        </div>
      </div>
    </ng-template>

    <div [class]="cajas.contenedor">
      <div [class]="cajas.columna">
        <form
          id="nueva-cotizacion"
          novalidate
          aria-labelledby="nueva-titulo"
          [class]="cajas.hoja + ' @container'"
          (submit)="guardar($event)"
        >
          <h1 id="nueva-titulo" class="text-2xl font-bold tracking-[-0.02em]">{{ titulo() }}</h1>
          <p class="mt-1 text-sm text-texto-suave">
            Precios del tarifario; escribe un precio especial solo donde aplique.
            {{ orden() ? 'Se crea una orden por producto, sin pasar por cotización.' : 'Se guarda en borrador.' }}
          </p>

          <div class="mt-5 grid gap-4 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <label for="nueva-cliente" [class]="etiqueta">Cliente</label>
              <div class="mt-1 flex gap-2">
                <select
                  id="nueva-cliente"
                  class="campo h-10 min-w-0 flex-1 px-2"
                  aria-describedby="nueva-cliente-error"
                  [formField]="f.clienteId"
                  (change)="clienteElegido($any($event.target).value)"
                >
                  <option value="" disabled>Elige un cliente</option>
                  @for (c of clientes(); track c.id) {
                    <option [value]="c.id">{{ c.nombre }}</option>
                  }
                  <option [value]="publico">Sin cliente (público en general)</option>
                </select>
                <button
                  type="button"
                  [class]="botonSecundario + ' h-10 shrink-0'"
                  aria-controls="cliente-express"
                  [attr.aria-expanded]="creandoCliente()"
                  (click)="abrirClienteExpress()"
                >
                  <ui-icon [icono]="iconos.agregar" [tamano]="16" />Cliente nuevo
                </button>
              </div>
              <ui-field-error [campo]="f.clienteId" errorId="nueva-cliente-error" />
            </div>
            <div>
              <label for="nueva-planta" [class]="etiqueta">Planta</label>
              <select id="nueva-planta" class="campo mt-1 h-10 px-2" [formField]="f.plantaId">
                @for (p of plantas; track p.id) {
                  <option [value]="p.id">{{ p.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <p [class]="etiqueta">Vendedor</p>
              <p class="mt-1 flex h-10 items-center text-sm">{{ vendedor }}</p>
            </div>
          </div>

          @if (creandoCliente()) {
            <!-- Enter en un campo crea el cliente (no guarda la cotización) -->
            <fieldset id="cliente-express" [class]="recuadro" (keydown.enter)="alEnter($event, 'cliente')">
              <legend class="px-1 font-bold">Cliente nuevo (alta rápida)</legend>
              <p class="text-sm text-texto-suave">Lo mínimo para cotizarle; sus datos fiscales se completan después en su ficha.</p>
              <div class="mt-3 grid gap-3 @2xl:grid-cols-4">
                <div>
                  <label for="ce-nombre" [class]="etiqueta">Nombre o empresa</label>
                  <input id="ce-nombre" class="campo mt-1 h-9 px-3 text-sm" aria-describedby="ce-nombre-error" [formField]="express.nombre" />
                  <ui-field-error [campo]="express.nombre" errorId="ce-nombre-error" />
                </div>
                <div>
                  <label for="ce-contacto" [class]="etiqueta">Contacto</label>
                  <input id="ce-contacto" class="campo mt-1 h-9 px-3 text-sm" autocomplete="off" aria-describedby="ce-contacto-error" [formField]="express.contacto" />
                  <ui-field-error [campo]="express.contacto" errorId="ce-contacto-error" />
                </div>
                <div>
                  <label for="ce-telefono" [class]="etiqueta">Teléfono</label>
                  <input id="ce-telefono" type="tel" class="campo mt-1 h-9 px-3 text-sm" aria-describedby="ce-telefono-error" [formField]="express.telefono" />
                  <ui-field-error [campo]="express.telefono" errorId="ce-telefono-error" />
                </div>
                <div>
                  <label for="ce-correo" [class]="etiqueta">Correo (opcional)</label>
                  <input id="ce-correo" type="email" class="campo mt-1 h-9 px-3 text-sm" aria-describedby="ce-correo-error" [formField]="express.correo" />
                  <ui-field-error [campo]="express.correo" errorId="ce-correo-error" />
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="boton-primario h-9 w-auto px-3.5 text-sm" (click)="crearCliente()">Crear y usar</button>
                <button type="button" [class]="botonTexto" (click)="cerrarClienteExpress()">Cancelar</button>
              </div>
            </fieldset>
          }

          @if (pideLugar()) {
            <fieldset id="lugar-entrega" [class]="recuadro" (keydown.enter)="alEnter($event, 'lugar')">
              <legend class="px-1 font-bold">Lugar de entrega</legend>
              <p class="text-sm text-texto-suave">
                {{ explicacionLugar() }} Con el municipio se elige la planta que lo atiende, y de ella salen los precios.
              </p>
              <div class="mt-3 grid gap-3 @2xl:grid-cols-4">
                <div>
                  <label for="lugar-nombre" [class]="etiqueta">Obra (opcional)</label>
                  <input id="lugar-nombre" class="campo mt-1 h-9 px-3 text-sm" placeholder="Entrega a domicilio" [formField]="lugar.nombre" />
                </div>
                <div class="@2xl:col-span-2">
                  <label for="lugar-direccion" [class]="etiqueta">Dirección</label>
                  <input id="lugar-direccion" class="campo mt-1 h-9 px-3 text-sm" aria-describedby="lugar-direccion-error" [formField]="lugar.direccion" />
                  <ui-field-error [campo]="lugar.direccion" errorId="lugar-direccion-error" />
                </div>
                <div>
                  <label for="lugar-municipio" [class]="etiqueta">Municipio</label>
                  <input
                    id="lugar-municipio"
                    list="municipios"
                    class="campo mt-1 h-9 px-3 text-sm"
                    aria-describedby="lugar-municipio-error lugar-planta"
                    [formField]="lugar.municipio"
                  />
                  <datalist id="municipios">
                    @for (m of municipios; track m) {
                      <option [value]="m"></option>
                    }
                  </datalist>
                  <ui-field-error [campo]="lugar.municipio" errorId="lugar-municipio-error" />
                  <p id="lugar-planta" class="mt-1 text-xs text-texto-suave empty:hidden">{{ plantaDelLugar() }}</p>
                </div>
                <div class="@2xl:col-span-2">
                  <label for="lugar-referencias" [class]="etiqueta">Referencias (opcional)</label>
                  <input id="lugar-referencias" class="campo mt-1 h-9 px-3 text-sm" placeholder="Entre calles, acceso para la olla…" [formField]="lugar.referencias" />
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm @2xl:col-span-4">
                  <button type="button" [class]="botonSecundario" aria-haspopup="dialog" (click)="eligiendoUbicacion.set(true)">
                    <ui-icon [icono]="iconos.mapa" [tamano]="16" />{{ ubicacionLugar() ? 'Cambiar el punto en el mapa' : 'Elegir en el mapa' }}
                  </button>
                  @if (ubicacionLugar(); as u) {
                    <span class="font-medium text-[#2E5E4A]">Punto elegido ({{ u.lat | number: '1.5-5' }}, {{ u.lng | number: '1.5-5' }})</span>
                    <a
                      [href]="'https://www.google.com/maps?q=' + u.lat + ',' + u.lng"
                      target="_blank"
                      rel="noopener"
                      class="rounded font-semibold text-epico-oscuro underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico"
                      >Ver en Google Maps<span class="sr-only"> (se abre en otra pestaña)</span></a
                    >
                    <button type="button" [class]="botonTexto" (click)="ubicacionLugar.set(null)">Quitar</button>
                  } @else {
                    <span class="text-texto-suave">Opcional: con el punto, el operador llega aunque no haya dirección formal.</span>
                  }
                </div>
                <div>
                  <label for="lugar-contacto" [class]="etiqueta">Recibe</label>
                  <input id="lugar-contacto" class="campo mt-1 h-9 px-3 text-sm" autocomplete="off" aria-describedby="lugar-contacto-error" [formField]="lugar.contacto" />
                  <ui-field-error [campo]="lugar.contacto" errorId="lugar-contacto-error" />
                </div>
                <div>
                  <label for="lugar-telefono" [class]="etiqueta">Teléfono de quien recibe</label>
                  <input id="lugar-telefono" type="tel" class="campo mt-1 h-9 px-3 text-sm" aria-describedby="lugar-telefono-error" [formField]="lugar.telefono" />
                  <ui-field-error [campo]="lugar.telefono" errorId="lugar-telefono-error" />
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="boton-primario h-9 w-auto px-3.5 text-sm" (click)="crearLugar()">Usar este lugar</button>
                @if (lugarAbierto()) {
                  <button type="button" [class]="botonTexto" (click)="lugarAbierto.set(false)">Cancelar</button>
                }
              </div>
            </fieldset>
          } @else if (modelo().clienteId) {
            <button type="button" [class]="botonTexto + ' mt-3'" aria-controls="lugar-entrega" [attr.aria-expanded]="false" (click)="abrirLugar()">
              <ui-icon [icono]="iconos.agregar" [tamano]="17" />Nuevo lugar de entrega
            </button>
          }
          <p class="mt-3 text-sm font-medium text-[#2E5E4A] empty:hidden" aria-live="polite">{{ aviso() }}</p>

          <h2 class="mt-7 text-lg font-bold">Productos</h2>
          <ol class="mt-3 space-y-4">
            @for (p of modelo().productos; track p.id; let i = $index) {
              <li class="rounded-xl border border-acero/50 bg-white/70 p-4">
                <section [attr.aria-labelledby]="'p' + i + '-titulo'">
                  <div class="flex items-center justify-between gap-3">
                    <h3 [id]="'p' + i + '-titulo'" class="font-bold">Producto {{ i + 1 }}</h3>
                    <button
                      type="button"
                      [class]="botonQuitar"
                      [attr.aria-label]="'Quitar el producto ' + (i + 1)"
                      [disabled]="modelo().productos.length === 1"
                      (click)="quitar(i)"
                    >
                      <ui-icon [icono]="iconos.quitar" [tamano]="17" />
                    </button>
                  </div>

                  <div class="mt-2 grid gap-3 @md:grid-cols-2 @4xl:grid-cols-[1.1fr_1.3fr_1.2fr_1.2fr_0.7fr]">
                    <div>
                      <label [for]="'p' + i + '-solucion'" [class]="etiqueta">Solución</label>
                      <select
                        [id]="'p' + i + '-solucion'"
                        class="campo mt-1 h-9 px-2 text-sm"
                        (change)="elegirSolucion(i, $any($event.target).value)"
                      >
                        @for (s of soluciones; track s.id) {
                          <option [value]="s.id" [selected]="s.id === p.solucionId">{{ s.nombre }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-nombre'" [class]="etiqueta">Descripción</label>
                      <input [id]="'p' + i + '-nombre'" class="campo mt-1 h-9 px-3 text-sm" [formField]="f.productos[i].nombre" />
                    </div>
                    <div>
                      <label [for]="'p' + i + '-obra'" [class]="etiqueta">Obra</label>
                      <select
                        [id]="'p' + i + '-obra'"
                        class="campo mt-1 h-9 px-2 text-sm"
                        [attr.aria-describedby]="'p' + i + '-obra-error'"
                        [formField]="f.productos[i].obraId"
                      >
                        <option value="" disabled>{{ obras().length ? 'Elige la obra' : modelo().clienteId ? 'Primero el lugar de entrega' : 'Primero el cliente' }}</option>
                        @for (o of obras(); track o.id) {
                          <option [value]="o.id">{{ o.nombre }} · {{ o.municipio }}</option>
                        }
                      </select>
                      <ui-field-error [campo]="f.productos[i].obraId" [errorId]="'p' + i + '-obra-error'" />
                    </div>
                    <div>
                      <label [for]="'p' + i + '-entrega'" [class]="etiqueta">Entrega</label>
                      <input
                        type="datetime-local"
                        [id]="'p' + i + '-entrega'"
                        class="campo mt-1 h-9 px-3 text-sm"
                        [attr.aria-describedby]="'p' + i + '-entrega-error p' + i + '-entrega-nota'"
                        [formField]="f.productos[i].entrega"
                      />
                      <ui-field-error [campo]="f.productos[i].entrega" [errorId]="'p' + i + '-entrega-error'" />
                      <p [id]="'p' + i + '-entrega-nota'" class="mt-1 text-xs text-texto-suave empty:hidden">
                        {{ nocturna(p) ? 'Nocturna: lleva colado nocturno.' : '' }}
                      </p>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-volumen'" [class]="etiqueta">Volumen (m³)</label>
                      <input
                        type="number"
                        step="0.5"
                        [id]="'p' + i + '-volumen'"
                        class="campo mt-1 h-9 px-3 text-right text-sm tabular-nums"
                        [attr.aria-describedby]="'p' + i + '-volumen-error'"
                        [formField]="f.productos[i].volumen"
                      />
                      <ui-field-error [campo]="f.productos[i].volumen" [errorId]="'p' + i + '-volumen-error'" />
                    </div>
                  </div>

                  <div class="mt-3 grid gap-3 @md:grid-cols-3 @4xl:grid-cols-6">
                    <div>
                      <label [for]="'p' + i + '-resistencia'" [class]="etiqueta">Resistencia</label>
                      <select
                        [id]="'p' + i + '-resistencia'"
                        class="campo mt-1 h-9 px-2 text-sm"
                        (change)="elegirResistencia(i, $any($event.target).value)"
                      >
                        <optgroup label="f´c (compresión)">
                          @for (v of opciones.fc; track v) {
                            <option [value]="'fc-' + v" [selected]="esResistencia(p, 'fc', v)">f´c {{ v }} kg/cm²</option>
                          }
                        </optgroup>
                        <optgroup label="MR (pavimentos)">
                          @for (v of opciones.mr; track v) {
                            <option [value]="'mr-' + v" [selected]="esResistencia(p, 'mr', v)">MR {{ v }} kg/cm²</option>
                          }
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-edad'" [class]="etiqueta">Edad</label>
                      <select [id]="'p' + i + '-edad'" class="campo mt-1 h-9 px-2 text-sm" (change)="cambiarEsp(i, { edadDias: +$any($event.target).value })">
                        @for (v of opciones.edades; track v) {
                          <option [value]="v" [selected]="v === p.especificacion.edadDias">{{ v }} días</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-rev'" [class]="etiqueta">Revenimiento</label>
                      <select [id]="'p' + i + '-rev'" class="campo mt-1 h-9 px-2 text-sm" (change)="cambiarEsp(i, { revenimientoCm: +$any($event.target).value })">
                        @for (v of opciones.revenimientos; track v) {
                          <option [value]="v" [selected]="v === p.especificacion.revenimientoCm">{{ v }} cm</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-tma'" [class]="etiqueta">TMA</label>
                      <select [id]="'p' + i + '-tma'" class="campo mt-1 h-9 px-2 text-sm" (change)="cambiarEsp(i, { tmaMm: +$any($event.target).value })">
                        @for (v of opciones.tma; track v) {
                          <option [value]="v" [selected]="v === p.especificacion.tmaMm">{{ v }} mm</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-cemento'" [class]="etiqueta">Cemento</label>
                      <select [id]="'p' + i + '-cemento'" class="campo mt-1 h-9 px-2 text-sm" (change)="cambiarEsp(i, { cemento: $any($event.target).value })">
                        @for (v of opciones.cementos; track v) {
                          <option [value]="v" [selected]="v === p.especificacion.cemento">{{ v }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label [for]="'p' + i + '-exposicion'" [class]="etiqueta">Exposición</label>
                      <select [id]="'p' + i + '-exposicion'" class="campo mt-1 h-9 px-2 text-sm" (change)="cambiarEsp(i, { exposicion: $any($event.target).value })">
                        @for (v of exposiciones; track v.id) {
                          <option [value]="v.id" [selected]="v.id === p.especificacion.exposicion">{{ v.label }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  <div class="mt-3 grid gap-3 text-sm @4xl:grid-cols-2">
                    <fieldset>
                      <legend [class]="etiqueta">Aditivos</legend>
                      <div class="mt-1 flex flex-wrap gap-x-4">
                        @for (a of aditivos; track a.id) {
                          <label class="flex min-h-8 cursor-pointer items-center gap-2">
                            <input type="checkbox" class="casilla" [checked]="p.especificacion.aditivos.includes(a.id)" (change)="alternarAditivo(i, a.id)" />{{ a.label }}
                          </label>
                        }
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend [class]="etiqueta">Servicios</legend>
                      <div class="mt-1 flex flex-wrap gap-x-4">
                        @for (s of servicios; track s.id) {
                          <!-- El colado nocturno lo pone la hora de entrega: marcado y fijo mientras sea nocturna -->
                          <label class="flex min-h-8 cursor-pointer items-center gap-2 has-disabled:cursor-default">
                            <input
                              type="checkbox"
                              class="casilla"
                              [checked]="serviciosDe(p).includes(s.id)"
                              [disabled]="s.id === 'colado-nocturno' && nocturna(p)"
                              (change)="alternarServicio(i, s.id)"
                            />{{ s.nombre }}
                          </label>
                        }
                      </div>
                    </fieldset>
                  </div>

                  @let lista = recomendaciones(p);
                  @if (lista.length) {
                      <ul class="mt-3 space-y-1.5 text-sm" [attr.aria-label]="'Recomendaciones del producto ' + (i + 1)">
                        @for (a of lista; track a.texto) {
                          <li class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#FFF6E0] px-3 py-2 text-[#6B4A00]">
                            {{ a.texto }}
                            @if (a.arreglo) {
                              <button type="button" [class]="botonTexto" (click)="cambiarEsp(i, a.arreglo)">{{ a.accion }}</button>
                            }
                          </li>
                        }
                      </ul>
                  }

                  <div class="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-acero/50 pt-3 text-sm">
                    <div>
                      <label [for]="'p' + i + '-precio'" [class]="etiqueta">Precio especial del concreto</label>
                      <span class="mt-1 flex items-center gap-1.5">
                        $
                        <input
                          type="number"
                          step="0.01"
                          [id]="'p' + i + '-precio'"
                          class="campo h-9 w-32 px-3 text-right tabular-nums"
                          [placeholder]="pesos(tarifa(i))"
                          [attr.aria-describedby]="'p' + i + '-precio-error p' + i + '-precio-tarifa'"
                          [formField]="f.productos[i].precio"
                        />
                        por m³
                        <span [id]="'p' + i + '-precio-tarifa'" class="ml-2 text-texto-suave">Tarifa \${{ pesos(tarifa(i)) }}</span>
                      </span>
                      <ui-field-error [campo]="f.productos[i].precio" [errorId]="'p' + i + '-precio-error'" />
                    </div>
                    <div>
                      <label [for]="'p' + i + '-distancia'" [class]="etiqueta">Distancia desde la planta</label>
                      <span class="mt-1 flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          [id]="'p' + i + '-distancia'"
                          class="campo h-9 w-24 px-3 text-right tabular-nums"
                          [attr.aria-describedby]="'p' + i + '-distancia-error p' + i + '-distancia-nota'"
                          [formField]="f.productos[i].distancia"
                          (input)="marcarManual(i, $any($event.target).value)"
                        />
                        km
                      </span>
                      <ui-field-error [campo]="f.productos[i].distancia" [errorId]="'p' + i + '-distancia-error'" />
                      <p [id]="'p' + i + '-distancia-nota'" class="mt-1 max-w-80 text-xs text-texto-suave empty:hidden" aria-live="polite">{{ notaDistancia(i) }}</p>
                    </div>
                    <p class="text-right">
                      <span class="block text-xs tracking-wide text-texto-suave uppercase">Importe sin IVA</span>
                      <span class="font-bold tabular-nums">\${{ pesos(importe(i)) }}</span>
                    </p>
                  </div>
                </section>
              </li>
            }
          </ol>
          <button type="button" [class]="botonTexto + ' mt-2'" (click)="agregar()">
            <ui-icon [icono]="iconos.agregar" [tamano]="17" />Agregar producto
          </button>

        </form>
        <!-- Fuera del formulario: su búsqueda no debe enviar la cotización -->
        <app-elegir-ubicacion
          [(abierto)]="eligiendoUbicacion"
          [inicial]="ubicacionLugar()"
          [municipio]="lugar.municipio().value()"
          (elegida)="ubicacionElegida($event)"
        />
      </div>

      <!-- El resumen económico a la derecha (debajo en celular), como "Tu selección" en el portal -->
      <aside aria-labelledby="resumen-titulo" [class]="columnaResumen">
        <div class="glass p-4 text-sm sm:p-5">
          <h2 id="resumen-titulo" class="text-lg font-bold">Resumen</h2>
          <dl class="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
            <dt class="text-texto-suave">Cliente</dt>
            <dd class="truncate">{{ nombreCliente() }}</dd>
            <dt class="text-texto-suave">Planta</dt>
            <dd>{{ nombrePlanta() }}</dd>
          </dl>

          <ul class="mt-3 space-y-2 border-t border-acero/60 pt-3" aria-label="Productos">
            @for (p of modelo().productos; track p.id; let i = $index) {
              <li class="flex items-baseline justify-between gap-3">
                <span class="min-w-0">
                  <span class="block truncate font-medium">{{ p.nombre || 'Producto ' + (i + 1) }}</span>
                  <span class="text-texto-suave">{{ p.volumen ? (p.volumen | number: '1.0-1') + ' m³' : 'Falta el volumen' }}</span>
                </span>
                <span class="shrink-0 tabular-nums">\${{ pesos(importe(i)) }}</span>
              </li>
            }
          </ul>

          <div class="mt-3 border-t border-acero/60 pt-3">
            <fieldset>
              <legend [class]="etiqueta">Traslado</legend>
              <div class="mt-1 grid grid-cols-2 gap-3">
                <div>
                  <label for="traslado-incluidos" class="text-texto-suave">Km incluidos</label>
                  <input
                    id="traslado-incluidos"
                    type="number"
                    step="1"
                    class="campo mt-1 h-9 px-3 text-right tabular-nums"
                    aria-describedby="traslado-incluidos-error traslado-nota"
                    [formField]="f.traslado.incluidosKm"
                  />
                  <ui-field-error [campo]="f.traslado.incluidosKm" errorId="traslado-incluidos-error" />
                </div>
                <div>
                  <label for="traslado-precio" class="text-texto-suave">$ por km extra</label>
                  <input
                    id="traslado-precio"
                    type="number"
                    step="0.5"
                    class="campo mt-1 h-9 px-3 text-right tabular-nums"
                    aria-describedby="traslado-precio-error traslado-nota"
                    [formField]="f.traslado.precioKm"
                  />
                  <ui-field-error [campo]="f.traslado.precioKm" errorId="traslado-precio-error" />
                </div>
              </div>
              <p id="traslado-nota" class="mt-1 text-xs text-texto-suave">
                Cada km después de los incluidos se cobra por m³, según la distancia de cada producto.
              </p>
            </fieldset>
          </div>

          <div class="mt-3 border-t border-acero/60 pt-3">
            <label for="nueva-descuento" [class]="etiqueta">Descuento sobre el subtotal</label>
            <span class="mt-1 flex items-center gap-1.5">
              <input
                id="nueva-descuento"
                type="number"
                step="0.5"
                class="campo h-9 w-24 px-3 text-right tabular-nums"
                aria-describedby="nueva-descuento-error"
                [formField]="f.descuento"
              />%
            </span>
            <ui-field-error [campo]="f.descuento" errorId="nueva-descuento-error" />
          </div>

          <dl class="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1" aria-label="Totales">
            <dt class="text-texto-suave">Subtotal</dt>
            <dd class="text-right tabular-nums">\${{ pesos(total().subtotal) }}</dd>
            @if (total().descuento) {
              <dt class="text-texto-suave">Descuento {{ modelo().descuento | number: '1.0-2' }}%</dt>
              <dd class="text-right tabular-nums">−\${{ pesos(total().descuento) }}</dd>
            }
            <dt class="text-texto-suave">IVA 16%</dt>
            <dd class="text-right tabular-nums">\${{ pesos(total().iva) }}</dd>
            <dt class="border-t border-acero/60 pt-1.5 text-base font-bold">Neto</dt>
            <dd class="border-t border-acero/60 pt-1.5 text-right text-base font-bold tabular-nums">\${{ pesos(total().neto) }}</dd>
          </dl>

          <!-- Botón dividido: la acción elegida (Guardar por omisión) y, en la flecha, las demás -->
          <div class="mt-4 flex">
            <button
              type="button"
              class="boton-primario h-11 min-w-0 flex-1 gap-2 rounded-r-none px-4 text-[15px]"
              [disabled]="ocupado()"
              [attr.aria-busy]="ocupado()"
              (click)="ejecutar()"
            >
              <ui-icon [icono]="ocupado() ? iconos.cargando : accion() === 'guardar' ? iconos.guardar : iconos.descargar" [tamano]="18" [class.animate-spin]="ocupado()" />
              {{ opcion().boton }}
            </button>
            <button
              type="button"
              class="boton-primario h-11 w-11 shrink-0 rounded-l-none border-l border-white/40 p-0"
              [attr.aria-label]="'Más opciones: ' + queHacer().toLowerCase()"
              [cdkMenuTriggerFor]="menuAcciones"
              [disabled]="ocupado()"
            >
              <ui-icon [icono]="iconos.abrir" [tamano]="18" />
            </button>
          </div>
          <ng-template #menuAcciones>
            <section [attr.aria-label]="queHacer()">
              <div cdkMenu [attr.aria-label]="queHacer()" class="glass-strong mt-1 min-w-64 p-1.5 text-[15px] text-carbon">
                @for (o of acciones(); track o.id) {
                  <button
                    cdkMenuItemRadio
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-carbon/5 focus-visible:bg-carbon/5 focus-visible:outline-none"
                    [cdkMenuItemChecked]="accion() === o.id"
                    (cdkMenuItemTriggered)="elegirAccion(o.id)"
                  >
                    <ui-icon [icono]="iconos.elegida" [tamano]="16" [class.invisible]="accion() !== o.id" />
                    <span>
                      <span class="block font-semibold">{{ o.texto }}</span>
                      <span class="block text-sm text-texto-suave">{{ o.detalle }}</span>
                    </span>
                  </button>
                }
              </div>
            </section>
          </ng-template>
          <p class="mt-2 font-medium empty:hidden" [class]="error() ? 'text-critico' : 'text-[#2E5E4A]'" aria-live="polite">
            {{ error() || avisoAccion() }}
          </p>
        </div>
      </aside>
    </div>
  `,
})
export default class NuevaCotizacionPagina {
  private readonly ventas = inject(VentasService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly usuario = inject(AuthService).sesion()?.usuario;

  protected readonly cajas = CAJAS_VISTA;
  protected readonly iconos = {
    quitar: Trash2,
    agregar: Plus,
    mapa: MapPin,
    guardar: Save,
    descargar: Download,
    cargando: LoaderCircle,
    abrir: ChevronDown,
    elegida: Check,
  };
  // 23.5rem: los 22rem del resumen más el relleno de la columna, que deja ver su sombra.
  protected readonly columnaResumen = COLUMNA + ' block lg:w-[23.5rem] lg:shrink-0';
  /** De la ruta (data.modo): "orden" es Nueva orden de venta, la misma hoja sin pasar por cotización. */
  readonly modo = input<'cotizacion' | 'orden'>('cotizacion');
  protected readonly orden = computed(() => this.modo() === 'orden');
  protected readonly titulo = computed(() => (this.orden() ? 'Nueva orden de venta' : 'Nueva cotización'));
  protected readonly lista = computed(() => (this.orden() ? '/ventas/ordenes' : '/ventas/cotizaciones'));
  protected readonly queHacer = computed(() => (this.orden() ? 'Cómo crear la orden' : 'Qué hacer con la cotización'));
  /** Cotización: como en el portal, pero por omisión solo se guarda. Orden: por omisión, sin cotización. */
  protected readonly acciones = computed<{ id: Accion; texto: string; boton: string; detalle: string }[]>(() =>
    this.orden()
      ? [
          { id: 'orden', texto: 'Solo crear la orden', boton: 'Crear orden', detalle: 'Sin cotización: una orden por producto.' },
          {
            id: 'orden-cotizacion',
            texto: 'Crear orden y cotización',
            boton: 'Crear orden y cotización',
            detalle: 'La cotización queda de respaldo, ya confirmada.',
          },
        ]
      : [
          { id: 'guardar', texto: 'Solo guardar', boton: 'Guardar', detalle: 'Queda en borrador para enviarla o confirmarla.' },
          { id: 'guardar-descargar', texto: 'Guardar y descargar', boton: 'Guardar y descargar', detalle: 'Además, el PDF.' },
          { id: 'descargar', texto: 'Solo descargar', boton: 'Descargar sin guardar', detalle: 'El PDF, sin guardarla.' },
        ],
  );
  protected readonly accion = linkedSignal<Accion>(() => this.acciones()[0].id);
  protected readonly opcion = computed(() => this.acciones().find((a) => a.id === this.accion())!);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly avisoAccion = signal('');
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonSecundario =
    'inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonTexto =
    'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico';
  protected readonly botonQuitar =
    'flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-critico/10 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico disabled:pointer-events-none disabled:opacity-40';

  /** Los clientes en orden; "Sin cliente" (público en general) va aparte, al final. */
  protected readonly clientes = computed(() => this.ventas.clientes().filter((c) => c.id !== PUBLICO_GENERAL));
  protected readonly publico = PUBLICO_GENERAL;
  protected readonly recuadro = 'mt-4 rounded-xl border border-acero/60 bg-white/70 p-4';
  protected readonly municipios = ['Escárcega, Camp.', 'Xpujil, Camp.', 'Cozumel, Q. Roo', 'Cancún, Q. Roo'];
  protected readonly plantas = PLANTAS_ERP;
  protected readonly vendedor = this.usuario?.nombre || 'Tú';
  protected readonly soluciones = [...SOLUCIONES, PERSONALIZADO];
  protected readonly opciones = OPCIONES;
  protected readonly exposiciones = EXPOSICIONES;
  protected readonly aditivos = ADITIVOS;
  // La renta de maquinaria lleva días por equipo: como en el editor, no se captura aquí.
  protected readonly servicios = SERVICIOS.filter((s) => s.id !== 'renta-maquinaria');
  protected readonly pesos = pesos;
  protected readonly serviciosDe = serviciosDe;

  protected readonly modelo = signal<Borrador>({
    clienteId: '',
    plantaId: inject(PlantasService).actualId(),
    productos: [productoDe('losa', '', '')],
    descuento: null,
    traslado: { ...TRASLADO },
  });
  protected readonly f = form(this.modelo, (m) => {
    required(m.clienteId, { message: 'Elige el cliente.' });
    applyEach(m.productos, (p) => {
      required(p.obraId, { message: 'Elige la obra de entrega.' });
      required(p.entrega, { message: 'Elige la fecha y hora de entrega.' });
      validate(p.entrega, ({ value }) =>
        !value() || Date.parse(value()) > Date.now() ? undefined : { kind: 'pasada', message: 'Esa fecha ya pasó.' },
      );
      required(p.volumen, { message: 'Escribe el volumen.' });
      min(p.volumen, 0.5, { message: 'El mínimo es 0.5 m³.' });
      min(p.precio, 1, { message: 'El precio debe ser mayor a cero.' });
      min(p.distancia, 0, { message: 'La distancia no puede ser negativa.' });
    });
    min(m.descuento, 0, { message: 'El descuento no puede ser negativo.' });
    max(m.descuento, 100, { message: 'El descuento no puede pasar de 100 %.' });
    min(m.traslado.incluidosKm, 0, { message: 'No puede ser negativo.' });
    min(m.traslado.precioKm, 0, { message: 'No puede ser negativo.' });
  });

  /** Lugares de entrega dados de alta en esta cotización (los de público en general son solo de esta venta). */
  private readonly creadas = signal<string[]>([]);
  protected readonly obras = computed(() => this.obrasDe(this.modelo().clienteId));
  protected readonly aviso = signal('');

  // Alta rápida de cliente
  protected readonly creandoCliente = signal(false);
  protected readonly express = form(signal({ nombre: '', contacto: '', telefono: '', correo: '' }), (m) => {
    required(m.nombre, { message: 'Escribe el nombre o la empresa.' });
    required(m.contacto, { message: 'Escribe a quién contactar.' });
    required(m.telefono, { message: 'Escribe el teléfono.' });
    validate(m.telefono, diezDigitos);
    email(m.correo, { message: 'Escribe un correo válido.' });
  });

  // Lugar de entrega: sin cliente o cliente sin obras se pide solo; si no, con "Nuevo lugar de entrega"
  protected readonly lugarAbierto = signal(false);
  protected readonly eligiendoUbicacion = signal(false);
  protected readonly ubicacionLugar = signal<UbicacionElegida['ubicacion'] | null>(null);
  protected readonly pideLugar = computed(() => this.lugarAbierto() || (!!this.modelo().clienteId && !this.obras().length));
  protected readonly explicacionLugar = computed(() =>
    this.modelo().clienteId === PUBLICO_GENERAL
      ? 'Sin cliente: ¿a dónde se entrega y quién recibe?'
      : this.obras().length
        ? 'Otro lugar de entrega para este cliente.'
        : 'Este cliente aún no tiene obras: ¿a dónde se entrega y quién recibe?',
  );
  protected readonly lugar = form(
    signal({ nombre: '', direccion: '', municipio: '', referencias: '', contacto: '', telefono: '' }),
    (m) => {
      required(m.direccion, { message: 'Escribe la dirección de entrega.' });
      required(m.municipio, { message: 'Escribe el municipio.' });
      required(m.contacto, { message: 'Escribe quién recibe el concreto.' });
      required(m.telefono, { message: 'Escribe el teléfono de quien recibe.' });
      validate(m.telefono, diezDigitos);
    },
  );
  protected readonly plantaDelLugar = computed(() => {
    const m = this.lugar.municipio().value();
    if (!m.trim()) return '';
    const id = plantaDeMunicipio(m);
    return id ? `Lo atiende ${PLANTAS_ERP.find((p) => p.id === id)!.nombre}.` : 'Fuera de la zona de las plantas: confirma la planta y el traslado.';
  });
  // shortcut: el offset de la planta de hoy vale para las entregas porque México ya no cambia de horario; si una
  // planta llega a tenerlo, calcularlo con la fecha de cada entrega.
  private readonly offset = computed(() =>
    offsetEn(PLANTAS_ERP.find((p) => p.id === this.modelo().plantaId)!.zonaHoraria, new Date()),
  );
  private readonly partidas = computed(() =>
    this.modelo().productos.map((p) => partidaDe(p, this.offset(), this.modelo().traslado)),
  );

  /** Una consulta por planta y obra, aunque varios productos vayan a la misma. */
  private readonly distancias = new Map<string, Promise<{ km: number; fuente: FuenteDistancia }>>();

  constructor() {
    // La distancia de cada producto se calcula sola si la planta y la obra tienen punto en el mapa, y se vuelve a
    // calcular si cambia alguna; la que se escribió a mano se respeta.
    effect(() => {
      const m = this.modelo();
      const planta = PLANTAS_ERP.find((x) => x.id === m.plantaId)?.ubicacion;
      const obras = this.ventas.obras();
      for (const p of m.productos) {
        if (p.fuenteDistancia === 'manual') continue;
        const obra = obras.find((o) => o.id === p.obraId);
        const clave = planta && obra?.ubicacion ? `${m.plantaId}|${obra.id}` : '';
        if (clave === p.claveDistancia) continue;
        untracked(() => this.cambiarPorId(p.id, (x) => ({ ...x, claveDistancia: clave, distancia: null, fuenteDistancia: null })));
        if (!clave) continue;
        let d = this.distancias.get(clave);
        if (!d) this.distancias.set(clave, (d = distanciaDeManejo(planta!, obra!.ubicacion!)));
        void d.then(({ km, fuente }) =>
          this.cambiarPorId(p.id, (x) =>
            x.claveDistancia === clave && x.fuenteDistancia !== 'manual' ? { ...x, distancia: km, fuenteDistancia: fuente } : x,
          ),
        );
      }
    });
  }

  /** Escribir la distancia la vuelve manual; borrarla deja que se calcule otra vez. */
  protected marcarManual(i: number, valor: string): void {
    this.cambiar(i, (p) => (valor === '' ? { ...p, fuenteDistancia: null, claveDistancia: '' } : { ...p, fuenteDistancia: 'manual' }));
  }

  /** De dónde salió la distancia y cuánto cobra de traslado. */
  protected notaDistancia(i: number): string {
    const p = this.modelo().productos[i];
    const t = this.partidas()[i]?.traslado;
    const incluidos = this.modelo().traslado.incluidosKm ?? 0;
    if (p.distancia == null) {
      if (p.claveDistancia) return 'Calculando la distancia por carretera…';
      return p.obraId ? `La obra no tiene punto en el mapa: escribe los km si pasa de ${incluidos} km.` : '';
    }
    const fuente = {
      carretera: 'Por carretera, calculada.',
      aprox: 'Aproximada (línea recta × 1.3); corrígela si la conoces.',
      manual: 'Escrita a mano.',
    }[p.fuenteDistancia ?? 'manual'];
    const extra = t ? kmExtra(t) : 0;
    if (!t || !extra) return `${fuente} Dentro de los ${incluidos} km incluidos.`;
    if (!t.precioKm) return `${fuente} ${extra} km después de los incluidos, sin costo por km.`;
    return `${fuente} Traslado: ${extra} km × $${pesos(t.precioKm)} = $${pesos(extra * t.precioKm)} por m³.`;
  }

  private cambiarPorId(id: string, cambio: (p: Producto) => Producto): void {
    this.modelo.update((m) => ({ ...m, productos: m.productos.map((p) => (p.id === id ? cambio(p) : p)) }));
  }
  protected readonly nombreCliente = computed(() => {
    const id = this.modelo().clienteId;
    if (!id) return 'Sin elegir';
    return id === PUBLICO_GENERAL ? 'Sin cliente (público en general)' : (this.ventas.cliente(id)?.nombre ?? '');
  });
  protected readonly nombrePlanta = computed(() => PLANTAS_ERP.find((p) => p.id === this.modelo().plantaId)!.nombre);
  protected readonly total = computed(() =>
    totalesCotizacion({ partidas: this.partidas(), descuento: this.modelo().descuento ?? undefined }),
  );
  protected readonly tarifa = (i: number) => precioConcreto({ ...this.partidas()[i], precioM3: undefined });
  protected readonly importe = (i: number) => totales(lineasPartida(this.partidas()[i])).subtotal;
  protected readonly nocturna = nocturna;
  protected readonly recomendaciones = (p: Producto) =>
    avisos({ ...p.especificacion, colocacion: colocacionParaServicios(serviciosDe(p)) });
  protected readonly esResistencia = (p: Producto, tipo: 'fc' | 'mr', v: number) =>
    p.especificacion.tipoResistencia === tipo && p.especificacion.resistenciaKgCm2 === v;

  private readonly inicial = JSON.stringify(this.modelo());
  private guardada = false;

  /** Al cambiar de cliente, las obras que ya no son suyas se borran; si tiene una sola, se elige. */
  private obrasDe(clienteId: string) {
    return this.ventas
      .obras()
      .filter((o) => o.clienteId === clienteId && (clienteId !== PUBLICO_GENERAL || this.creadas().includes(o.id)));
  }

  protected abrirClienteExpress(): void {
    this.creandoCliente.set(true);
    this.enfocar('ce-nombre');
  }

  protected cerrarClienteExpress(): void {
    this.creandoCliente.set(false);
    this.enfocar('nueva-cliente');
  }

  /** Lo crea, lo elige y, como aún no tiene obras, sigue con su lugar de entrega. */
  protected async crearCliente(): Promise<void> {
    const valido = await submit(this.express, async () => {
      const c = this.ventas.crearCliente(this.express().value());
      this.modelo.update((m) => ({ ...m, clienteId: c.id }));
      this.clienteElegido(c.id);
      this.express().reset({ nombre: '', contacto: '', telefono: '', correo: '' });
      this.creandoCliente.set(false);
      this.aviso.set(`Cliente ${c.nombre} creado. Falta a dónde se entrega.`);
      this.enfocar('lugar-direccion');
      return undefined;
    });
    if (!valido) this.enfocarError(['ce-nombre', 'ce-contacto', 'ce-telefono', 'ce-correo'], [this.express.nombre, this.express.contacto, this.express.telefono, this.express.correo]);
  }

  protected abrirLugar(): void {
    this.lugarAbierto.set(true);
    this.enfocar('lugar-nombre');
  }

  /** Lo guarda como obra del cliente, lo pone en los productos sin obra y elige la planta de su municipio. */
  protected async crearLugar(): Promise<void> {
    const valido = await submit(this.lugar, async () => {
      const datos = { ...this.lugar().value(), ubicacion: this.ubicacionLugar() ?? undefined };
      const obra = this.ventas.crearObra(this.modelo().clienteId, datos);
      this.ubicacionLugar.set(null);
      this.creadas.update((l) => [...l, obra.id]);
      const plantaId = plantaDeMunicipio(obra.municipio);
      this.modelo.update((m) => ({
        ...m,
        plantaId: plantaId ?? m.plantaId,
        productos: m.productos.map((p) => (p.obraId ? p : { ...p, obraId: obra.id })),
      }));
      this.lugar().reset({ nombre: '', direccion: '', municipio: '', referencias: '', contacto: '', telefono: '' });
      this.lugarAbierto.set(false);
      const planta = PLANTAS_ERP.find((p) => p.id === this.modelo().plantaId)!.nombre;
      this.aviso.set(`Lugar de entrega "${obra.nombre}" agregado; lo atiende ${planta}.`);
      this.enfocar('p0-entrega');
      return undefined;
    });
    if (!valido) this.enfocarError(['lugar-direccion', 'lugar-municipio', 'lugar-contacto', 'lugar-telefono'], [this.lugar.direccion, this.lugar.municipio, this.lugar.contacto, this.lugar.telefono]);
  }

  /** El punto del mapa; su dirección y municipio llenan lo que falte (el municipio elige la planta). */
  protected ubicacionElegida(e: UbicacionElegida): void {
    this.ubicacionLugar.set(e.ubicacion);
    if (e.direccion && !this.lugar.direccion().value().trim()) this.lugar.direccion().value.set(e.direccion);
    if (e.municipio && !this.lugar.municipio().value().trim()) this.lugar.municipio().value.set(e.municipio);
  }

  /** Enter dentro del alta rápida o del lugar hace su acción, no "Guardar" la cotización. */
  protected alEnter(e: Event, que: 'cliente' | 'lugar'): void {
    if ((e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    void (que === 'cliente' ? this.crearCliente() : this.crearLugar());
  }

  private enfocarError(ids: string[], campos: { (): { invalid(): boolean } }[]): void {
    const i = campos.findIndex((c) => c().invalid());
    if (i >= 0) document.getElementById(ids[i])?.focus();
  }

  protected clienteElegido(clienteId: string): void {
    this.lugarAbierto.set(false);
    this.aviso.set('');
    const suyas = this.obrasDe(clienteId);
    this.modelo.update((m) => ({
      ...m,
      productos: m.productos.map((p) => ({
        ...p,
        obraId: suyas.some((o) => o.id === p.obraId) ? p.obraId : suyas.length === 1 ? suyas[0].id : '',
      })),
    }));
  }

  /** La solución pone su especificación y servicios sugeridos; la descripción, si no se había cambiado. */
  protected elegirSolucion(i: number, id: string): void {
    const s = buscarSolucion(id) ?? PERSONALIZADO;
    this.cambiar(i, (p) => ({
      ...p,
      solucionId: s.id,
      nombre: !p.nombre.trim() || p.nombre === buscarSolucion(p.solucionId)?.nombre ? s.nombre : p.nombre,
      especificacion: structuredClone(s.sugerida),
      servicios: [...s.servicios],
    }));
  }

  protected elegirResistencia(i: number, valor: string): void {
    const [tipo, kg] = valor.split('-');
    this.cambiarEsp(i, { tipoResistencia: tipo as 'fc' | 'mr', resistenciaKgCm2: Number(kg) });
  }

  protected cambiarEsp(i: number, cambio: Partial<EspecificacionConcreto>): void {
    this.cambiar(i, (p) => ({ ...p, especificacion: { ...p.especificacion, ...cambio } }));
  }

  protected alternarAditivo(i: number, a: Aditivo): void {
    this.cambiar(i, (p) => {
      const lista = p.especificacion.aditivos;
      return { ...p, especificacion: { ...p.especificacion, aditivos: lista.includes(a) ? lista.filter((x) => x !== a) : [...lista, a] } };
    });
  }

  protected alternarServicio(i: number, s: ServicioObra): void {
    this.cambiar(i, (p) => ({ ...p, servicios: p.servicios.includes(s) ? p.servicios.filter((x) => x !== s) : [...p.servicios, s] }));
  }

  /** El siguiente producto parte de la solución, la obra y la entrega del anterior; el foco va a su volumen. */
  protected agregar(): void {
    const ultimo = this.modelo().productos.at(-1)!;
    this.modelo.update((m) => ({ ...m, productos: [...m.productos, productoDe(ultimo.solucionId, ultimo.obraId, ultimo.entrega)] }));
    this.enfocar('p' + (this.modelo().productos.length - 1) + '-solucion');
  }

  protected quitar(i: number): void {
    this.modelo.update((m) => ({ ...m, productos: m.productos.filter((_, j) => j !== i) }));
    this.enfocar('p' + Math.min(i, this.modelo().productos.length - 1) + '-solucion');
  }

  /** Enter en un campo de la hoja: la acción elegida, como el botón. */
  protected guardar(e: Event): void {
    e.preventDefault();
    void this.ejecutar();
  }

  /** Elegir en el menú cambia lo que hace el botón (no lo ejecuta: así no se guarda por accidente). */
  protected elegirAccion(id: Accion): void {
    this.accion.set(id);
    this.avisoAccion.set(`El botón ahora dice "${this.opcion().boton}".`);
  }

  /**
   * Solo guardar: la crea en borrador y abre su vista completa. Guardar y descargar: además baja su PDF. Solo
   * descargar: el PDF con el folio que tendría, marcado como borrador sin guardar, y se queda en la página.
   */
  protected async ejecutar(): Promise<void> {
    const accion = this.accion();
    this.error.set('');
    this.avisoAccion.set('');
    const valido = await submit(this.f, async () => {
      this.ocupado.set(true);
      try {
        const m = this.modelo();
        const datos = { clienteId: m.clienteId, plantaId: m.plantaId, partidas: this.partidas(), descuento: m.descuento || undefined };
        if (accion === 'orden' || accion === 'orden-cotizacion') {
          const ordenes = this.ventas.crearOrdenes(datos, this.usuario?.correo ?? '', accion === 'orden-cotizacion');
          this.guardada = true;
          await this.router.navigate(['/ventas/ordenes', ordenes[0].folio]);
          return undefined;
        }
        if (accion === 'descargar') {
          const fecha = isoEnZona(PLANTAS_ERP.find((p) => p.id === m.plantaId)!.zonaHoraria);
          const folio = siguienteFolio(this.ventas.cotizaciones().map((c) => c.serie), m.plantaId, fecha);
          await this.pdf({ ...datos, folio, fecha: new Date(), referencia: 'Borrador sin guardar' });
          this.avisoAccion.set(`Descargaste ${folio}.pdf. La cotización aún no está guardada.`);
          return undefined;
        }
        const c = this.ventas.crear(datos, this.usuario?.correo ?? '');
        this.guardada = true;
        if (accion === 'guardar-descargar') await this.pdf({ ...datos, folio: c.folio, fecha: new Date(c.fecha) });
        await this.router.navigate(['/ventas/cotizaciones', c.id]);
      } catch {
        this.error.set('No pudimos generar el PDF. La cotización sí se guardó si elegiste guardarla.');
      } finally {
        this.ocupado.set(false);
      }
      return undefined;
    });
    // Inválida: el foco va al primer campo con error (por id: no hay que esperar a que se pinte).
    if (!valido) document.getElementById(this.primerError() ?? '')?.focus();
  }

  private pdf(d: { clienteId: string; partidas: PartidaCotizacion[]; descuento?: number; folio: string; fecha: Date; referencia?: string }) {
    const cliente = this.ventas.cliente(d.clienteId);
    return descargarCotizacionPdf({
      folio: d.folio,
      fecha: d.fecha,
      cliente: { nombre: cliente?.nombre ?? '', correo: cliente?.contacto.correo ?? '' },
      partidas: d.partidas,
      obras: this.ventas.obras(),
      descuento: d.descuento,
      referencia: d.referencia,
      emitida: true,
    });
  }

  private primerError(): string | null {
    if (this.f.clienteId().invalid()) return 'nueva-cliente';
    if (this.pideLugar() && !this.obras().length) return 'lugar-direccion';
    for (let i = 0; i < this.modelo().productos.length; i++) {
      const p = this.f.productos[i];
      for (const [campo, id] of [[p.obraId, 'obra'], [p.entrega, 'entrega'], [p.volumen, 'volumen'], [p.precio, 'precio'], [p.distancia, 'distancia']] as const) {
        if (campo().invalid()) return `p${i}-${id}`;
      }
    }
    if (this.f.traslado.incluidosKm().invalid()) return 'traslado-incluidos';
    if (this.f.traslado.precioKm().invalid()) return 'traslado-precio';
    return this.f.descuento().invalid() ? 'nueva-descuento' : null;
  }

  protected descartar(): void {
    void this.router.navigate([this.lista()]);
  }

  /** canDeactivate de la ruta: con cambios sin guardar, pregunta antes de salir (también con Descartar). */
  puedeSalir(): boolean {
    return this.guardada || JSON.stringify(this.modelo()) === this.inicial || confirm(`Hay cambios sin guardar en ${this.orden() ? 'la orden' : 'la cotización'}. ¿Descartarlos?`);
  }

  private cambiar(i: number, cambio: (p: Producto) => Producto): void {
    this.modelo.update((m) => ({ ...m, productos: m.productos.map((p, j) => (j === i ? cambio(p) : p)) }));
  }

  private enfocar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
