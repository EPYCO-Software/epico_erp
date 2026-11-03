import { Component } from '@angular/core';

type Modulo = 'ventas' | 'planta' | 'logistica' | 'inventario';
type Tramo = ['M' | 'L', number, number] | ['Q', number, number, number, number];

/**
 * Tarjetas de vidrio de los módulos, medidas sobre el mockup (lienzo 1586×992, en px del mockup):
 * esquina superior izquierda (x, y), ancho y alto de los lados verticales, e inclinación k (cuánto sube el borde
 * superior por cada px hacia la derecha: la tarjeta está "acostada" sobre el vidrio que se inclina hacia atrás).
 * El icono va centrado con un pequeño ajuste (dx, dy) y su propio tamaño (iw × ih). `inicio`: ms de su entrada.
 */
const MODULOS: { id: Modulo; x: number; y: number; w: number; h: number; k: number; iw: number; ih: number; dx: number; dy: number; inicio: number }[] = [
  { id: 'ventas', x: 273, y: 578, w: 108, h: 112, k: 0.056, iw: 48, ih: 46, dx: 1.5, dy: -2, inicio: 1000 },
  { id: 'planta', x: 575.5, y: 502.5, w: 105, h: 100, k: 0.052, iw: 48, ih: 52, dx: -1, dy: 0, inicio: 1120 },
  { id: 'logistica', x: 720, y: 630, w: 96, h: 95, k: 0.092, iw: 46, ih: 34, dx: 0, dy: 4, inicio: 1360 },
  { id: 'inventario', x: 439, y: 749, w: 102.5, h: 101, k: 0.088, iw: 39, ih: 47, dx: 0, dy: 0, inicio: 1240 },
];

/** Iconos dibujados a la medida del mockup (trazos que se dibujan al entrar; la gráfica además crece). */
const ICONOS: Record<Modulo, { caja: string; trazos: string[]; barras?: number[][] }> = {
  ventas: {
    caja: '0 0 48 46',
    trazos: ['M1 44.5 H47'],
    barras: [
      [3, 29, 6, 14],
      [15, 19, 7, 24],
      [27, 10, 6, 33],
      [38, 1, 7, 42],
    ],
  },
  planta: {
    caja: '0 0 48 52',
    trazos: ['M4.5 49 L8 22 L19 31 L25 21 L37 31 V2.5 H44.5 V49', 'M2 49.5 H47', 'M12 42.5 H18', 'M22 42.5 H36'],
  },
  logistica: {
    caja: '0 0 46 34',
    trazos: [
      'M7 27 H2 V2 H30 V27',
      'M17 27 H31',
      'M30 8 H39 L45 14 V27 H41',
      'M7 28 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
      'M31 28 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
    ],
  },
  inventario: {
    caja: '0 0 40 48',
    trazos: ['M20 2 L39 12.5 V36.5 L20.5 47 L1 36.5 V12.5 Z', 'M1 12.5 L20.5 23 L39 12.5', 'M20.5 23 V47'],
  },
};

/** Conexiones en orden de la "red": cada una se dibuja desde `inicio` (ms) durante `duracion` (ms). */
const CONEXIONES: { d: string; inicio: number; duracion: number; trazo?: string; opacidad?: number }[] = [
  { d: 'M768 330 V626', inicio: 1250, duracion: 700, trazo: 'url(#cg-vertical)' },
  { d: 'M381 646 L487 629.5', inicio: 1500, duracion: 400 },
  { d: 'M326.5 687 V763 Q326.5 781 346 780.5 L402 775.5 L439 771.5', inicio: 1650, duracion: 800 },
  { d: 'M487 629.5 V578 Q487 557 507 555.5 L576 551', inicio: 1900, duracion: 450 },
  { d: 'M487 629.5 V664 Q487 684 507 682 L610 667 Q627.5 665 628.5 681', inicio: 1900, duracion: 600 },
  { d: 'M628.5 600 V688.5', inicio: 2150, duracion: 350 },
  { d: 'M680.5 558.5 L719 556 Q740 555 740 575 V602.5', inicio: 2300, duracion: 450 },
  { d: 'M628.5 688.5 L720 675', inicio: 2550, duracion: 350 },
  { d: 'M628.5 688.5 L631.5 765.5 V789 Q631.5 806 615 807.5 L541 815.5', inicio: 2550, duracion: 700 },
  { d: 'M490 846 V1000', inicio: 2800, duracion: 600, opacidad: 0.4 },
  { d: 'M768 718 V920', inicio: 2850, duracion: 600, trazo: 'url(#cg-vertical-abajo)' },
];

