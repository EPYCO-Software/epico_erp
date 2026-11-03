import { Component, Injector, afterNextRender, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormField, applyEach, form, required, submit, validate } from '@angular/forms/signals';
import { Camera, Check, ChevronDown, ExternalLink, LocateFixed, Plus, Trash2 } from 'lucide';
import { FieldError, Icon, Mapa, Obra, UbicacionGps } from 'ui';
import { NuevaObra } from '../../core/services/obras.service';
import { Avatar } from './avatar';
import { LADAS, LADA_MX, validarTelefono } from './telefono';

const FOTO_MAX_MB = 2;
const contactoVacio = () => ({ nombre: '', lada: LADA_MX, numero: '' });

function aModelo(o: Obra | null) {
  return {
    nombre: o?.nombre ?? '',
    municipio: o?.municipio ?? '',
    direccion: o?.direccion ?? '',
    referencias: o?.referencias ?? '',
    responsable: o?.responsable.nombre ?? '',
    foto: o?.responsable.foto ?? '',
    contactos: o?.contactos.map((c) => ({ ...c })) ?? [contactoVacio()],
  };
}

/**
 * Formulario de obra (alta y edición): datos de entrega, ubicación GPS, responsable con foto y contactos con
 * teléfono (lada +52 por defecto, se permiten extranjeros). Lo usan el cotizador y Mis obras.
 */
