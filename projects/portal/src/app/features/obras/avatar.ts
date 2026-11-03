import { Component, computed, input } from '@angular/core';

/** Foto del responsable o, si no hay, sus iniciales. Decorativo: el nombre siempre va en texto junto a él. */
@Component({
  selector: 'app-avatar',
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  template: `
    @if (foto()) {
      <img [src]="foto()" alt="" class="size-full rounded-full object-cover" />
    } @else {
      <span class="flex size-full items-center justify-center rounded-full bg-carbon text-[0.8em] font-semibold text-white">{{ iniciales() }}</span>
    }
  `,
})
export class Avatar {
  readonly nombre = input.required<string>();
  readonly foto = input<string | undefined>();
  /** Sin títulos (Ing., Arq., Lic.…): "Ing. Mariana Pech" → "MP". */
  protected readonly iniciales = computed(() =>
    this.nombre()
      .split(/\s+/)
      .filter((p) => p && !/\.$/.test(p))
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );
}