/**
 * La baraja: una carta principal y dos detrás, medidas sobre el mockup.
 * - Principal: su cara oscura empieza en la línea B (y = 0.25x − 25) y su canto exterior es la línea A, que sale
 *   de la esquina (785, 145.5) con pendiente 0.29: entre A y B queda su propio vidrio, un filo delgado pegado a la
 *   carta (en el mockup era una cuña más ancha; se adelgazó a pedido).
 * - Carta 2 y carta 3: pegadas a la principal, como una baraja apenas abierta: cada una asoma ~17 px más a la
 *   derecha (y un poco abajo), con su propia esquina redondeada. Sus bordes superiores corren justo debajo de la
 *   línea B, tapados por la cara oscura, así que solo se ven a la derecha y abajo de la principal.
 * `caja` = [x, y, ancho, alto] del elemento de vidrio; el recorte va relativo a ella (objectBoundingBox).
 * `desde` = de dónde sale al repartirse (px del mockup, escondida detrás de la principal).
 */
const CARTAS: {
  id: string;
  tramos: Tramo[];
  caja: readonly [number, number, number, number];
  borde: string;
  desde: readonly [number, number];
  inicio: number;
  destello: number;
  vidrio: string;
}[] = [
  {
    id: 'cg-carta-3',
    tramos: [
      ['M', 400, 79],
      ['L', 806, 180.5],
      ['Q', 846, 176, 848, 222],
      ['L', 872, 410],
      ['L', 898, 610],
      ['L', 910, 715],
      ['L', 911, 805],
      ['Q', 912, 840, 884, 857],
      ['L', 594, 1026],
      ['L', 400, 1140],
    ],
    caja: [400, 70, 515, 1075],
    borde: 'M806 180.5 Q846 176 848 222 L872 410 L898 610 L910 715 L911 805 Q912 840 884 857 L594 1026',
    desde: [-40, -30],
    inicio: 560,
    destello: 3300,
    // la más lejana: casi transparente, con brillo arriba
    vidrio: 'bg-linear-to-b from-white/55 via-[#d5d8db]/25 to-[#d5d8db]/30 backdrop-blur-[14px] backdrop-saturate-125',
  },
  {
    id: 'cg-carta-2',
    tramos: [
      ['M', 400, 83],
      ['L', 800, 183],
      ['Q', 829, 186, 831, 226],
      ['L', 855, 415],
      ['L', 881, 615],
      ['L', 893, 718],
      ['L', 894, 800],
      ['Q', 895, 830, 868, 845],
      ['L', 577, 1013],
      ['L', 400, 1115],
    ],
    caja: [400, 75, 500, 1045],
    borde: 'M800 183 Q829 186 831 226 L855 415 L881 615 L893 718 L894 800 Q895 830 868 845 L577 1013',
    desde: [-20, -24],
    inicio: 380,
    destello: 3100,
    vidrio: 'bg-linear-to-b from-[#cfd2d5]/45 via-[#c2c5c8]/60 to-[#d8dadc]/60 backdrop-blur-[16px] backdrop-saturate-125',
  },
];

/** Vidrio propio de la carta principal: el filo entre la línea A (canto) y la línea B (cara oscura). */
const CANTO: Tramo[] = [
  ['M', 0, -82.15],
  ['L', 785, 145.5],
  ['Q', 812, 158, 814, 205],
  ['Q', 806, 176, 780, 170],
  ['L', 0, -25],
];
const CAJA_CANTO = [0, -83, 815, 289] as const;

