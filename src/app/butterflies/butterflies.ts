import {
  Component,
  input,
  AfterViewInit,
  OnDestroy,
  viewChild,
  ElementRef,
} from '@angular/core';
import { gsap } from 'gsap';

export type ButterflyStyle = 'classic' | 'delicate' | 'elegant';

export interface ButterflySpec {
  size: number;
  top: string;
  left?: string;
  delay: number;
  aos: string;
  aosDelay: number;
  style?: ButterflyStyle;
}

const STYLES: ButterflyStyle[] = ['classic', 'delicate', 'elegant'];

@Component({
  selector: 'app-butterflies',
  templateUrl: './butterflies.html',
  styleUrl: './butterflies.scss',
})
export class Butterflies implements AfterViewInit, OnDestroy {
  private tweens: (gsap.core.Tween | gsap.core.Timeline)[] = [];

  count = input(6);
  fixed = input(false);
  specs = input<ButterflySpec[]>([]);

  container = viewChild.required<ElementRef<HTMLElement>>('container');

  defaultSpecs(): ButterflySpec[] {
    const n = this.count();
    const aosEffects = ['fade-down', 'fade-up', 'zoom-in'];
    return Array.from({ length: n }, (_, i) => ({
      size: 22 + (i % 3) * 6,
      top: `${14 + ((i * 21) % 65)}%`,
      left: `${10 + ((i * 17) % 70)}%`,
      delay: i * 3,
      aos: aosEffects[i % aosEffects.length],
      aosDelay: (i % 4) * 100,
      style: STYLES[i % STYLES.length],
    }));
  }

  resolvedSpecs(): ButterflySpec[] {
    const custom = this.specs();
    return custom.length ? custom : this.defaultSpecs();
  }

  ngAfterViewInit() {
    const root = this.container().nativeElement;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.butterfly'));

    items.forEach((el: HTMLElement, i: number) => {
      const spec = this.resolvedSpecs()[i];
      this.animateForward(el, i, spec);
    });

    if (this.fixed()) {
      gsap.from(items, {
        opacity: 0,
        scale: 0.4,
        duration: 2.2,
        stagger: 0.3,
        ease: 'power2.out',
        delay: 0.6,
      });
    }
  }

  /** Vuelo lento hacia adelante, sin desplazamiento lateral */
  private animateForward(el: HTMLElement, i: number, spec: ButterflySpec) {
    const duration = 18 + (i % 3) * 5;
    const startY = 40 + (i % 3) * 10;
    const endY = -22 - (i % 2) * 8;
    const endScale = 0.75 + spec.size / 50;

    gsap.set(el, {
      x: 0,
      y: startY,
      scale: 0.2,
      opacity: 0,
      transformOrigin: '50% 50%',
    });

    const tl = gsap.timeline({ repeat: -1, delay: spec.delay });

    tl.to(el, {
      y: endY,
      scale: endScale,
      opacity: 0.75,
      duration,
      ease: 'power1.inOut',
    })
      .to(el, { opacity: 0, duration: 2.5, ease: 'power1.in' })
      .set(el, { y: startY, scale: 0.2, opacity: 0 });

    this.tweens.push(tl);
  }

  ngOnDestroy() {
    this.tweens.forEach((t) => t.kill());
  }
}
