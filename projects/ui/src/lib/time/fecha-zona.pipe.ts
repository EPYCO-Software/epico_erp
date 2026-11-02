import { InjectionToken, Pipe, PipeTransform, inject } from '@angular/core';

/** Zona IANA que se usa cuando un registro no trae la de su planta. */
export const DEFAULT_TIMEZONE = new InjectionToken<string>('DEFAULT_TIMEZONE', {
  factory: () => 'America/Merida',
});

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    // Lanza RangeError si la zona no es IANA válida.
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * Formatea una fecha ISO en la zona IANA indicada (la de la planta), no en la del navegador.
 * Tokens del formato: yyyy, MM, dd, HH, mm. Ej.: `{{ iso | fechaZona: zona : 'dd/MM/yyyy HH:mm' }}`
 */
@Pipe({ name: 'fechaZona' })
export class FechaZonaPipe implements PipeTransform {
  private readonly defaultZone = inject(DEFAULT_TIMEZONE);

  transform(iso: string | null | undefined, zona?: string | null, formato = 'dd/MM/yyyy HH:mm'): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    let f: Intl.DateTimeFormat;
    try {
      f = formatter(zona || this.defaultZone);
    } catch {
      console.warn(`[fechaZona] Zona horaria inválida "${zona}", se usa ${this.defaultZone}.`);
      f = formatter(this.defaultZone);
    }

    const p: Record<string, string> = {};
    for (const { type, value } of f.formatToParts(date)) p[type] = value;
    const tokens: Record<string, string> = { yyyy: p['year'], MM: p['month'], dd: p['day'], HH: p['hour'], mm: p['minute'] };
    return formato.replace(/yyyy|MM|dd|HH|mm/g, (t) => tokens[t]);
  }
}