/** Convierte tramos en el atributo `d` (cerrado), opcionalmente transformando cada punto. */
export function ruta(tramos: Tramo[], f: (x: number, y: number) => [number, number] = (x, y) => [x, y]): string {
  return (
    tramos
      .map(([c, ...n]) => {
        const p: number[] = [];
        for (let i = 0; i < n.length; i += 2) p.push(...f(n[i], n[i + 1]));
        return c + p.map((v) => +v.toFixed(5)).join(' ');
      })
      .join(' ') + ' Z'
  );
}

/** Tramos en coordenadas relativas a su caja (0–1), para un clipPath objectBoundingBox. */
export function rutaRelativa(tramos: Tramo[], [x, y, w, h]: readonly [number, number, number, number]): string {
  return ruta(tramos, (px, py) => [(px - x) / w, (py - y) / h]);
}

const u = (n: number) => `calc(var(--u) * ${n})`;

/**
 * Decoración del login del ERP: baraja de cartas de vidrio con los módulos conectados y su coreografía de
 * entrada (ver entrada-login.css). Va dentro del lienzo escalado del login (usa --u) y solo en escritorio. La carta
 * principal se extiende fuera del lienzo para llegar al borde de la ventana cuando su proporción no es la del
 * mockup. Puramente decorativa.
 *
 * Orden de pintado (de atrás hacia adelante): carta 3, su filo, carta 2, su filo, cara oscura, vidrio del canto,
 * filos de la principal + red, tarjetas de módulos. Los vidrios son HTML con backdrop-filter recortado con
 * clip-path (los SVG no pueden desenfocar lo que tienen detrás).
 */
