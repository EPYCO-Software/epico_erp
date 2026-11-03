import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  applyWhen,
  email,
  form,
  required,
  schema,
  submit,
  validate,
} from '@angular/forms/signals';
import { Building2, Check, PencilLine, Plus, ReceiptText, Star, UserRound } from 'lucide';
import { FieldError, Icon, PageHeader } from 'ui';
import {
  DatosFacturacionEntrada,
  DatosEmpresaRepresentada,
  PerfilService,
  PerfilUsuario,
} from '../../core/services/perfil.service';
import { DocumentosFiscales } from './documentos-fiscales';
import { FacturacionForm } from './facturacion-form';

type SeccionPerfil = 'informacion' | 'facturacion';

const empresaSchema = schema<DatosEmpresaRepresentada>((p) => {
  required(p.razonSocial, { message: 'Escribe la razón social de la empresa.' });
  required(p.rfc, { message: 'Escribe el RFC de la empresa.' });
  validate(p.rfc, ({ value }) =>
    /^[A-Za-zÑñ&]{3,4}\d{6}[A-Za-z\d]{3}$/.test(value().replace(/\s/g, ''))
      ? undefined
      : { kind: 'rfc', message: 'Escribe un RFC válido de 12 o 13 caracteres.' },
  );
  required(p.giro, { message: 'Indica el giro o actividad de la empresa.' });
  required(p.correo, { message: 'Escribe el correo de la empresa.' });
  email(p.correo, { message: 'Escribe un correo empresarial válido.' });
  required(p.telefono, { message: 'Escribe el teléfono de la empresa.' });
  required(p.domicilioFiscal, { message: 'Escribe el domicilio fiscal de la empresa.' });
  required(p.cargoRepresentante, { message: 'Indica tu cargo o relación con la empresa.' });
});

