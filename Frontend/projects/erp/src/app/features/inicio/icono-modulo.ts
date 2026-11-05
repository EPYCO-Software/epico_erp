import { Component, input } from '@angular/core';
import { IdModulo } from '../../core/modulos';

/** Engranaje de `dientes` dientes alrededor de (cx, cy): radio exterior r1 y de raíz r2. */
export function engranaje(cx: number, cy: number, r1: number, r2: number, dientes: number): string {
  const paso = (2 * Math.PI) / dientes;
  const punto = (r: number, a: number) => `${+(cx + r * Math.cos(a)).toFixed(2)} ${+(cy + r * Math.sin(a)).toFixed(2)}`;
  const tramos: string[] = [];
  for (let i = 0; i < dientes; i++) {
    const a = i * paso - Math.PI / 2;
    tramos.push(
      `${i ? 'L' : 'M'}${punto(r2, a - paso * 0.3)}`,
      `L${punto(r1, a - paso * 0.16)}`,
      `L${punto(r1, a + paso * 0.16)}`,
      `L${punto(r2, a + paso * 0.3)}`,
    );
  }
  return tramos.join(' ') + ' Z';
}

const ENGRANAJE = engranaje(24, 24, 19.5, 14.8, 8);

/**
 * Icono de cada módulo (48×48) en estilo de app launcher: formas planas y geométricas en la paleta EPICO.
 * Rojo #C8151B, carbón #2A2A2A, gris cálido #D0CAC3, gris medio #919191, arena #C59661 y terracota #AE5442.
 * Decorativo: el nombre va en el enlace.
 */
