import { Component, ElementRef, afterNextRender, input, signal, viewChild } from '@angular/core';

/**
 * Recuadro para firmar con el dedo, el lápiz o el mouse (pointer events). La firma es la imagen; el nombre de quien firma
 * va aparte en texto (es lo que leen los lectores de pantalla y lo que se guarda como dato). `png()` la entrega como
 * imagen (null si no hay trazo).
 */
@Component({
  selector: 'app-firma',
  host: { class: 'block' },
  template: `
    <div class="relative">
      <canvas
        #lienzo
        width="600"
        height="180"
        class="block h-36 w-full touch-none rounded-lg border border-acero-oscuro bg-white"
        role="img"
        [attr.aria-label]="etiqueta() + (vacia() ? ': sin firma' : ': firmado')"
        (pointerdown)="empezar($event)"
        (pointermove)="trazar($event)"
        (pointerup)="terminar()"
        (pointerleave)="terminar()"
      ></canvas>
      @if (vacia()) {
        <span class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-texto-suave" aria-hidden="true">Firma aquí</span>
      }
    </div>
    <button
      type="button"
      class="mt-1 rounded text-xs font-semibold text-epico-oscuro underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-epico disabled:opacity-50"
      [disabled]="vacia()"
      (click)="borrar()"
    >
      Borrar firma
    </button>
  `,
})
export class Firma {
  readonly etiqueta = input('Firma');
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  protected readonly vacia = signal(true);
  private dibujando = false;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    afterNextRender(() => {
      this.ctx = this.lienzo().nativeElement.getContext('2d');
      if (this.ctx) {
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#1A1A1C';
      }
    });
  }

  private punto(e: PointerEvent): [number, number] {
    const c = this.lienzo().nativeElement;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  }
  protected empezar(e: PointerEvent): void {
    if (!this.ctx) return;
    this.dibujando = true;
    this.lienzo().nativeElement.setPointerCapture(e.pointerId);
    const [x, y] = this.punto(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }
  protected trazar(e: PointerEvent): void {
    if (!this.dibujando || !this.ctx) return;
    const [x, y] = this.punto(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.vacia.set(false);
  }
  protected terminar(): void {
    this.dibujando = false;
  }
  borrar(): void {
    const c = this.lienzo().nativeElement;
    this.ctx?.clearRect(0, 0, c.width, c.height);
    this.vacia.set(true);
  }
  /** La firma como PNG; null si no hay trazo. */
  png(): Promise<Blob | null> {
    if (this.vacia()) return Promise.resolve(null);
    return new Promise((r) => this.lienzo().nativeElement.toBlob((b) => r(b), 'image/png'));
  }
}