@Component({
  selector: 'app-capas-glass',
  host: { class: 'pointer-events-none absolute inset-0 -z-10', 'aria-hidden': 'true' },
  template: `
    <!-- Cartas de atrás: salen de detrás de la principal, como al repartir -->
    @for (c of cartas; track c.id; let i = $index) {
      <div
        class="entrada-carta absolute overflow-hidden"
        [class]="c.vidrio"
        [style.clip-path]="'url(#' + c.id + ')'"
        [style.left]="u(c.caja[0])"
        [style.top]="u(c.caja[1])"
        [style.width]="u(c.caja[2])"
        [style.height]="u(c.caja[3])"
        [style.--dx]="c.desde[0]"
        [style.--dy]="c.desde[1]"
        [style.animation-delay.ms]="c.inicio"
      >
        <span
          class="entrada-destello absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/70 to-transparent opacity-0"
          [style.animation-delay.ms]="c.destello"
        ></span>
      </div>
      <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 1586 992" fill="none">
        <path
          class="entrada-carta-svg"
          [attr.d]="c.borde"
          stroke="#ffffff"
          [attr.stroke-opacity]="i === 0 ? 0.6 : 0.9"
          stroke-width="1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
          [style.--dx]="c.desde[0]"
          [style.--dy]="c.desde[1]"
          [style.animation-delay.ms]="c.inicio"
        />
      </svg>
    }

    <!-- Cara oscura de la carta principal -->
    <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 1586 992" fill="none">
      <defs>
        <!-- El vidrio se aclara hacia la derecha; abajo lo cubre niebla clara con el halo rojo de la esquina. -->
        <linearGradient id="cg-oscuro" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="860" y2="0">
          <stop offset="0" stop-color="#23262a" />
          <stop offset="0.45" stop-color="#303337" />
          <stop offset="0.68" stop-color="#4b4e52" />
          <stop offset="0.85" stop-color="#76797d" />
          <stop offset="1" stop-color="#909397" />
        </linearGradient>
        <linearGradient id="cg-arriba" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2="240">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.16" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="cg-niebla" gradientUnits="userSpaceOnUse" x1="0" y1="740" x2="0" y2="1000">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.8" stop-color="#ffffff" stop-opacity="0.58" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.68" />
        </linearGradient>
        <radialGradient id="cg-rojo" gradientUnits="userSpaceOnUse" cx="-40" cy="1010" r="470">
          <stop offset="0" stop-color="#ff6d72" stop-opacity="0.9" />
          <stop offset="0.5" stop-color="#ff6d72" stop-opacity="0.45" />
          <stop offset="1" stop-color="#ff6d72" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="cg-borde" gradientUnits="userSpaceOnUse" x1="330" y1="0" x2="880" y2="900">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.35" />
          <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.5" />
        </linearGradient>
        <linearGradient id="cg-reflejo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.22" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="cg-vertical" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="622">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.62" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.62" />
        </linearGradient>
        <linearGradient id="cg-vertical-abajo" gradientUnits="userSpaceOnUse" x1="0" y1="718" x2="0" y2="920">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.6" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <clipPath id="cg-placa">
          <path [attr.d]="placa" />
        </clipPath>
        <!-- Recortes de los vidrios (HTML): relativos a su propia caja para escalar con el lienzo -->
        @for (c of cartas; track c.id) {
          <clipPath [attr.id]="c.id" clipPathUnits="objectBoundingBox">
            <path [attr.d]="c.recorte" />
          </clipPath>
        }
        <clipPath id="cg-canto" clipPathUnits="objectBoundingBox">
          <path [attr.d]="cantoRelativo" />
        </clipPath>
        <filter id="cg-suave" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="cg-halo" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <g class="entrada-placa">
        <path [attr.d]="placa" fill="url(#cg-oscuro)" />
        <g clip-path="url(#cg-placa)">
          <!-- Nave industrial desenfocada detrás del vidrio: es lo que las tarjetas dejan ver borroso. -->
          <g fill="#ffffff" stroke="#ffffff" filter="url(#cg-suave)">
            @for (c of columnas; track c[0]) {
              <rect [attr.x]="c[0]" [attr.y]="c[1]" [attr.width]="c[2]" height="1000" stroke="none" [attr.fill-opacity]="c[3]" />
            }
            <g fill="none" stroke-opacity="0.06" stroke-width="3">
              <path d="M0 175 L620 95 M0 262 L640 192" />
              <path d="M0 560 L262 616 M0 642 L270 706 M0 732 L250 792 M0 862 L300 822" />
              <path d="M540 332 L860 302 M540 402 L860 382 M560 472 L860 456" />
            </g>
            <rect x="650" y="600" width="210" height="58" stroke="none" fill-opacity="0.045" />
            <rect x="660" y="690" width="200" height="70" stroke="none" fill-opacity="0.055" />
            <path d="M0 600 L300 676 M0 700 L320 780 M330 860 L600 790" fill="none" stroke="#000000" stroke-opacity="0.1" stroke-width="7" />
            <path
              d="M0 758 L250 800 M0 792 L250 836 M60 700 V900 M120 712 V910 M180 724 V920 M650 780 L860 760 M650 832 L860 814 M700 740 V900 M780 735 V900"
              fill="none"
              stroke-opacity="0.08"
              stroke-width="1.5"
            />
          </g>
          <rect x="-1600" y="-800" width="2600" height="2600" fill="url(#cg-arriba)" />
          <rect x="-1600" y="-800" width="2600" height="2600" fill="url(#cg-niebla)" />
          <rect x="-1600" y="-800" width="2600" height="2600" fill="url(#cg-rojo)" />
          <path d="M-40 800 C 160 820 380 900 600 1000" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.2" />
          <!-- Reflejo que cruza la cara oscura una vez al terminar la entrada -->
          <rect
            class="entrada-reflejo [animation-delay:2900ms]"
            x="-760"
            y="-400"
            width="380"
            height="1900"
            fill="url(#cg-reflejo)"
            opacity="0"
            transform="rotate(16 -610 550)"
          />
        </g>
      </g>
    </svg>

    <!-- Vidrio del canto de la carta principal: se oscurece hacia la cara oscura y hacia la izquierda -->
    <div
      class="entrada-carta absolute overflow-hidden bg-linear-65 from-[#2e3135]/85 via-[#8d9094]/70 to-[#d6d8db]/70 backdrop-blur-[12px] [--dx:-48] [--dy:0]"
      style="clip-path: url(#cg-canto)"
      [style.left]="u(cajaCanto[0])"
      [style.top]="u(cajaCanto[1])"
      [style.width]="u(cajaCanto[2])"
      [style.height]="u(cajaCanto[3])"
    >
      <span
        class="entrada-destello absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-linear-to-r from-transparent via-white/45 to-transparent opacity-0 [animation-delay:2950ms]"
      ></span>
    </div>

    <!-- Frente: filos de la carta principal, conexiones y puntos -->
    <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 1586 992" fill="none">
      <g class="entrada-placa" stroke-linecap="round" stroke-linejoin="round">
        <!-- canto exterior: filo oscuro por fuera y línea brillante por dentro -->
        <path [attr.d]="contorno" stroke="#000000" stroke-opacity="0.22" stroke-width="2.6" />
        <path [attr.d]="contorno" stroke="url(#cg-borde)" stroke-width="1.3" />
        <!-- inicio de la cara oscura -->
        <path [attr.d]="lineaB" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1" />
      </g>

      <g stroke="#ffffff" stroke-opacity="0.72" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        @for (c of conexiones; track c.d) {
          <path
            class="entrada-trazo"
            pathLength="1"
            [attr.d]="c.d"
            [attr.stroke]="c.trazo ?? null"
            [attr.stroke-opacity]="c.trazo ? 1 : (c.opacidad ?? null)"
            [style.animation-delay.ms]="c.inicio"
            [style.animation-duration.ms]="c.duracion"
          />
        }
      </g>

      @for (p of puntosRojos; track $index) {
        <g class="entrada-punto" [style.animation-delay.ms]="p[4]">
          <circle
            class="entrada-latido"
            [attr.cx]="p[0]"
            [attr.cy]="p[1]"
            [attr.r]="p[2] * 1.7"
            fill="#ff2a2f"
            opacity="0.6"
            filter="url(#cg-halo)"
            [style.animation-delay.ms]="3000 + $index * 140"
          />
          <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="p[2]" fill="#ff2f35" />
          <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="p[2] * p[3]" fill="#ffe9ea" />
        </g>
      }
      @for (p of puntosBlancos; track $index) {
        <g class="entrada-punto" [style.animation-delay.ms]="p[3]">
          <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="p[2] * 2" fill="#ffffff" opacity="0.55" filter="url(#cg-halo)" />
          <circle [attr.cx]="p[0]" [attr.cy]="p[1]" [attr.r]="p[2]" fill="#ffffff" />
        </g>
      }
    </svg>

    <!--
      Tarjetas de módulos. El span exterior se mueve (translate/scale); el interior es el vidrio y es el único que
      anima su opacidad (ver nota de backdrop root en entrada-login.css). Relleno translúcido que se aclara hacia
      abajo a la derecha, borde brillante (más en la orilla derecha), filo oscuro exterior, brillo interior y
      desenfoque de lo que hay detrás. Se inclinan con skewY desde su esquina superior izquierda, icono incluido.
    -->
    @for (m of modulos; track m.id) {
      <span
        class="entrada-tarjeta absolute"
        [style.left]="u(m.x)"
        [style.top]="u(m.y)"
        [style.width]="u(m.w)"
        [style.height]="u(m.h)"
        [style.animation-delay.ms]="m.inicio"
      >
        <span
          class="entrada-aparecer absolute inset-0 flex origin-top-left items-center justify-center rounded-[calc(var(--u)*12)] border-[1.5px] border-white/70 border-r-white/90 border-b-white/80 bg-linear-135 from-white/10 to-white/30 shadow-[0_0_0_1px_rgb(0_0_0/0.3),inset_0_1px_0_rgb(255_255_255/0.3),inset_0_0_calc(var(--u)*8)_rgb(255_255_255/0.12),0_calc(var(--u)*8)_calc(var(--u)*18)_rgb(0_0_0/0.2)] backdrop-blur-[5px]"
          [style.transform]="'skewY(' + inclinacion(m.k) + 'deg)'"
          [style.animation-delay.ms]="m.inicio"
        >
          <svg
            [attr.viewBox]="iconos[m.id].caja"
            fill="none"
            stroke="#ffffff"
            stroke-opacity="0.95"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="overflow-visible drop-shadow-[0_0_calc(var(--u)*3)_rgb(255_255_255/0.4)]"
            [style.width]="u(m.iw)"
            [style.height]="u(m.ih)"
            [style.translate]="u(m.dx) + ' ' + u(m.dy)"
          >
            @for (b of iconos[m.id].barras ?? []; track $index) {
              <rect
                class="entrada-crecer"
                [attr.x]="b[0]"
                [attr.y]="b[1]"
                [attr.width]="b[2]"
                [attr.height]="b[3]"
                fill="#ffffff"
                fill-opacity="0.7"
                stroke-width="1"
                [style.animation-delay.ms]="m.inicio + 380 + $index * 90"
              />
            }
            @for (t of iconos[m.id].trazos; track $index) {
              <path
                class="entrada-trazo"
                pathLength="1"
                [attr.d]="t"
                [style.animation-delay.ms]="m.inicio + 300 + $index * 60"
                [style.animation-duration.ms]="800"
              />
            }
          </svg>
        </span>
      </span>
    }
  `,
})
export class CapasGlass {
  protected readonly modulos = MODULOS;
  protected readonly iconos = ICONOS;
  protected readonly conexiones = CONEXIONES;
  protected readonly u = u;
  protected readonly inclinacion = (k: number) => -Math.atan(k) * (180 / Math.PI);