@Component({
  selector: 'app-icono-modulo',
  host: { class: 'block', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 48 48" class="size-full overflow-visible">
      @switch (modulo()) {
        @case ('seguridad') {
          <path d="M24 5 L39 10.5 V23 C39 32.5 32.5 39.5 24 43 C15.5 39.5 9 32.5 9 23 V10.5 Z" fill="#2A2A2A" />
          <path d="M16 24.5 L22 30.5 L33.5 18" fill="none" stroke="#C8151B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('crm') {
          <circle cx="31" cy="15.5" r="6.5" fill="#2A2A2A" />
          <path d="M20 40 C20 30.5 25 25.5 31 25.5 C37 25.5 42 30.5 42 40 Z" fill="#2A2A2A" />
          <circle cx="17.5" cy="19.5" r="6" fill="#D0CAC3" />
          <path d="M6 42 C6 33 11.5 28.5 18 28.5 C24.5 28.5 30 33 30 42 Z" fill="#C8151B" />
        }
        @case ('ventas') {
          <g transform="rotate(-45 24 24)">
            <path d="M12 15 H29 L38 24 L29 33 H12 A3 3 0 0 1 9 30 V18 A3 3 0 0 1 12 15 Z" fill="#C8151B" />
            <circle cx="29.5" cy="24" r="2.6" fill="#fff" />
          </g>
          <!-- moneda: carbón con brillo gris arriba a la derecha -->
          <circle cx="16.5" cy="33" r="8.5" fill="#919191" />
          <circle cx="15.3" cy="34.2" r="6.8" fill="#2A2A2A" />
        }
        @case ('pedidos') {
          <rect x="8" y="16" width="32" height="25" rx="2" fill="#D0CAC3" />
          <rect x="6" y="10" width="36" height="8" rx="2" fill="#919191" />
          <rect x="21" y="10" width="6" height="31" fill="#C8151B" />
        }
        @case ('productos') {
          <path d="M24 6 L40 15 L24 24 L8 15 Z" fill="#D0CAC3" />
          <path d="M8 15 L24 24 V42 L8 33 Z" fill="#2A2A2A" />
          <path d="M40 15 L24 24 V42 L40 33 Z" fill="#C8151B" />
        }
        @case ('calidad') {
          <path d="M13.6 28 H34.4 L39 35.5 A3.8 3.8 0 0 1 35.7 41 H12.3 A3.8 3.8 0 0 1 9 35.5 Z" fill="#C8151B" />
          <path
            d="M19 9 H29 V18 L39 35.5 A3.8 3.8 0 0 1 35.7 41 H12.3 A3.8 3.8 0 0 1 9 35.5 L19 18 Z"
            fill="none"
            stroke="#2A2A2A"
            stroke-width="3.2"
            stroke-linejoin="round"
          />
          <rect x="16" y="5" width="16" height="4.5" rx="2.25" fill="#2A2A2A" />
        }
        @case ('compras') {
          <rect x="16" y="7" width="10" height="11" rx="2" fill="#D0CAC3" />
          <rect x="25" y="4" width="10" height="14" rx="2" fill="#C59661" />
          <path d="M5 10 H10 L13 15" fill="none" stroke="#2A2A2A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M12 15 H42 L37.6 30.6 A3 3 0 0 1 34.7 32.8 H17.7 A3 3 0 0 1 14.8 30.6 Z" fill="#C8151B" />
          <circle cx="19.5" cy="39" r="3.6" fill="#2A2A2A" />
          <circle cx="33" cy="39" r="3.6" fill="#2A2A2A" />
        }
        @case ('inventario') {
          <rect x="5" y="23" width="19" height="18" rx="2.5" fill="#D0CAC3" />
          <rect x="24" y="23" width="19" height="18" rx="2.5" fill="#C8151B" />
          <rect x="14.5" y="6" width="19" height="19" rx="2.5" fill="#2A2A2A" />
        }
        @case ('planeacion') {
          <rect x="6" y="10" width="36" height="4" rx="2" fill="#2A2A2A" />
          <circle cx="24" cy="12" r="4.6" fill="#C8151B" />
          <rect x="6" y="22" width="36" height="4" rx="2" fill="#C59661" />
          <circle cx="30" cy="24" r="4.6" fill="#B88650" />
          <rect x="6" y="34" width="36" height="4" rx="2" fill="#919191" />
          <circle cx="24" cy="36" r="4.6" fill="#C8151B" />
        }
        @case ('automatizacion') {
          <path [attr.d]="engranaje" fill="#2A2A2A" />
          <circle cx="24" cy="24" r="8.5" fill="#fff" />
          <circle cx="24" cy="24" r="6" fill="#C8151B" />
        }
        @case ('logistica') {
          <rect x="4" y="12" width="26" height="17" rx="5" fill="#C8151B" />
          <path d="M31 16 H38 L43 22 V31 H31 Z" fill="#D0CAC3" />
          <rect x="4" y="29.5" width="39" height="4" rx="2" fill="#2A2A2A" />
          @for (x of [12, 22, 36]; track x) {
            <circle [attr.cx]="x" cy="37" r="4" fill="#2A2A2A" />
          }
        }
        @case ('operaciones') {
          <g transform="rotate(45 24 24)">
            <rect x="21" y="20" width="6" height="23" rx="3" fill="#2A2A2A" />
            <rect x="21" y="32" width="6" height="11" rx="3" fill="#C8151B" />
            <path
              d="M21.3 4.5 A9 9 0 0 0 15 13 A9 9 0 0 0 21 21.5 V24 H27 V21.5 A9 9 0 0 0 33 13 A9 9 0 0 0 26.7 4.5 V10 A2.7 2.7 0 0 1 21.3 10 Z"
              fill="#2A2A2A"
            />
          </g>
        }
        @case ('finanzas') {
          <path d="M10 5 H32 V41 L28.3 38.3 L24.7 41 L21 38.3 L17.3 41 L13.7 38.3 L10 41 Z" fill="#D0CAC3" />
          <rect x="14" y="11" width="14" height="3" rx="1.5" fill="#C8151B" />
          <rect x="14" y="17" width="10" height="3" rx="1.5" fill="#C8151B" />
          <circle cx="33" cy="31" r="10" fill="#AE5442" />
        }
        @case ('personal') {
          <rect x="8" y="11" width="32" height="30" rx="3" fill="#C8151B" />
          <rect x="19.5" y="5" width="9" height="9" rx="2" fill="#2A2A2A" />
          <circle cx="24" cy="22" r="5" fill="#fff" />
          <path d="M15 36 C15 30.8 19 28 24 28 C29 28 33 30.8 33 36 Z" fill="#fff" />
        }
        @case ('documentos') {
          <path d="M6 13 A3 3 0 0 1 9 10 H18 L21.5 14 H39 A3 3 0 0 1 42 17 V24 H6 Z" fill="#919191" />
          <rect x="13" y="6" width="22" height="24" rx="2.5" fill="#C8151B" />
          <path d="M6 20 H42 V38 A3 3 0 0 1 39 41 H9 A3 3 0 0 1 6 38 Z" fill="#D0CAC3" />
        }
        @case ('analitica') {
          <!-- dona desde las 12 en sentido horario: gris 33 %, carbón 50 %, rojo 17 % -->
          <g fill="none" stroke-width="9" transform="rotate(-90 24 24)">
            <circle cx="24" cy="24" r="14" stroke="#D0CAC3" stroke-dasharray="29.3 88" />
            <circle cx="24" cy="24" r="14" stroke="#2A2A2A" stroke-dasharray="44 88" stroke-dashoffset="-29.3" />
            <circle cx="24" cy="24" r="14" stroke="#C8151B" stroke-dasharray="14.7 88" stroke-dashoffset="-73.3" />
          </g>
        }
        @case ('integraciones') {
          <path d="M24 26 L11 11 M24 26 L37 11 M24 26 V39" stroke="#2A2A2A" stroke-width="3" stroke-linecap="round" />
          <circle cx="11" cy="11" r="6" fill="#C8151B" />
          <circle cx="37" cy="11" r="6" fill="#C59661" />
          <circle cx="24" cy="39" r="6" fill="#AE5442" />
          <circle cx="24" cy="26" r="4.5" fill="#2A2A2A" />
        }
      }
    </svg>
  `,
})
export class IconoModulo {
  readonly modulo = input.required<IdModulo>();
  protected readonly engranaje = ENGRANAJE;
}