@Component({
  selector: 'app-perfil',
  imports: [DocumentosFiscales, FacturacionForm, FieldError, FormField, Icon, PageHeader],
  template: `
    <ui-page-header
      title="Perfil"
      subtitle="Tu información y los datos que utilizas para facturar"
    />

    <nav
      aria-label="Secciones del perfil"
      class="mb-5 flex w-fit rounded-xl border border-white/80 bg-white/65 p-1 shadow-sm shadow-carbon/5"
    >
      <button
        type="button"
        class="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico"
        [class]="
          seccion() === 'informacion'
            ? 'bg-carbon text-white'
            : 'text-texto-suave hover:bg-carbon/5 hover:text-carbon'
        "
        [attr.aria-current]="seccion() === 'informacion' ? 'page' : null"
        (click)="seccion.set('informacion')"
      >
        <ui-icon [icono]="iconos.usuario" [tamano]="17" />Información personal
      </button>
      <button
        type="button"
        class="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-epico"
        [class]="
          seccion() === 'facturacion'
            ? 'bg-carbon text-white'
            : 'text-texto-suave hover:bg-carbon/5 hover:text-carbon'
        "
        [attr.aria-current]="seccion() === 'facturacion' ? 'page' : null"
        (click)="seccion.set('facturacion')"
      >
        <ui-icon [icono]="iconos.factura" [tamano]="17" />Facturación
      </button>
    </nav>

    <p class="sr-only" aria-live="polite">{{ mensaje() }}</p>

    @if (seccion() === 'informacion') {
      <section aria-labelledby="informacion-titulo" class="glass max-w-4xl p-4 sm:p-6">
        <div class="mb-5">
          <h2 id="informacion-titulo" class="text-lg font-bold">Información personal</h2>
          <p class="mt-1 text-sm text-texto-suave">
            Estos datos identifican a la persona que gestiona pedidos y entregas.
          </p>
        </div>

        <form novalidate (submit)="guardarUsuario($event)">
          <div class="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <label for="perfil-nombre" class="mb-1.5 block text-sm font-medium">Nombre</label>
              <input
                id="perfil-nombre"
                type="text"
                autocomplete="given-name"
                class="campo h-11 px-3.5"
                [formField]="f.nombre"
                [attr.aria-invalid]="f.nombre().touched() && f.nombre().invalid()"
                aria-describedby="perfil-nombre-error"
              />
              <ui-field-error [campo]="f.nombre" errorId="perfil-nombre-error" />
            </div>
            <div>
              <label for="perfil-apellidos" class="mb-1.5 block text-sm font-medium"
                >Apellidos</label
              >
              <input
                id="perfil-apellidos"
                type="text"
                autocomplete="family-name"
                class="campo h-11 px-3.5"
                [formField]="f.apellidos"
                [attr.aria-invalid]="f.apellidos().touched() && f.apellidos().invalid()"
                aria-describedby="perfil-apellidos-error"
              />
              <ui-field-error [campo]="f.apellidos" errorId="perfil-apellidos-error" />
            </div>
            <div>
              <label for="perfil-correo" class="mb-1.5 block text-sm font-medium"
                >Correo electrónico</label
              >
              <input
                id="perfil-correo"
                type="email"
                autocomplete="email"
                class="campo h-11 px-3.5"
                [formField]="f.correo"
                [attr.aria-invalid]="f.correo().touched() && f.correo().invalid()"
                aria-describedby="perfil-correo-error"
              />
              <ui-field-error [campo]="f.correo" errorId="perfil-correo-error" />
            </div>
            <div>
              <label for="perfil-telefono" class="mb-1.5 block text-sm font-medium">Teléfono</label>
              <input
                id="perfil-telefono"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="+52 987 123 4567"
                class="campo h-11 px-3.5"
                [formField]="f.telefono"
                [attr.aria-invalid]="f.telefono().touched() && f.telefono().invalid()"
                aria-describedby="perfil-telefono-error"
              />
              <ui-field-error [campo]="f.telefono" errorId="perfil-telefono-error" />
            </div>
            <div class="sm:col-span-2">
              <label for="perfil-puesto" class="mb-1.5 block text-sm font-medium">
                Puesto o área <span class="font-normal text-texto-suave">(opcional)</span>
              </label>
              <input
                id="perfil-puesto"
                type="text"
                autocomplete="organization-title"
                placeholder="Ej. Compras"
                class="campo h-11 px-3.5"
                [formField]="f.puesto"
              />
            </div>
          </div>

          <div class="mt-6 border-t border-acero/45 pt-5">
            <label class="flex cursor-pointer items-start gap-3 rounded-xl bg-white/55 px-4 py-3.5">
              <input type="checkbox" class="casilla mt-0.5" [formField]="f.representaEmpresa" />
              <span>
                <span class="block text-sm font-semibold">Represento a una empresa</span>
                <span class="mt-0.5 block text-xs leading-5 text-texto-suave">
                  Actívalo si gestionas pedidos en nombre de una empresa u organización.
                </span>
              </span>
            </label>

            @if (modelo().representaEmpresa) {
              <section aria-labelledby="empresa-titulo" class="mt-5">
                <div class="mb-4">
                  <h3 id="empresa-titulo" class="font-bold">Datos de la empresa</h3>
                  <p class="mt-1 text-sm text-texto-suave">
                    Usaremos esta información para identificarla y mantener el contacto comercial.
                  </p>
                </div>

                <div class="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label for="empresa-razon" class="mb-1.5 block text-sm font-medium"
                      >Razón social</label
                    >
                    <input
                      id="empresa-razon"
                      type="text"
                      autocomplete="organization"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.razonSocial"
                      [attr.aria-invalid]="
                        f.empresa.razonSocial().touched() && f.empresa.razonSocial().invalid()
                      "
                      aria-describedby="empresa-razon-error"
                    />
                    <ui-field-error [campo]="f.empresa.razonSocial" errorId="empresa-razon-error" />
                  </div>
                  <div>
                    <label for="empresa-comercial" class="mb-1.5 block text-sm font-medium">
                      Nombre comercial
                      <span class="font-normal text-texto-suave">(opcional)</span>
                    </label>
                    <input
                      id="empresa-comercial"
                      type="text"
                      autocomplete="off"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.nombreComercial"
                    />
                  </div>
                  <div>
                    <label for="empresa-rfc" class="mb-1.5 block text-sm font-medium">RFC</label>
                    <input
                      id="empresa-rfc"
                      type="text"
                      autocapitalize="characters"
                      class="campo h-11 px-3.5 uppercase"
                      [formField]="f.empresa.rfc"
                      [attr.aria-invalid]="f.empresa.rfc().touched() && f.empresa.rfc().invalid()"
                      aria-describedby="empresa-rfc-error"
                    />
                    <ui-field-error [campo]="f.empresa.rfc" errorId="empresa-rfc-error" />
                  </div>
                  <div>
                    <label for="empresa-giro" class="mb-1.5 block text-sm font-medium"
                      >Giro o actividad</label
                    >
                    <input
                      id="empresa-giro"
                      type="text"
                      placeholder="Ej. Construcción y obra civil"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.giro"
                      [attr.aria-invalid]="f.empresa.giro().touched() && f.empresa.giro().invalid()"
                      aria-describedby="empresa-giro-error"
                    />
                    <ui-field-error [campo]="f.empresa.giro" errorId="empresa-giro-error" />
                  </div>
                  <div>
                    <label for="empresa-correo" class="mb-1.5 block text-sm font-medium"
                      >Correo de la empresa</label
                    >
                    <input
                      id="empresa-correo"
                      type="email"
                      autocomplete="work email"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.correo"
                      [attr.aria-invalid]="
                        f.empresa.correo().touched() && f.empresa.correo().invalid()
                      "
                      aria-describedby="empresa-correo-error"
                    />
                    <ui-field-error [campo]="f.empresa.correo" errorId="empresa-correo-error" />
                  </div>
                  <div>
                    <label for="empresa-telefono" class="mb-1.5 block text-sm font-medium"
                      >Teléfono de la empresa</label
                    >
                    <input
                      id="empresa-telefono"
                      type="tel"
                      inputmode="tel"
                      autocomplete="work tel"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.telefono"
                      [attr.aria-invalid]="
                        f.empresa.telefono().touched() && f.empresa.telefono().invalid()
                      "
                      aria-describedby="empresa-telefono-error"
                    />
                    <ui-field-error [campo]="f.empresa.telefono" errorId="empresa-telefono-error" />
                  </div>
                  <div>
                    <label for="empresa-cargo" class="mb-1.5 block text-sm font-medium"
                      >Tu cargo o relación</label
                    >
                    <input
                      id="empresa-cargo"
                      type="text"
                      autocomplete="organization-title"
                      placeholder="Ej. Representante legal, Compras"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.cargoRepresentante"
                      [attr.aria-invalid]="
                        f.empresa.cargoRepresentante().touched() &&
                        f.empresa.cargoRepresentante().invalid()
                      "
                      aria-describedby="empresa-cargo-error"
                    />
                    <ui-field-error
                      [campo]="f.empresa.cargoRepresentante"
                      errorId="empresa-cargo-error"
                    />
                  </div>
                  <div>
                    <label for="empresa-web" class="mb-1.5 block text-sm font-medium">
                      Sitio web <span class="font-normal text-texto-suave">(opcional)</span>
                    </label>
                    <input
                      id="empresa-web"
                      type="url"
                      inputmode="url"
                      autocomplete="url"
                      placeholder="https://empresa.com"
                      class="campo h-11 px-3.5"
                      [formField]="f.empresa.sitioWeb"
                    />
                  </div>
                  <div class="sm:col-span-2">
                    <label for="empresa-domicilio" class="mb-1.5 block text-sm font-medium"
                      >Domicilio fiscal</label
                    >
                    <textarea
                      id="empresa-domicilio"
                      rows="2"
                      autocomplete="street-address"
                      placeholder="Calle, número, colonia, municipio, estado y código postal"
                      class="campo px-3.5 py-2.5"
                      [formField]="f.empresa.domicilioFiscal"
                      [attr.aria-invalid]="
                        f.empresa.domicilioFiscal().touched() &&
                        f.empresa.domicilioFiscal().invalid()
                      "
                      aria-describedby="empresa-domicilio-error"
                    ></textarea>
                    <ui-field-error
                      [campo]="f.empresa.domicilioFiscal"
                      errorId="empresa-domicilio-error"
                    />
                  </div>
                </div>
              </section>
            }
          </div>

          <div class="mt-5 flex justify-end">
            <button type="submit" class="boton-primario h-11 w-auto px-5">
              <ui-icon [icono]="iconos.guardar" [tamano]="18" />Guardar información
            </button>
          </div>
        </form>
      </section>
    } @else {
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <section aria-labelledby="facturacion-titulo" class="glass overflow-hidden">
          <header
            class="flex flex-wrap items-center justify-between gap-3 border-b border-acero/40 px-4 py-4 sm:px-5"
          >
            <div>
              <h2 id="facturacion-titulo" class="text-lg font-bold">Datos de facturación</h2>
              <p class="mt-0.5 text-sm text-texto-suave">
                Guarda diferentes empresas o receptores y elige cuál utilizar en cada pedido.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-10 items-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico"
              (click)="nuevoFiscal()"
            >
              <ui-icon [icono]="iconos.agregar" [tamano]="17" />Agregar datos
            </button>
          </header>

          <ul class="divide-y divide-acero/40">
            @for (datos of facturacion(); track datos.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/55 focus-visible:bg-white/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-epico sm:px-5"
                  [class]="datos.id === fiscalSeleccionado()?.id ? 'bg-white/70' : ''"
                  [attr.aria-pressed]="datos.id === fiscalSeleccionado()?.id"
                  (click)="seleccionarFiscal(datos.id)"
                >
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-carbon text-white"
                  >
                    <ui-icon [icono]="iconos.empresa" [tamano]="19" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="truncate font-semibold">{{ datos.alias }}</span>
                      @if (datos.predeterminado) {
                        <span
                          class="inline-flex items-center gap-1 rounded-md bg-[#F8DADB] px-2 py-0.5 text-xs font-semibold text-epico-oscuro"
                        >
                          <ui-icon [icono]="iconos.estrella" [tamano]="12" />Predeterminado
                        </span>
                      }
                    </span>
                    <span class="mt-0.5 block truncate text-sm text-texto-suave"
                      >{{ datos.razonSocial }} · {{ datos.rfc }}</span
                    >
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>

        <aside class="glass p-4 sm:p-5 lg:sticky lg:top-24">
          @if (editandoFiscal()) {
            <h2 class="mb-1 text-lg font-bold">
              {{ idFiscalEdicion() ? 'Editar datos fiscales' : 'Nuevos datos fiscales' }}
            </h2>
            <p class="mb-4 text-sm text-texto-suave">
              Captura la información exactamente como aparece en la constancia fiscal.
            </p>
            <app-facturacion-form
              [inicial]="fiscalEdicion()"
              (guardada)="guardarFiscal($event)"
              (cancelada)="editandoFiscal.set(false)"
            />
          } @else if (fiscalSeleccionado(); as datos) {
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold">{{ datos.alias }}</h2>
                <p class="mt-0.5 text-sm text-texto-suave">{{ datos.razonSocial }}</p>
              </div>
              <button
                type="button"
                class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-acero-oscuro bg-white hover:border-carbon focus-visible:outline-2 focus-visible:outline-epico"
                aria-label="Editar datos fiscales"
                (click)="editarFiscal()"
              >
                <ui-icon [icono]="iconos.editar" [tamano]="18" />
              </button>
            </div>
            <dl class="mt-5 grid gap-3 text-sm">
              <div>
                <dt class="text-xs font-semibold text-texto-suave uppercase">RFC</dt>
                <dd class="mt-0.5 font-medium">{{ datos.rfc }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold text-texto-suave uppercase">Régimen fiscal</dt>
                <dd class="mt-0.5 font-medium">{{ datos.regimenFiscal }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold text-texto-suave uppercase">Código postal</dt>
                <dd class="mt-0.5 font-medium">{{ datos.codigoPostal }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold text-texto-suave uppercase">Uso CFDI</dt>
                <dd class="mt-0.5 font-medium">{{ datos.usoCfdi }}</dd>
              </div>
              <div>
                <dt class="text-xs font-semibold text-texto-suave uppercase">Correo</dt>
                <dd class="mt-0.5 break-all font-medium">{{ datos.correo }}</dd>
              </div>
              @if (datos.direccionFiscal) {
                <div>
                  <dt class="text-xs font-semibold text-texto-suave uppercase">Domicilio fiscal</dt>
                  <dd class="mt-0.5 font-medium">{{ datos.direccionFiscal }}</dd>
                </div>
              }
            </dl>
            <app-documentos-fiscales [datos]="datos" />
            @if (!datos.predeterminado) {
              <button
                type="button"
                class="mt-5 inline-flex h-10 items-center gap-2 rounded-[0.625rem] bg-[#F8DADB] px-3.5 text-sm font-semibold text-epico-oscuro hover:bg-[#F4CBCD] focus-visible:outline-2 focus-visible:outline-carbon"
                (click)="hacerPredeterminado(datos.id)"
              >
                <ui-icon [icono]="iconos.estrella" [tamano]="17" />Usar como predeterminado
              </button>
            }
          }
        </aside>
      </div>
    }
  `,
})
export default class Perfil {
  private readonly perfil = inject(PerfilService);
  protected readonly seccion = signal<SeccionPerfil>('informacion');
  protected readonly mensaje = signal('');
  protected readonly iconos = {
    usuario: UserRound,
    factura: ReceiptText,
    guardar: Check,
    agregar: Plus,
    empresa: Building2,
    estrella: Star,
    editar: PencilLine,
  };

