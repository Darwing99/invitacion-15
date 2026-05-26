import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Butterflies } from '../butterflies/butterflies';

export interface VersiculoItem {
  texto: string;
  referencia: string;
}


const VERSICULOS_XV: VersiculoItem[] = [
  {
    texto:
      'Ninguno tenga en poco tu juventud, sino sé ejemplo de los creyentes en palabra, conducta, amor, espíritu, fe y pureza.',
    referencia: '1 Timoteo 4:12',
  },
  {
    texto:
      'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y Él enderezará tus veredas.',
    referencia: 'Proverbios 3:5-6',
  },
 
  {
    texto: 'Dios está en medio de ella; no será conmovida. Dios la ayudará al amanecer.',
    referencia: 'Salmos 46:5',
  },
  {
    texto: 'Porque somos hechura de Dios, creados en Cristo Jesús para buenas obras, las cuales Dios preparó de antemano para que anduviésemos en ellas.',
    referencia: 'Efesios 2:10',
  }
];

const INTERVALO_MS = 10_000;
const FADE_MS = 500;

@Component({
  selector: 'app-versiculo',
  imports: [CommonModule, Butterflies],
  templateUrl: './versiculo.html',
  styleUrl: './versiculo.scss',
})
export class Versiculo implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  versiculos = VERSICULOS_XV;
  indice = 0;
  visible = true;

  private timer: ReturnType<typeof setInterval> | null = null;
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null;

  get actual(): VersiculoItem {
    return this.versiculos[this.indice];
  }

  ngOnInit() {
    this.timer = setInterval(() => this.siguiente(), INTERVALO_MS);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);
  }

  irA(i: number) {
    if (i === this.indice) return;
    this.cambiarA(i);
  }

  private siguiente() {
    this.cambiarA((this.indice + 1) % this.versiculos.length);
  }

  private cambiarA(nuevo: number) {
    this.visible = false;
    this.cdr.markForCheck();

    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);

    this.fadeTimeout = setTimeout(() => {
      this.indice = nuevo;
      this.visible = true;
      this.cdr.markForCheck();
    }, FADE_MS);
  }
}
