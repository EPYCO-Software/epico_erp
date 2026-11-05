import { Component, ElementRef, Injector, OnInit, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormField, applyEach, email, form, required, submit, validate } from '@angular/forms/signals';
import { Plus, Trash2 } from 'lucide';
import { Cliente, FieldError, Icon, rfcValido } from 'ui';
import { CambiosCliente } from './datos';

const RFC = { kind: 'rfc', message: 'Escribe un RFC válido de 12 o 13 caracteres.' };
const TELEFONO = { kind: 'telefono', message: 'Escribe un teléfono de 10 dígitos.' };

/**
 * Editar un cliente (en la vista previa o en la vista completa): los mismos datos que captura en el portal (contacto y
 * empresa de Mi perfil, receptores de Facturación) con las mismas reglas de RFC, código postal y correo. Obligatorio
 * solo lo que el ERP necesita: nombre, razón social, RFC y lo de cada receptor (el de mostrador no tiene contacto).
 */
@Component({
  selector: 'app-editor-cliente',
  imports: [FieldError, FormField, Icon, NgTemplateOutlet],
  host: { class: '@container block' },
  template: `
    <ng-template #campo let-c let-id="id" let-etiqueta="etiqueta" let-tipo="tipo" let-auto="auto" let-ancho="ancho">
      <div [class]="ancho ? '@lg:col-span-2' : ''">
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

    <form id="editor-cliente" novalidate aria-labelledby="editar-cliente-titulo" (submit)="guardar($event)">
      <p id="editar-cliente-titulo" class="font-bold">Editar cliente</p>

      <fieldset class="mt-4">
        <legend [class]="titulo">Contacto</legend>
        <div class="grid gap-3 @lg:grid-cols-2">
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.contacto.nombre, id: 'cliente-contacto-nombre', etiqueta: 'Nombre' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.contacto.apellidos, id: 'cliente-contacto-apellidos', etiqueta: 'Apellidos' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.contacto.puesto, id: 'cliente-contacto-puesto', etiqueta: 'Puesto' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.contacto.correo, id: 'cliente-contacto-correo', etiqueta: 'Correo', tipo: 'email' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.contacto.telefono, id: 'cliente-contacto-telefono', etiqueta: 'Teléfono', tipo: 'tel' }" />
        </div>
      </fieldset>

      <fieldset class="mt-5">
        <legend [class]="titulo">Empresa</legend>
        <div class="grid gap-3 @lg:grid-cols-2">
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.nombre, id: 'cliente-nombre', etiqueta: 'Nombre comercial' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.razonSocial, id: 'cliente-razon-social', etiqueta: 'Razón social' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.rfc, id: 'cliente-rfc', etiqueta: 'RFC' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.giro, id: 'cliente-giro', etiqueta: 'Giro' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.correo, id: 'cliente-correo', etiqueta: 'Correo', tipo: 'email' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.telefono, id: 'cliente-telefono', etiqueta: 'Teléfono', tipo: 'tel' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.sitioWeb, id: 'cliente-sitio', etiqueta: 'Sitio web' }" />
          <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.empresa.domicilioFiscal, id: 'cliente-domicilio', etiqueta: 'Domicilio fiscal', ancho: true }" />
        </div>
      </fieldset>

      <fieldset class="mt-5">
        <legend [class]="titulo">Facturación</legend>
        <ul class="space-y-3">
          @for (r of modelo().facturacion; track r.id; let i = $index) {
            <li class="rounded-xl bg-white/80 p-3">
              <div class="mb-2 flex items-center justify-between gap-3">
                <label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="cliente-predeterminado"
                    class="casilla"
                    [checked]="r.predeterminado"
                    (change)="predeterminar(i)"
                  />
                  Predeterminado
                </label>
                <button
                  type="button"
                  class="flex size-9 items-center justify-center rounded-lg text-texto-suave transition-colors hover:bg-critico/10 hover:text-critico focus-visible:outline-2 focus-visible:outline-epico"
                  [attr.aria-label]="'Quitar los datos de facturación ' + (r.alias || (i + 1))"
                  (click)="quitar(i)"
                >
                  <ui-icon [icono]="iconos.quitar" [tamano]="17" />
                </button>
              </div>
              <div class="grid gap-3 @lg:grid-cols-2">
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].alias, id: 'cliente-fact-' + i + '-alias', etiqueta: 'Alias' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].razonSocial, id: 'cliente-fact-' + i + '-razon', etiqueta: 'Razón social' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].rfc, id: 'cliente-fact-' + i + '-rfc', etiqueta: 'RFC' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].regimenFiscal, id: 'cliente-fact-' + i + '-regimen', etiqueta: 'Régimen fiscal' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].codigoPostal, id: 'cliente-fact-' + i + '-cp', etiqueta: 'Código postal' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].usoCfdi, id: 'cliente-fact-' + i + '-uso', etiqueta: 'Uso de CFDI' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].correo, id: 'cliente-fact-' + i + '-correo', etiqueta: 'Correo de facturas', tipo: 'email' }" />
                <ng-container *ngTemplateOutlet="campo; context: { $implicit: f.facturacion[i].direccionFiscal, id: 'cliente-fact-' + i + '-direccion', etiqueta: 'Dirección fiscal', ancho: true }" />
              </div>
            </li>
          } @empty {
            <li class="text-sm text-texto-suave">Sin datos de facturación.</li>
          }
        </ul>
        <button #botonAgregar type="button" [class]="botonTexto + ' mt-2'" (click)="agregar()">
          <ui-icon [icono]="iconos.agregar" [tamano]="17" />Agregar datos de facturación
        </button>
      </fieldset>

      <div class="mt-5 flex flex-wrap gap-2">
        <button type="submit" class="boton-primario h-10 w-auto px-4 text-sm">Guardar cambios</button>
        <button type="button" [class]="botonSecundario" (click)="descartar.emit()">Descartar</button>
      </div>
    </form>
  `,
})
export class EditorCliente implements OnInit {
  private readonly injector = inject(Injector);

