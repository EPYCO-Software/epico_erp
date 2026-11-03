import { TestBed } from '@angular/core/testing';
import { Gauge } from 'lucide';
import { GlassCard } from './glass-card';
import { KpiCard } from './kpi-card';
import { PageHeader } from './page-header';

describe('ui components', () => {
  it('KpiCard muestra etiqueta, valor y unidad', async () => {
    const fixture = TestBed.createComponent(KpiCard);
    fixture.componentRef.setInput('label', 'Litros de diésel');
    fixture.componentRef.setInput('value', '4,850');
    fixture.componentRef.setInput('unit', 'L');
    fixture.componentRef.setInput('icon', Gauge);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Litros de diésel');
    expect(text).toContain('4,850');
    expect(text).toContain('L');
    expect((fixture.nativeElement as HTMLElement).querySelector('ui-icon svg')).not.toBeNull();
  });

  it('GlassCard solo renderiza el encabezado si se pasa heading', async () => {
    const fixture = TestBed.createComponent(GlassCard);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')).toBeNull();
    expect(el.classList).toContain('glass');

    fixture.componentRef.setInput('heading', 'Pedidos de hoy');
    await fixture.whenStable();
    expect(el.querySelector('h2')?.textContent).toContain('Pedidos de hoy');
  });

  it('PageHeader renderiza el título como h1', async () => {
    const fixture = TestBed.createComponent(PageHeader);
    fixture.componentRef.setInput('title', 'Dashboard');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Dashboard');
  });
});
