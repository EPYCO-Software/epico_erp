import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-glass-card',
  host: { class: 'glass block p-5' },
  template: `
    @if (heading()) {
      <h2 class="mb-3 text-base font-semibold text-white">{{ heading() }}</h2>
    }
    <ng-content />
  `,
})
export class GlassCard {
  readonly heading = input<string>();
}
