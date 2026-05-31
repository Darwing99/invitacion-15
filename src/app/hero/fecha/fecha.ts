import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TimeLeft {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
}

@Component({
  selector: 'app-hero-fecha',
  imports: [CommonModule],
  templateUrl: './fecha.html',
  styleUrl: './fecha.scss',
})
export class HeroFecha implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() fechaEvento = new Date('2026-06-27T18:00:00');

  timeLeft: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
  private interval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.calcularTiempo();
    this.interval = setInterval(() => this.calcularTiempo(), 1000);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private calcularTiempo() {
    const diff = this.fechaEvento.getTime() - Date.now();
    if (diff <= 0) {
      this.timeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
    } else {
      this.timeLeft = {
        dias: Math.floor(diff / (1000 * 60 * 60 * 24)),
        horas: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutos: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        segundos: Math.floor((diff % (1000 * 60)) / 1000),
      };
    }
    this.cdr.markForCheck();
  }
}