  protected readonly modelo = signal<PerfilUsuario>({
    ...this.perfil.usuario(),
    empresa: { ...this.perfil.usuario().empresa },
  });
  protected readonly f = form(this.modelo, (p) => {
    required(p.nombre, { message: 'Escribe tu nombre.' });
    required(p.apellidos, { message: 'Escribe tus apellidos.' });
    required(p.correo, { message: 'Escribe tu correo.' });
    email(p.correo, { message: 'Escribe un correo válido.' });
    required(p.telefono, { message: 'Escribe un teléfono de contacto.' });
    applyWhen(p.empresa, ({ valueOf }) => valueOf(p.representaEmpresa), empresaSchema);
  });

  protected readonly facturacion = this.perfil.facturacion;
  protected readonly fiscalSeleccionadoId = signal<string | null>(
    this.facturacion()[0]?.id ?? null,
  );
  protected readonly fiscalSeleccionado = computed(() =>
    this.perfil.buscarFacturacion(this.fiscalSeleccionadoId()),
  );
  protected readonly editandoFiscal = signal(false);
  protected readonly idFiscalEdicion = signal<string | null>(null);
  protected readonly fiscalEdicion = computed(() =>
    this.perfil.buscarFacturacion(this.idFiscalEdicion()),
  );

  protected async guardarUsuario(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.f, async () => {
      this.perfil.actualizarUsuario(this.modelo());
      this.mensaje.set('Información personal guardada.');
      return undefined;
    });
  }

  protected seleccionarFiscal(id: string): void {
    this.fiscalSeleccionadoId.set(id);
    this.editandoFiscal.set(false);
  }

  protected nuevoFiscal(): void {
    this.idFiscalEdicion.set(null);
    this.editandoFiscal.set(true);
  }

  protected editarFiscal(): void {
    this.idFiscalEdicion.set(this.fiscalSeleccionadoId());
    this.editandoFiscal.set(true);
  }

  protected guardarFiscal(datos: DatosFacturacionEntrada): void {
    const guardado = this.perfil.guardarFacturacion(datos, this.idFiscalEdicion() ?? undefined);
    this.fiscalSeleccionadoId.set(guardado.id);
    this.editandoFiscal.set(false);
    this.mensaje.set(`Datos fiscales "${guardado.alias}" guardados.`);
  }

  protected hacerPredeterminado(id: string): void {
    this.perfil.hacerPredeterminado(id);
    this.mensaje.set('Datos fiscales predeterminados actualizados.');
  }
}