  readonly c = input.required<Cliente>();
  readonly listo = output<CambiosCliente>();
  readonly descartar = output();

  protected readonly iconos = { quitar: Trash2, agregar: Plus };
  protected readonly titulo = 'mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly botonSecundario =
    'inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonTexto =
    'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-epico-oscuro transition-colors hover:bg-epico/5 focus-visible:outline-2 focus-visible:outline-epico';

  protected readonly modelo = signal<CambiosCliente>({
    nombre: '',
    empresa: { razonSocial: '', nombreComercial: '', rfc: '', giro: '', correo: '', telefono: '', sitioWeb: '', domicilioFiscal: '', cargoRepresentante: '' },
    contacto: { nombre: '', apellidos: '', correo: '', telefono: '', puesto: '' },
    facturacion: [],
  });
  protected readonly f = form(this.modelo, (m) => {
    const rfc = ({ value }: { value: () => string }) => (!value() || rfcValido(value()) ? undefined : RFC);
    const telefono = ({ value }: { value: () => string }) =>
      !value() || /^\d{10}$/.test(value().replace(/\D/g, '')) ? undefined : TELEFONO;
    required(m.nombre, { message: 'Escribe el nombre comercial.' });
    required(m.empresa.razonSocial, { message: 'Escribe la razón social.' });
    required(m.empresa.rfc, { message: 'Escribe el RFC.' });
    validate(m.empresa.rfc, rfc);
    email(m.empresa.correo, { message: 'Escribe un correo válido.' });
    validate(m.empresa.telefono, telefono);
    email(m.contacto.correo, { message: 'Escribe un correo válido.' });
    validate(m.contacto.telefono, telefono);
    applyEach(m.facturacion, (r) => {
      required(r.alias, { message: 'Escribe un nombre para identificar estos datos.' });
      required(r.razonSocial, { message: 'Escribe la razón social.' });
      required(r.rfc, { message: 'Escribe el RFC.' });
      validate(r.rfc, rfc);
      required(r.regimenFiscal, { message: 'Indica el régimen fiscal.' });
      required(r.codigoPostal, { message: 'Escribe el código postal fiscal.' });
      validate(r.codigoPostal, ({ value }) =>
        /^\d{5}$/.test(value().replace(/\D/g, '')) ? undefined : { kind: 'cp', message: 'El código postal tiene 5 dígitos.' },
      );
      required(r.usoCfdi, { message: 'Indica el uso del CFDI.' });
      email(r.correo, { message: 'Escribe un correo válido.' });
    });
  });

  private readonly botonAgregar = viewChild<ElementRef<HTMLButtonElement>>('botonAgregar');
  private inicial = '';
  /** Hay algo distinto de lo guardado (quien lo usa pregunta antes de tirarlo). */
  readonly sinGuardar = computed(() => JSON.stringify(this.modelo()) !== this.inicial);

  ngOnInit(): void {
    const c = this.c();
    this.modelo.set({
      nombre: c.nombre,
      empresa: { ...c.empresa },
      contacto: { ...c.contacto },
      facturacion: c.facturacion.map((r) => ({ ...r })),
    });
    this.inicial = JSON.stringify(this.modelo());
    this.enfocar('#cliente-contacto-nombre');
  }

  protected predeterminar(i: number): void {
    this.modelo.update((m) => ({ ...m, facturacion: m.facturacion.map((r, j) => ({ ...r, predeterminado: j === i })) }));
  }

  /** Parte de los datos de su empresa; si es el único, queda como predeterminado. */
  protected agregar(): void {
    const { empresa, facturacion } = this.modelo();
    this.modelo.update((m) => ({
      ...m,
      facturacion: [
        ...m.facturacion,
        {
          id: 'f-' + crypto.randomUUID(),
          alias: '',
          razonSocial: empresa.razonSocial,
          rfc: empresa.rfc,
          regimenFiscal: '',
          codigoPostal: '',
          usoCfdi: 'G03 · Gastos en general',
          correo: '',
          direccionFiscal: empresa.domicilioFiscal,
          predeterminado: facturacion.length === 0,
          documentos: [],
        },
      ],
    }));
    this.enfocar(`#cliente-fact-${facturacion.length}-alias`);
  }

  /** Si se quita el predeterminado, el primero que quede pasa a serlo. El foco va a "Agregar…". */
  protected quitar(i: number): void {
    this.modelo.update((m) => {
      const resto = m.facturacion.filter((_, j) => j !== i);
      if (resto.length && !resto.some((r) => r.predeterminado)) resto[0] = { ...resto[0], predeterminado: true };
      return { ...m, facturacion: resto };
    });
    afterNextRender(() => this.botonAgregar()?.nativeElement.focus(), { injector: this.injector });
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const valido = await submit(this.f, async () => {
      this.listo.emit(this.modelo());
      return undefined;
    });
    // Al enviar inválido, el foco va al primer campo con error.
    if (!valido) this.enfocar('#editor-cliente [aria-invalid="true"]');
  }

  private enfocar(selector: string): void {
    afterNextRender(() => document.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }
}