  protected readonly cartas = CARTAS.map((c) => ({ ...c, recorte: rutaRelativa(c.tramos, c.caja) }));

  protected readonly cajaCanto = CAJA_CANTO;
  protected readonly cantoRelativo = rutaRelativa(CANTO, CAJA_CANTO);

  /** [x, y, radio, tamaño del centro claro respecto al radio, ms en que se enciende] */
  protected readonly puntosRojos = [
    [487, 629.5, 6, 0.5, 1850],
    [628.5, 688.5, 6.5, 0.72, 2500],
    [631.5, 765.5, 4.8, 0.4, 2780],
  ];
  /** [x, y, radio, ms en que se enciende] */
  protected readonly puntosBlancos = [
    [768, 474.5, 4.4, 1550],
    [740, 602.5, 3.4, 2750],
    [402, 775.5, 4.4, 2150],
  ];
  /** Columnas de la nave: [x, y inicial, ancho, opacidad] */
  protected readonly columnas = [
    [128, 150, 5, 0.04],
    [226, 100, 4, 0.035],
    [296, 120, 3, 0.03],
    [468, 90, 7, 0.05],
    [518, 90, 3, 0.035],
    [624, 90, 6, 0.05],
    [698, 110, 4, 0.06],
    [748, 120, 3, 0.05],
  ];

  // Carta principal en coordenadas del mockup; se prolonga muy afuera del lienzo (izquierda y abajo).
  /** Cara oscura: debajo de la línea B, hasta el canto derecho e inferior. */
  protected readonly placa =
    'M-1600 -425 L780 170 Q806 176 814 205 L838 400 L864 600 L876 705 L877 790 Q878 818 852 832 L560 1000 L330 1900 L-1600 1900 Z';
  /** Canto exterior: línea A, esquina, orilla derecha y orilla inferior. */
  protected readonly contorno =
    'M-1600 -546.2 L785 145.5 Q812 158 814 205 L838 400 L864 600 L876 705 L877 790 Q878 818 852 832 L560 1000 L330 1900';
  protected readonly lineaB = 'M-1600 -425 L780 170 Q806 176 814 205';
}
