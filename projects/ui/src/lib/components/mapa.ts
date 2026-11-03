import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { UbicacionGps } from '../models/obra';

/** URL de Google Maps embebido (modo libre, sin API key). Con GPS usa el punto exacto; si no, busca la dirección. */
export function urlMapa(ubicacion: UbicacionGps | null | undefined, direccion: string | null | undefined): string | null {
  if (ubicacion && Number.isFinite(ubicacion.lat) && Number.isFinite(ubicacion.lng)) {
    return `https://maps.google.com/maps?q=${ubicacion.lat},${ubicacion.lng}&z=16&output=embed`;
  }
  const d = direccion?.trim();
  return d ? `https://maps.google.com/maps?q=${encodeURIComponent(d)}&z=15&output=embed` : null;
}

/** Mapa de solo lectura de una ubicación. Sin GPS ni dirección no muestra nada. */
@Component({
  selector: 'ui-mapa',
  host: { class: 'block' },
  template: `
    @if (src(); as s) {
      <iframe
        [src]="s"
        [title]="titulo()"
        class="block h-full min-h-48 w-full rounded-xl border border-acero/60 bg-carbon/4"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    }
  `,
})
export class Mapa {
  private readonly sanitizer = inject(DomSanitizer);

  readonly ubicacion = input<UbicacionGps | null | undefined>();
  readonly direccion = input<string | null | undefined>();
  /** Nombre accesible del mapa, p. ej. "Mapa de Torre Norte". */
  readonly titulo = input.required<string>();

  // La URL se arma solo con números validados o texto codificado, por eso es seguro marcarla como confiable.
  protected readonly src = computed<SafeResourceUrl | null>(() => {
    const url = urlMapa(this.ubicacion(), this.direccion());
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