@Component({
  selector: 'app-obra-form',
  imports: [Avatar, DecimalPipe, FormField, FieldError, Icon, Mapa],
  template: `
    <form [id]="id('form')" class="rounded-xl border border-acero/70 bg-white/70 p-4" novalidate [attr.aria-labelledby]="id('titulo')" (submit)="guardar($event)">
      <p role="heading" [attr.aria-level]="nivelTitulo()" [id]="id('titulo')" class="font-bold">{{ titulo() }}</p>
      <div class="mt-3 grid gap-x-5 gap-y-4 md:grid-cols-2">
        <div>
          <label [for]="id('nombre')" class="mb-1.5 block text-sm font-medium">Nombre de la obra</label>
          <input [id]="id('nombre')" type="text" autocomplete="off" placeholder="Ej. Plaza Centro" class="campo h-11 px-3.5" [formField]="f.nombre" [attr.aria-invalid]="f.nombre().touched() && f.nombre().invalid()" [attr.aria-describedby]="id('nombre-error')" />
          <ui-field-error [campo]="f.nombre" [errorId]="id('nombre-error')" />
        </div>
        <div>
          <label [for]="id('municipio')" class="mb-1.5 block text-sm font-medium">Municipio y estado</label>
          <input [id]="id('municipio')" type="text" autocomplete="address-level2" placeholder="Ej. Cozumel, Q. Roo" class="campo h-11 px-3.5" [formField]="f.municipio" [attr.aria-invalid]="f.municipio().touched() && f.municipio().invalid()" [attr.aria-describedby]="id('municipio-error')" />
          <ui-field-error [campo]="f.municipio" [errorId]="id('municipio-error')" />
        </div>
        <div class="md:col-span-2">
          <label [for]="id('direccion')" class="mb-1.5 block text-sm font-medium">Dirección</label>
          <input [id]="id('direccion')" type="text" autocomplete="street-address" placeholder="Calle, número y colonia, o kilómetro de carretera" class="campo h-11 px-3.5" [formField]="f.direccion" [attr.aria-invalid]="f.direccion().touched() && f.direccion().invalid()" [attr.aria-describedby]="id('direccion-error')" />
          <ui-field-error [campo]="f.direccion" [errorId]="id('direccion-error')" />
        </div>
        <div class="md:col-span-2">
          <label [for]="id('referencias')" class="mb-1.5 block text-sm font-medium">Referencias para llegar <span class="font-normal text-texto-suave">(opcional)</span></label>
          <textarea [id]="id('referencias')" rows="2" placeholder="Entre qué calles, puntos de referencia, por dónde entra la olla…" class="campo px-3.5 py-2.5" [formField]="f.referencias"></textarea>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" [class]="botonSecundario + ' disabled:cursor-wait disabled:opacity-70'" [disabled]="buscando()" (click)="usarUbicacion()">
          <ui-icon [icono]="iconos.gps" [tamano]="18" [class.animate-pulse]="buscando()" />{{ buscando() ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual' }}
        </button>
        <p class="text-sm" aria-live="polite">
          @if (ubicacion(); as u) {
            <span class="font-medium text-correcto">Ubicación capturada ({{ u.lat | number: '1.5-5' }}, {{ u.lng | number: '1.5-5' }})</span>
            <a
              class="ml-2 inline-flex items-center gap-1 rounded font-semibold text-epico underline underline-offset-4 hover:text-epico-oscuro focus-visible:outline-2 focus-visible:outline-epico"
              [href]="'https://www.google.com/maps?q=' + u.lat + ',' + u.lng"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en el mapa<ui-icon [icono]="iconos.externo" [tamano]="14" /><span class="sr-only"> (se abre en otra pestaña)</span>
            </a>
          } @else if (errorUbicacion()) {
            <span class="text-critico">{{ errorUbicacion() }}</span>
          } @else {
            <span class="text-texto-suave">Recomendado si la obra no tiene dirección formal.</span>
          }
        </p>
      </div>
      @if (ubicacion(); as u) {
        <ui-mapa class="mt-3 h-56" [ubicacion]="u" [titulo]="'Vista previa de tu ubicación actual'" />
      }

      <fieldset class="mt-5 border-t border-acero/60 pt-4">
        <legend class="float-left mb-3 w-full font-bold">Responsable de la obra</legend>
        <div class="clear-both flex flex-wrap items-start gap-4">
          <app-avatar class="size-16 text-2xl" [nombre]="modelo().responsable || '?'" [foto]="modelo().foto" />
          <div class="min-w-0 flex-1 basis-60">
            <label [for]="id('responsable')" class="mb-1.5 block text-sm font-medium">Nombre del responsable</label>
            <input [id]="id('responsable')" type="text" autocomplete="name" placeholder="Ej. Ing. Mariana Pech" class="campo h-11 px-3.5" [formField]="f.responsable" [attr.aria-invalid]="f.responsable().touched() && f.responsable().invalid()" [attr.aria-describedby]="id('responsable-error')" />
            <ui-field-error [campo]="f.responsable" [errorId]="id('responsable-error')" />
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <label [class]="botonSecundario + ' cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-epico'">
                <ui-icon [icono]="iconos.foto" [tamano]="18" />{{ modelo().foto ? 'Cambiar foto' : 'Agregar foto' }}
                <input type="file" accept="image/*" class="sr-only" [attr.aria-describedby]="id('foto-ayuda')" (change)="elegirFoto($event)" />
              </label>
              @if (modelo().foto) {
                <button type="button" class="min-h-10 rounded text-sm font-semibold text-texto-suave underline underline-offset-4 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico" (click)="quitarFoto()">
                  Quitar foto
                </button>
              }
              <p [id]="id('foto-ayuda')" class="w-full text-xs" [class]="errorFoto() ? 'font-medium text-critico' : 'text-texto-suave'" aria-live="polite">
                {{ errorFoto() || 'Opcional. JPG o PNG de hasta ' + fotoMax + ' MB.' }}
              </p>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="mt-5 border-t border-acero/60 pt-4">
        <legend class="float-left mb-1 w-full font-bold">Contactos en obra</legend>
        <p class="clear-both mb-3 text-sm text-texto-suave">A quién llamamos para coordinar la entrega. Lada de México (+52) por defecto; puedes elegir otro país.</p>
        <ul class="space-y-3">
          @for (c of f.contactos; track $index; let i = $index) {
            <li class="grid gap-x-3 gap-y-2 rounded-xl bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-start">
              <div>
                <label [for]="id('contacto-' + i + '-nombre')" class="mb-1 block text-sm font-medium">Nombre<span class="sr-only"> del contacto {{ i + 1 }}</span></label>
                <input [id]="id('contacto-' + i + '-nombre')" type="text" autocomplete="off" class="campo h-11 px-3" [formField]="c.nombre" [attr.aria-invalid]="c.nombre().touched() && c.nombre().invalid()" [attr.aria-describedby]="id('contacto-' + i + '-nombre-error')" />
                <ui-field-error [campo]="c.nombre" [errorId]="id('contacto-' + i + '-nombre-error')" />
              </div>
              <div>
                <span [id]="id('contacto-' + i + '-tel')" class="mb-1 block text-sm font-medium">Teléfono<span class="sr-only"> del contacto {{ i + 1 }}</span></span>
                <div class="flex gap-2">
                  <div class="relative w-36 shrink-0">
                    <select class="campo h-11 appearance-none pr-7 pl-3" [formField]="c.lada" [attr.aria-label]="'Lada del contacto ' + (i + 1)">
                      @for (l of ladas; track l.lada + l.pais) {
                        <option [value]="l.lada">{{ l.lada }} {{ l.pais }}</option>
                      }
                    </select>
                    <ui-icon [icono]="iconos.abrir" [tamano]="16" class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-texto-suave" />
                  </div>
                  <input
                    [id]="id('contacto-' + i + '-numero')"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel-national"
                    placeholder="987 123 4567"
                    class="campo h-11 min-w-0 px-3"
                    [formField]="c.numero"
                    [attr.aria-labelledby]="id('contacto-' + i + '-tel')"
                    [attr.aria-invalid]="c.numero().touched() && c.numero().invalid()"
                    [attr.aria-describedby]="id('contacto-' + i + '-numero-error')"
                  />
                </div>
                <ui-field-error [campo]="c.numero" [errorId]="id('contacto-' + i + '-numero-error')" />
              </div>
              <button
                type="button"
                class="flex size-11 items-center justify-center self-end rounded-lg text-texto-suave hover:bg-carbon/5 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico disabled:opacity-40 disabled:hover:bg-transparent sm:mt-6 sm:self-start"
                [attr.aria-label]="'Quitar contacto ' + (i + 1)"
                [disabled]="modelo().contactos.length === 1"
                (click)="quitarContacto(i)"
              >
                <ui-icon [icono]="iconos.quitar" [tamano]="18" />
              </button>
            </li>
          }
        </ul>
        <button type="button" [class]="botonSecundario + ' mt-3'" (click)="agregarContacto()">
          <ui-icon [icono]="iconos.agregar" [tamano]="18" />Agregar contacto
        </button>
      </fieldset>

      <div class="mt-5 flex flex-wrap justify-end gap-3">
        @if (cancelable()) {
          <button type="button" [class]="botonSecundario + ' h-11'" (click)="cancelada.emit()">Cancelar</button>
        }
        <button type="submit" class="boton-primario h-11 w-auto px-5">
          <ui-icon [icono]="iconos.check" [tamano]="18" />{{ textoGuardar() }}
        </button>
      </div>
    </form>
  `,
})
export class ObraForm {
  /** Obra a editar; null para una nueva. */
  readonly inicial = input<Obra | null>(null);
  /** Prefijo de los ids (únicos aunque haya dos formularios en la página). */
  readonly prefijo = input('obra');
  readonly titulo = input('Nueva obra');
  /** Nivel del título según dónde se use (h2 en una página, h3 dentro de una sección). */
  readonly nivelTitulo = input(3);
  readonly textoGuardar = input('Guardar obra');
  readonly cancelable = input(false);
  readonly guardada = output<NuevaObra>();
  readonly cancelada = output<void>();

