import { Component, computed, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { ChevronDown } from 'lucide';
import { Icon, NuevaObra, Obra, ObraForm } from 'ui';
import { PUBLICO_GENERAL, VentasService } from './datos';

/** Lo que entrega el editor: el cliente ('' = obra general) y los datos de la obra. */
export interface ObraLista {
  clienteId: string;
  datos: NuevaObra;
}

/**
 * Alta y edición de una obra en el ERP: de qué cliente es (o general, sin cliente) y sus datos con el mismo formulario
 * que el portal (ubicación GPS, responsable y contactos).
 */
@Component({
  selector: 'app-editor-obra',
  host: { class: 'block' },
  imports: [Icon, ObraForm],
  template: `
    <div class="mb-4 max-w-md">
      <label for="obra-cliente" class="mb-1 block text-sm font-medium">Cliente</label>
      <div class="relative">
        <select
          id="obra-cliente"
          class="campo h-10 appearance-none pr-9 pl-3 text-sm"
          aria-describedby="obra-cliente-nota"
          (change)="clienteId.set($any($event.target).value)"
        >
          <!-- [selected] en cada opción: el [value] del select llega antes que las opciones del @for y no se elegía -->
          <option value="" [selected]="!clienteId()">General (sin cliente)</option>
          @for (c of clientes(); track c.id) {
            <option [value]="c.id" [selected]="c.id === clienteId()">{{ c.nombre }}</option>
          }
        </select>
        <ui-icon [icono]="flecha" [tamano]="16" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-texto-suave" />
      </div>
      <p id="obra-cliente-nota" class="mt-1 text-xs text-texto-suave">
        Una obra general sirve para cualquier entrega (por ejemplo, un banco de material); la de un cliente también la ve él en su portal.
      </p>
    </div>
    <ui-obra-form
      prefijo="obra-erp"
      [inicial]="obra()"
      [titulo]="obra() ? 'Datos de la obra' : 'Obra nueva'"
      [nivelTitulo]="nivelTitulo()"
      [textoGuardar]="obra() ? 'Guardar cambios' : 'Crear obra'"
      [cancelable]="true"
      (guardada)="listo.emit({ clienteId: clienteId(), datos: $event })"
      (cancelada)="descartar.emit()"
    />
  `,
})
export class EditorObra {
  private readonly ventas = inject(VentasService);

  /** Sin ella, alta. */
  readonly obra = input<Obra | null>(null);
  /** Cliente con que empieza un alta (?cliente= en la ruta). */
  readonly clienteInicial = input('');
  readonly nivelTitulo = input(3);
  readonly listo = output<ObraLista>();
  readonly descartar = output();

  protected readonly flecha = ChevronDown;
  protected readonly clienteId = linkedSignal(() => this.obra()?.clienteId ?? this.clienteInicial());
  /** Los clientes por nombre (sin el de mostrador: sus entregas son obras generales). */
  protected readonly clientes = computed(() =>
    this.ventas
      .clientes()
      .filter((c) => c.id !== PUBLICO_GENERAL)
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  );

  private readonly form = viewChild(ObraForm);
  readonly sinGuardar = computed(() => !!this.form()?.sinGuardar() || this.clienteId() !== (this.obra()?.clienteId ?? this.clienteInicial()));
}
