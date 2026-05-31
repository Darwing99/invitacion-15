import {
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  inject,
} from '@angular/core';
import { gsap } from 'gsap';

@Component({
  selector: 'app-hero-banner',
  imports: [],
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
})
export class HeroBanner implements AfterViewInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private el = inject(ElementRef<HTMLElement>);
  private idleTweens: gsap.core.Tween[] = [];

  @Input() nombreLinea1 = 'Ivana Lilibeth';
  @Input() nombreLinea2 = 'Peralta Garmendia';

  playing = false;
  private audio: HTMLAudioElement | null = null;

  ngAfterViewInit() {
    this.audio = new Audio('src/15%20lilibeth%20(2).mp3');
    this.audio.loop = true;
    this.runLetterAnimations();
  }

  ngOnDestroy() {
    this.idleTweens.forEach((t) => t.kill());
    gsap.killTweensOf(this.el.nativeElement.querySelectorAll('*'));
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
      this.audio
        .play()
        .then(() => {
          this.playing = true;
          this.cdr.markForCheck();
        })
        .catch(() => {});
    }
  }

  private runLetterAnimations() {
    const root = this.el.nativeElement;
    const misChars = root.querySelectorAll('.banner__mis .banner__char');
    const xvChars = root.querySelectorAll('.banner__xv .banner__char');
    const anosChars = root.querySelectorAll('.banner__anos .banner__char');
    const player = root.querySelector('.banner__player');

    const tl = gsap.timeline({ delay: 0.2 });

    tl.from(misChars, {
      opacity: 0,
      y: -40,
      rotationX: -75,
      transformOrigin: '50% 100%',
      duration: 0.75,
      stagger: 0.14,
      ease: 'back.out(2)',
    })
      .from(
        xvChars,
        {
          opacity: 0,
          scale: 0.2,
          rotation: -18,
          transformOrigin: '50% 80%',
          duration: 1.05,
          stagger: 0.18,
          ease: 'elastic.out(1.1, 0.45)',
        },
        '-=0.35',
      )
      .from(
        anosChars,
        {
          opacity: 0,
          y: 45,
          rotationX: 75,
          transformOrigin: '50% 0%',
          duration: 0.8,
          stagger: 0.1,
          ease: 'back.out(2)',
        },
        '-=0.55',
      );

    if (player) {
      tl.from(
        player,
        {
          opacity: 0,
          y: 22,
          scale: 0.88,
          duration: 0.85,
          ease: 'power3.out',
        },
        '-=0.2',
      );
    }

    tl.add(() => this.startIdleAnimations(misChars, xvChars, anosChars));
  }

  private startIdleAnimations(
    misChars: NodeListOf<Element>,
    xvChars: NodeListOf<Element>,
    anosChars: NodeListOf<Element>,
  ) {
    this.idleTweens.push(
      gsap.to(misChars, {
        y: -5,
        duration: 2.4,
        stagger: { each: 0.18, yoyo: true, repeat: -1 },
        ease: 'sine.inOut',
      }),
      gsap.to(xvChars, {
        y: -6,
        scale: 1.05,
        duration: 3,
        stagger: { each: 0.25, yoyo: true, repeat: -1 },
        ease: 'sine.inOut',
      }),
      gsap.to(anosChars, {
        y: -4,
        duration: 2.6,
        stagger: { each: 0.14, yoyo: true, repeat: -1 },
        ease: 'sine.inOut',
        delay: 0.4,
      }),
    );
  }
}