  private readonly injector = inject(Injector);
  protected readonly iconos = { gps: LocateFixed, externo: ExternalLink, check: Check, foto: Camera, agregar: Plus, quitar: Trash2, abrir: ChevronDown };
  protected readonly ladas = LADAS;
  protected readonly fotoMax = FOTO_MAX_MB;
  protected readonly botonSecundario =
    'flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly modelo = linkedSignal(() => aModelo(this.inicial()));
  protected readonly ubicacion = linkedSignal<UbicacionGps | null>(() => this.inicial()?.ubicacion ?? null);
  protected readonly buscando = signal(false);
  protected readonly errorUbicacion = signal('');
  protected readonly errorFoto = signal('');

  protected readonly f = form(this.modelo, (p) => {
    required(p.nombre, { message: 'Escribe el nombre de la obra.' });
    required(p.municipio, { message: 'Indica el municipio y estado.' });
    required(p.direccion, { message: 'Escribe la dirección o el kilómetro de carretera.' });
    required(p.responsable, { message: 'Escribe el nombre del responsable de la obra.' });
    applyEach(p.contactos, (c) => {
      required(c.nombre, { message: 'Escribe el nombre del contacto.' });
      validate(c.numero, ({ value, valueOf }) => {
        const error = validarTelefono(valueOf(c.lada), value());
        return error ? { kind: 'telefono', message: error } : undefined;
      });
    });
  });

