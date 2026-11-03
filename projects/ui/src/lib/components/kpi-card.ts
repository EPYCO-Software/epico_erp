import { Component, input } from '@angular/core';
import { IconNode } from 'lucide';
import { Icon } from './icon';

@Component({
  selector: 'ui-kpi-card',
  imports: [Icon],
  host: { class: 'glass flex items-center gap-4 p-5' },
  template: `
    <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-epico/10 text-epico">
      <ui-icon [icono]="icon()" [tamano]="22" />
    </span>
    <div class="min-w-0">
      <p class="text-sm text-texto-suave">{{ label() }}</p>
      <p class="text-2xl font-semibold text-carbon">
        {{ value() }}
        @if (unit()) {
          <span class="text-base font-normal text-texto-suave">{{ unit() }}</span>
        }
      </p>
      @if (hint()) {
        <p class="text-xs text-texto-suave">{{ hint() }}</p>
      }
    </div>
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<IconNode>();
  readonly unit = input<string>();
  readonly hint = input<string>();
}
