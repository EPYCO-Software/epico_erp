import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { permisosSesion } from '../../core/permisos';
import { mensajeDe } from '../ventas/datos';
import { DocumentoUnidad, FlotaApi, TIPO_DOCUMENTO, TipoDocumento, textoVence } from './flota-api';

const vacio = (equipoId: string): DocumentoUnidad => ({ equipoId, tipo: 'seguro', numero: null, vence: null, archivoId: null, notas: null });

/**
 * Documentos de una unidad (seguro, verificación, tarjeta de circulación, permiso SCT…) con su vencimiento. Uno vencido
 * al día de una entrega deja la unidad fuera de las disponibles (lo decide el backend). Alta y edición en línea.
 */
@Component({
  selector: 'app-documentos-unidad',
  host: { class: 'block' },
  template: `
    <section aria-labelledby="docs-titulo">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="docs-titulo" class="text-base font-bold">Documentos</h2>
        @if (puede('flota.equipos.editar') && !editando()) {
          <button type="button" [class]="boton" (click)="editar(null)">Agregar documento</button>
        }
      </div>
      @if (lista().length) {
        <ul class="mt-2 grid gap-2">
          @for (d of lista(); track d.id) {
            <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/85 px-3 py-2 text-sm">
              <span class="min-w-0">
                <span class="font-semibold">{{ tipos[d.tipo] }}</span>
                @if (d.numero) {
                  <span class="text-texto-suave"> · {{ d.numero }}</span>
                }
                <span [class]="'block text-xs ' + vence(d).tono">{{ vence(d).texto }}</span>
              </span>
              @if (puede('flota.equipos.editar')) {
                <span class="flex gap-2">
                  <button type="button" [class]="botonChico" (click)="editar(d)">Editar<span class="sr-only"> {{ tipos[d.tipo] }}</span></button>
                  <button type="button" [class]="botonChico" (click)="quitar(d)">Quitar<span class="sr-only"> {{ tipos[d.tipo] }}</span></button>
                </span>
              }
            </li>
          }
        </ul>
      } @else if (docs.hasValue()) {
        <p class="mt-1 text-sm text-texto-suave">Sin documentos registrados.</p>
      }

      @if (editando(); as d) {
        <form novalidate class="mt-3 grid gap-3 rounded-xl border border-acero/70 bg-white/70 p-3 sm:grid-cols-2" (submit)="guardar($event)">
          <div>
            <label for="doc-tipo" [class]="etiqueta">Documento</label>
            <select id="doc-tipo" class="campo mt-1 h-10 px-2" (change)="cambiar({ tipo: $any($event.target).value })">
              @for (t of listaTipos; track t.id) {
                <option [value]="t.id" [selected]="t.id === d.tipo">{{ t.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label for="doc-numero" [class]="etiqueta">Número o póliza</label>
            <input id="doc-numero" class="campo mt-1 h-10 px-3" [value]="d.numero ?? ''" (input)="cambiar({ numero: $any($event.target).value || null })" />
          </div>
          <div>
            <label for="doc-vence" [class]="etiqueta">Vence</label>
            <input id="doc-vence" type="date" class="campo mt-1 h-10 px-3" [value]="d.vence ?? ''" (change)="cambiar({ vence: $any($event.target).value || null })" />
          </div>
          <div>
            <label for="doc-notas" [class]="etiqueta">Notas</label>
            <input id="doc-notas" class="campo mt-1 h-10 px-3" [value]="d.notas ?? ''" (input)="cambiar({ notas: $any($event.target).value || null })" />
          </div>
          <div class="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" class="boton-primario h-9 w-auto px-4 text-sm" [disabled]="ocupado()">{{ d.id ? 'Guardar' : 'Agregar' }}</button>
            <button type="button" [class]="boton" (click)="editando.set(null)">Cancelar</button>
          </div>
        </form>
      }
      <p class="mt-2 text-sm font-medium text-critico empty:hidden" role="alert">{{ error() }}</p>
    </section>
  `,
})
export class DocumentosUnidad {
  protected readonly puede = permisosSesion();
  private readonly api = inject(FlotaApi);
  readonly equipoId = input.required<string>();

  protected readonly tipos = TIPO_DOCUMENTO;
  protected readonly listaTipos = (Object.keys(TIPO_DOCUMENTO) as TipoDocumento[]).map((id) => ({ id, nombre: TIPO_DOCUMENTO[id] }));
  protected readonly etiqueta = 'block text-xs font-bold tracking-wide text-texto-suave uppercase';
  protected readonly boton =
    'inline-flex h-9 items-center rounded-[0.625rem] border border-acero-oscuro bg-white px-3.5 text-sm font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';
  protected readonly botonChico =
    'inline-flex h-8 items-center rounded-lg border border-acero-oscuro bg-white px-2.5 text-xs font-semibold transition-colors hover:border-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-epico';

  protected readonly docs = resource({
    params: () => this.equipoId(),
    loader: ({ params }) => this.api.lista<DocumentoUnidad>('equipo-documentos', { equipoId: params }),
  });
  /** El que vence primero arriba; los sin fecha al final. */
  protected readonly lista = computed(() =>
    (this.docs.hasValue() ? this.docs.value() : []).filter((d) => d.equipoId === this.equipoId()).sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999')),
  );
  protected vence(d: DocumentoUnidad) {
    return textoVence(d.vence);
  }

  protected readonly editando = signal<DocumentoUnidad | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');

  protected editar(d: DocumentoUnidad | null): void {
    this.error.set('');
    this.editando.set(d ? { ...d } : vacio(this.equipoId()));
  }
  protected cambiar(c: Partial<DocumentoUnidad>): void {
    this.editando.update((d) => (d ? { ...d, ...c } : d));
  }

  protected async guardar(e: Event): Promise<void> {
    e.preventDefault();
    const d = this.editando();
    if (!d) return;
    await this.hacer(() => this.api.guardarRegistro('equipo-documentos', d));
    if (!this.error()) this.editando.set(null);
  }
  protected async quitar(d: DocumentoUnidad): Promise<void> {
    if (!d.id || !confirm(`¿Quitar ${TIPO_DOCUMENTO[d.tipo]}?`)) return;
    await this.hacer(() => this.api.borrar('equipo-documentos', d.id!));
  }
  private async hacer(f: () => Promise<unknown>): Promise<void> {
    this.ocupado.set(true);
    this.error.set('');
    try {
      await f();
      this.docs.reload();
    } catch (e) {
      this.error.set(mensajeDe(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
