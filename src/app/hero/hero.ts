import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { Butterflies, ButterflySpec } from '../butterflies/butterflies';

interface TimeLeft {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
}

@Component({
  selector: 'app-hero',
  imports: [CommonModule, Butterflies],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero implements OnInit, AfterViewInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  nombreLinea1 = 'Ivana Lilibeth';
  nombreLinea2 = 'Peralta Garmendia';
  madre = 'Elizabeth Garmendia Meza';
  padre = 'Cesar Ivan Peralta';
  fecha = new Date('2026-06-27T18:00:00');

  bannerButterflies: ButterflySpec[] = [
    { size: 28, top: '16%', left: '20%', delay: 0, aos: 'fade-down', aosDelay: 0, style: 'classic' },
    { size: 24, top: '45%', left: '70%', delay: 8, aos: 'zoom-in', aosDelay: 200, style: 'delicate' },
  ];

  poemaButterflies: ButterflySpec[] = [
    { size: 26, top: '12%', left: '30%', delay: 4, aos: 'fade-down', aosDelay: 0, style: 'delicate' },
  ];

  quinceButterflies: ButterflySpec[] = [
    { size: 30, top: '15%', left: '35%', delay: 2, aos: 'zoom-in', aosDelay: 0, style: 'elegant' },
  ];

  playing = false;
  private audio: HTMLAudioElement | null = null;

  timeLeft: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
  private interval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.calcularTiempo();
    this.interval = setInterval(() => this.calcularTiempo(), 1000);
    this.audio = new Audio('src/15%20lilibeth%20(2).mp3');
    this.audio.loop = true;
  }

  ngAfterViewInit() {
    // Animación GSAP del banner al cargar
    const tl = gsap.timeline({ delay: 0.1 });
    tl.from('.banner__mis',   { y: -30, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.banner__xv',   { scale: 0.3, opacity: 0, duration: 0.9, ease: 'back.out(1.7)' }, '-=0.1')
      .from('.banner__anos', { y: 25, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
      .from('.banner__name1',{ y: 20, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2')
      .from('.banner__name2',{ y: 15, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.35')
      .from('.banner__princess', { y: 60, opacity: 0, duration: 1.1, ease: 'power2.out' }, '-=0.3')
      .from('.player',       { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, '-=0.3')
      .from('.banner .butterfly', { scale: 0, opacity: 0, duration: 1.4, stagger: 0.2, ease: 'power2.out' }, '-=0.5');
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  toggleMusic() {
    if (!this.audio) return;
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
    } else {
      this.audio.play().then(() => { this.playing = true; this.cdr.markForCheck(); }).catch(() => {});
    }
  }

  private calcularTiempo() {
    const diff = this.fecha.getTime() - Date.now();
    if (diff <= 0) {
      this.timeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
    } else {
      this.timeLeft = {
        dias:     Math.floor(diff / (1000 * 60 * 60 * 24)),
        horas:    Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutos:  Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        segundos: Math.floor((diff % (1000 * 60)) / 1000),
      };
    }
    this.cdr.markForCheck();
  }
}