  protected id(sufijo: string): string {
    return `${this.prefijo()}-${sufijo}`;
  }

  /** Enfoca el primer campo (al abrir el formulario). */
  enfocar(): void {
    afterNextRender(() => document.getElementById(this.id('nombre'))?.focus(), { injector: this.injector });
  }

  protected agregarContacto(): void {
    this.modelo.update((m) => ({ ...m, contactos: [...m.contactos, contactoVacio()] }));
    const i = this.modelo().contactos.length - 1;
    afterNextRender(() => document.getElementById(this.id(`contacto-${i}-nombre`))?.focus(), { injector: this.injector });
  }

  protected quitarContacto(i: number): void {
    this.modelo.update((m) => ({ ...m, contactos: m.contactos.filter((_, j) => j !== i) }));
  }

  protected elegirFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) return this.errorFoto.set('El archivo debe ser una imagen.');
    if (archivo.size > FOTO_MAX_MB * 1024 * 1024) return this.errorFoto.set(`La foto pesa más de ${FOTO_MAX_MB} MB. Elige una más ligera.`);
    this.errorFoto.set('');
    // shortcut: la foto se guarda como data URL en memoria; al conectar el backend, subirla y guardar su URL.
    const lector = new FileReader();
    lector.onload = () => this.modelo.update((m) => ({ ...m, foto: String(lector.result) }));
    lector.readAsDataURL(archivo);
  }

  protected quitarFoto(): void {
    this.modelo.update((m) => ({ ...m, foto: '' }));
  }

  protected usarUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.errorUbicacion.set('Tu navegador no permite obtener la ubicación. Escribe la dirección y referencias.');
      return;
    }
    this.buscando.set(true);
    this.errorUbicacion.set('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.buscando.set(false);
        this.ubicacion.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        this.buscando.set(false);
        this.errorUbicacion.set(
          err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Puedes activarlo en tu navegador o escribir la dirección.'
            : 'No pudimos obtener tu ubicación. Intenta de nuevo o escribe la dirección.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  protected async guardar(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      const m = this.modelo();
      this.guardada.emit({
        nombre: m.nombre,
        municipio: m.municipio,
        direccion: m.direccion,
        referencias: m.referencias,
        ubicacion: this.ubicacion() ?? undefined,
        responsable: { nombre: m.responsable, foto: m.foto || undefined },
        contactos: m.contactos,
      });
      if (!this.inicial()) {
        this.modelo.set(aModelo(null));
        this.ubicacion.set(null);
      }
      return undefined;
    });
    // Foco al primer campo con error, en el orden de la página.
    const campos: [string, boolean][] = [
      ['nombre', this.f.nombre().invalid()],
      ['municipio', this.f.municipio().invalid()],
      ['direccion', this.f.direccion().invalid()],
      ['responsable', this.f.responsable().invalid()],
      ...this.modelo().contactos.flatMap((_, i): [string, boolean][] => [
        [`contacto-${i}-nombre`, this.f.contactos[i].nombre().invalid()],
        [`contacto-${i}-numero`, this.f.contactos[i].numero().invalid()],
      ]),
    ];
    const primero = campos.find(([, invalido]) => invalido);
    if (primero) document.getElementById(this.id(primero[0]))?.focus();
  }
}
