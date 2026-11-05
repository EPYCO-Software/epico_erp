import { Component, input, linkedSignal, output } from '@angular/core';
import { FormField, email, form, required, submit, validate } from '@angular/forms/signals';
import { Check } from 'lucide';
import { DatosFacturacion, DatosFacturacionEntrada, FieldError, Icon, rfcValido } from 'ui';

let siguienteId = 0;

const vacio = (): DatosFacturacionEntrada => ({
  alias: '',
  razonSocial: '',
  rfc: '',
  regimenFiscal: '',
  codigoPostal: '',
  usoCfdi: '',
  correo: '',
  direccionFiscal: '',
  predeterminado: false,
});

const aModelo = (datos: DatosFacturacion | null): DatosFacturacionEntrada =>
  datos
    ? {
        alias: datos.alias,
        razonSocial: datos.razonSocial,
        rfc: datos.rfc,
        regimenFiscal: datos.regimenFiscal,
        codigoPostal: datos.codigoPostal,
        usoCfdi: datos.usoCfdi,
        correo: datos.correo,
        direccionFiscal: datos.direccionFiscal,
        predeterminado: datos.predeterminado,
      }
    : vacio();

@Component({
  selector: 'app-facturacion-form',
  imports: [FieldError, FormField, Icon],
  template: `
    <form novalidate (submit)="guardar($event)">
      <div class="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div>
          <label [for]="id('alias')" class="mb-1.5 block text-sm font-medium"
            >Nombre para identificarla</label
          >
          <input
            [id]="id('alias')"
            type="text"
            autocomplete="off"
            placeholder="Ej. Constructora Delta"
            class="campo h-11 px-3.5"
            [formField]="f.alias"
            [attr.aria-invalid]="f.alias().touched() && f.alias().invalid()"
            [attr.aria-describedby]="id('alias-error')"
          />
          <ui-field-error [campo]="f.alias" [errorId]="id('alias-error')" />
        </div>

        <div>
          <label [for]="id('rfc')" class="mb-1.5 block text-sm font-medium">RFC</label>
          <input
            [id]="id('rfc')"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            placeholder="ABC010101AA1"
            class="campo h-11 px-3.5 uppercase"
            [formField]="f.rfc"
            [attr.aria-invalid]="f.rfc().touched() && f.rfc().invalid()"
            [attr.aria-describedby]="id('rfc-error')"
          />
          <ui-field-error [campo]="f.rfc" [errorId]="id('rfc-error')" />
        </div>

        <div class="sm:col-span-2">
          <label [for]="id('razon')" class="mb-1.5 block text-sm font-medium"
            >Nombre o razón social</label
          >
          <input
            [id]="id('razon')"
            type="text"
            autocomplete="organization"
            placeholder="Nombre fiscal tal como aparece en la constancia"
            class="campo h-11 px-3.5"
            [formField]="f.razonSocial"
            [attr.aria-invalid]="f.razonSocial().touched() && f.razonSocial().invalid()"
            [attr.aria-describedby]="id('razon-error')"
          />
          <ui-field-error [campo]="f.razonSocial" [errorId]="id('razon-error')" />
        </div>

        <div>
          <label [for]="id('regimen')" class="mb-1.5 block text-sm font-medium"
            >Régimen fiscal</label
          >
          <input
            [id]="id('regimen')"
            type="text"
            autocomplete="off"
            placeholder="Ej. 601 · General de Ley"
            class="campo h-11 px-3.5"
            [formField]="f.regimenFiscal"
            [attr.aria-invalid]="f.regimenFiscal().touched() && f.regimenFiscal().invalid()"
            [attr.aria-describedby]="id('regimen-error')"
          />
          <ui-field-error [campo]="f.regimenFiscal" [errorId]="id('regimen-error')" />
        </div>

        <div>
          <label [for]="id('cp')" class="mb-1.5 block text-sm font-medium"
            >Código postal fiscal</label
          >
          <input
            [id]="id('cp')"
            type="text"
            inputmode="numeric"
            autocomplete="postal-code"
            placeholder="00000"
            class="campo h-11 px-3.5"
            [formField]="f.codigoPostal"
            [attr.aria-invalid]="f.codigoPostal().touched() && f.codigoPostal().invalid()"
            [attr.aria-describedby]="id('cp-error')"
          />
          <ui-field-error [campo]="f.codigoPostal" [errorId]="id('cp-error')" />
        </div>

        <div>
          <label [for]="id('uso')" class="mb-1.5 block text-sm font-medium">Uso del CFDI</label>
          <input
            [id]="id('uso')"
            type="text"
            autocomplete="off"
            placeholder="Ej. G03 · Gastos en general"
            class="campo h-11 px-3.5"
            [formField]="f.usoCfdi"
            [attr.aria-invalid]="f.usoCfdi().touched() && f.usoCfdi().invalid()"
            [attr.aria-describedby]="id('uso-error')"
          />
          <ui-field-error [campo]="f.usoCfdi" [errorId]="id('uso-error')" />
        </div>

        <div>
          <label [for]="id('correo')" class="mb-1.5 block text-sm font-medium"
            >Correo para facturas</label
          >
          <input
            [id]="id('correo')"
            type="email"
            autocomplete="email"
            placeholder="facturas@empresa.com"
            class="campo h-11 px-3.5"
            [formField]="f.correo"
            [attr.aria-invalid]="f.correo().touched() && f.correo().invalid()"
            [attr.aria-describedby]="id('correo-error')"
          />
          <ui-field-error [campo]="f.correo" [errorId]="id('correo-error')" />
        </div>

        <div class="sm:col-span-2">
          <label [for]="id('direccion')" class="mb-1.5 block text-sm font-medium">
            Domicilio fiscal <span class="font-normal text-texto-suave">(opcional)</span>
          </label>
          <textarea
            [id]="id('direccion')"
            rows="2"
            autocomplete="street-address"
            placeholder="Calle, número, colonia, municipio y estado"
            class="campo px-3.5 py-2.5"
            [formField]="f.direccionFiscal"
          ></textarea>
        </div>
      </div>

      <label
        class="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white/60 px-3.5 py-2.5"
      >
        <input type="checkbox" class="casilla" [formField]="f.predeterminado" />
        <span>
          <span class="block text-sm font-semibold">Usar como datos predeterminados</span>
          <span class="block text-xs text-texto-suave"
            >Se propondrán primero al solicitar una factura.</span
          >
        </span>
      </label>

      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          class="h-11 rounded-[0.625rem] border border-acero-oscuro bg-white px-4 font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
          (click)="cancelada.emit()"
        >
          Cancelar
        </button>
        <button type="submit" class="boton-primario h-11 w-auto px-5">
          <ui-icon [icono]="iconoGuardar" [tamano]="18" />Guardar datos fiscales
        </button>
      </div>
    </form>
  `,
})
export class FacturacionForm {
  readonly inicial = input<DatosFacturacion | null>(null);
  readonly guardada = output<DatosFacturacionEntrada>();
  readonly cancelada = output<void>();

