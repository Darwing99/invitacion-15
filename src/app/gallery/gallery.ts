import {
  Component,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GALLERY_FILES } from './gallery-manifest';

interface Photo {
  src: string;
  full: string;
  alt: string;
}

const PHOTOS: Photo[] = GALLERY_FILES.map((f: string) => ({
  src: f,
  full: f,
  alt: 'Ivana Lilibeth',
}));

@Component({
  selector: 'app-gallery',
  imports: [CommonModule],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery implements AfterViewInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private el = inject(ElementRef<HTMLElement>);
  private transitioning = false;
  private touchStartX = 0;

  photos = PHOTOS;
  activeIndex = 0;
  lightboxOpen = false;

  ngAfterViewInit() {
    gsap.registerPlugin(ScrollTrigger);
    this.initGridAnimations();
  }

  ngOnDestroy() {
    ScrollTrigger.getAll().forEach((t) => t.kill());
    gsap.killTweensOf(this.el.nativeElement.querySelectorAll('*'));
    document.body.style.overflow = '';
  }

  open(i: number) {
    this.activeIndex = i;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      const lightbox = this.el.nativeElement.querySelector('.lightbox');
      const img = this.el.nativeElement.querySelector('.lightbox__img');
      if (!lightbox || !img) return;

      gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(
        img,
        { opacity: 0, scale: 0.82, y: 24 },
        { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.4)' },
      );
    });
  }

  close() {
    const lightbox = this.el.nativeElement.querySelector('.lightbox');
    if (lightbox) {
      gsap.to(lightbox, {
        opacity: 0,
        duration: 0.25,
        onComplete: () => {
          this.lightboxOpen = false;
          document.body.style.overflow = '';
          this.cdr.detectChanges();
        },
      });
    } else {
      this.lightboxOpen = false;
      document.body.style.overflow = '';
      this.cdr.detectChanges();
    }
  }

  prev() {
    this.navigate(-1);
  }

  next() {
    this.navigate(1);
  }

  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.changedTouches[0].clientX;
  }

  onTouchEnd(e: TouchEvent) {
    const diff = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) this.prev();
    else this.next();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (!this.lightboxOpen) return;
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }

  private navigate(delta: number) {
    if (this.transitioning || !this.lightboxOpen) return;

    const img = this.el.nativeElement.querySelector('.lightbox__img');
    if (!img) return;

    this.transitioning = true;
    const outX = delta > 0 ? -70 : 70;
    const inX = delta > 0 ? 70 : -70;

    gsap.to(img, {
      opacity: 0,
      x: outX,
      scale: 0.9,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        this.activeIndex =
          (this.activeIndex + delta + this.photos.length) % this.photos.length;
        this.cdr.detectChanges();

        gsap.fromTo(
          img,
          { opacity: 0, x: inX, scale: 0.9 },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: () => {
              this.transitioning = false;
            },
          },
        );
      },
    });
  }

  private initGridAnimations() {
    const grid = this.el.nativeElement.querySelector('.galeria__grid');
    const items = this.el.nativeElement.querySelectorAll('.galeria__item');
    if (!grid || !items.length) return;

    gsap.from(items, {
      opacity: 0,
      y: 52,
      scale: 0.86,
      rotation: (i: number) => (i % 2 === 0 ? -4 : 4),
      duration: 0.9,
      stagger: 0.13,
      ease: 'back.out(1.3)',
      scrollTrigger: {
        trigger: grid,
        start: 'top 88%',
        once: true,
      },
    });
  }
}
