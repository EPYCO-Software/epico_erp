import { Component, inject, input, signal } from '@angular/core';
import { Download, FileText, Trash2, Upload } from 'lucide';
import { DatosFacturacion, DocumentoFiscal, Icon, TipoDocumentoFiscal } from 'ui';
import { PerfilService } from '../../core/services/perfil.service';

const TIPOS: TipoDocumentoFiscal[] = [
  'Constancia de situación fiscal',
  'Carátula bancaria',
  'Comprobante de domicilio',
  'Otro',
];
let siguienteSelector = 0;

@Component({
  selector: 'app-documentos-fiscales',
  imports: [Icon],
  template: `
    <section
      aria-labelledby="documentos-fiscales-titulo"
      class="mt-5 border-t border-acero/45 pt-5"
    >
      <div class="mb-3">
        <h3 id="documentos-fiscales-titulo" class="font-bold">Documentos fiscales</h3>
        <p class="mt-1 text-xs leading-5 text-texto-suave">
          Adjunta constancias, carátulas bancarias o comprobantes. PDF, JPG o PNG de hasta 10 MB.
        </p>
      </div>

      <div
        class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div>
          <label [for]="idTipo" class="sr-only">Tipo de documento</label>
          <select
            [id]="idTipo"
            class="campo h-10 px-3 text-sm"
            [value]="tipo()"
            (change)="cambiarTipo($event)"
          >
            @for (opcion of tipos; track opcion) {
              <option [value]="opcion">{{ opcion }}</option>
            }
          </select>
        </div>
        <label
          class="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold hover:border-carbon focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-epico"
        >
          <ui-icon [icono]="iconos.subir" [tamano]="17" />Subir archivo
          <input
            type="file"
            class="sr-only"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            multiple
            (change)="seleccionarArchivos($event)"
          />
        </label>
      </div>

      <p class="sr-only" aria-live="polite">{{ mensaje() }}</p>
      @if (error()) {
        <p class="mt-2 text-xs font-medium text-epico-oscuro" role="alert">{{ error() }}</p>
      }

      @if (datos().documentos.length) {
        <ul class="mt-4 divide-y divide-acero/40 border-y border-acero/40">
          @for (documento of datos().documentos; track documento.id) {
            <li class="flex items-center gap-3 py-3 pr-16">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-carbon/6 text-carbon"
              >
                <ui-icon [icono]="iconos.archivo" [tamano]="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold" [title]="documento.nombre">{{
                  documento.nombre
                }}</span>
                <span class="mt-0.5 block truncate text-xs text-texto-suave"
                  >{{ documento.tipo }} · {{ tamano(documento.tamano) }}</span
                >
              </span>
              <button
                type="button"
                class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-carbon/6 focus-visible:outline-2 focus-visible:outline-epico"
                [attr.aria-label]="'Descargar ' + documento.nombre"
                (click)="descargar(documento)"
              >
                <ui-icon [icono]="iconos.descargar" [tamano]="16" />
              </button>
              <button
                type="button"
                class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-epico-oscuro hover:bg-[#F8DADB] focus-visible:outline-2 focus-visible:outline-epico"
                [attr.aria-label]="'Eliminar ' + documento.nombre"
                (click)="eliminar(documento.id)"
              >
                <ui-icon [icono]="iconos.eliminar" [tamano]="16" />
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="mt-4 border-y border-acero/40 py-3 text-sm text-texto-suave">
          Todavía no hay documentos asociados a estos datos fiscales.
        </p>
      }
    </section>
  `,
})
export class DocumentosFiscales {
  readonly datos = input.required<DatosFacturacion>();

  private readonly perfil = inject(PerfilService);
  protected readonly tipos = TIPOS;
  protected readonly tipo = signal<TipoDocumentoFiscal>('Constancia de situación fiscal');
  protected readonly mensaje = signal('');
  protected readonly error = signal('');
  protected readonly idTipo = `tipo-documento-${siguienteSelector++}`;
  protected readonly iconos = {
    subir: Upload,
    archivo: FileText,
    descargar: Download,
    eliminar: Trash2,
  };

  protected cambiarTipo(event: Event): void {
    this.tipo.set((event.target as HTMLSelectElement).value as TipoDocumentoFiscal);
  }

  protected seleccionarArchivos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;

    const resultado = this.perfil.agregarDocumentos(this.datos().id, this.tipo(), archivos);
    this.error.set(
      resultado.rechazados.length
        ? `No se agregaron: ${resultado.rechazados.join(', ')}. Revisa el formato y que no excedan 10 MB.`
        : '',
    );
    if (resultado.agregados) {
      this.mensaje.set(
        `${resultado.agregados} ${resultado.agregados === 1 ? 'documento agregado' : 'documentos agregados'}.`,
      );
    }
  }

  protected eliminar(idDocumento: string): void {
    this.perfil.eliminarDocumento(this.datos().id, idDocumento);
    this.mensaje.set('Documento eliminado.');
    this.error.set('');
  }

  protected descargar(documento: DocumentoFiscal): void {
    const url = URL.createObjectURL(documento.archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = documento.nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  protected tamano(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
