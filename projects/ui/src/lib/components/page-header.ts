import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-page-header',
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-4' },
  template: `
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-carbon">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="mt-1 text-sm text-texto-suave">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex gap-2"><ng-content /></div>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
