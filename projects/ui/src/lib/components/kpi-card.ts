import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-kpi-card',
  host: { class: 'glass flex items-center gap-4 p-5' },
  template: `
    <span
      class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300"
      aria-hidden="true"
    >
      <i [class]="'pi ' + icon() + ' text-xl'"></i>
    </span>
    <div class="min-w-0">
      <p class="text-sm text-slate-300">{{ label() }}</p>
      <p class="text-2xl font-semibold text-white">
        {{ value() }}
        @if (unit()) {
          <span class="text-base font-normal text-slate-300">{{ unit() }}</span>
        }
      </p>
      @if (hint()) {
        <p class="text-xs text-slate-300">{{ hint() }}</p>
      }
    </div>
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>();
  readonly unit = input<string>();
  readonly hint = input<string>();
}