  private readonly prefijo = `facturacion-${siguienteId++}`;
  protected readonly iconoGuardar = Check;
  protected readonly modelo = linkedSignal(() => aModelo(this.inicial()));
  protected readonly f = form(this.modelo, (p) => {
    required(p.alias, { message: 'Escribe un nombre para identificar estos datos.' });
    required(p.razonSocial, { message: 'Escribe el nombre o razón social.' });
    required(p.rfc, { message: 'Escribe el RFC.' });
    validate(p.rfc, ({ value }) =>
      rfcValido(value())
        ? undefined
        : { kind: 'rfc', message: 'Escribe un RFC válido de 12 o 13 caracteres.' },
    );
    required(p.regimenFiscal, { message: 'Indica el régimen fiscal.' });
    required(p.codigoPostal, { message: 'Escribe el código postal fiscal.' });
    validate(p.codigoPostal, ({ value }) =>
      /^\d{5}$/.test(value().replace(/\D/g, ''))
        ? undefined
        : { kind: 'cp', message: 'El código postal debe tener 5 dígitos.' },
    );
    required(p.usoCfdi, { message: 'Indica el uso del CFDI.' });
    required(p.correo, { message: 'Escribe el correo que recibirá las facturas.' });
    email(p.correo, { message: 'Escribe un correo válido.' });
  });

  protected id(campo: string): string {
    return `${this.prefijo}-${campo}`;
  }

  protected async guardar(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      this.guardada.emit(this.modelo());
      return undefined;
    });
  }
}
