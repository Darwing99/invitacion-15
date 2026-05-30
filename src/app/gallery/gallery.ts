import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GALLERY_FILES } from './gallery-manifest';

interface Photo { src: string; full: string; alt: string; }

const PHOTOS: Photo[] = GALLERY_FILES.map((f: string) => ({
  src: f, full: f, alt: 'Ivana Lilibeth',
}));

@Component({
  selector: 'app-gallery',
  imports: [CommonModule],
  templateUrl: './gallery.html',
  styleUrl: './gallery.scss',
})
export class Gallery {
  private cdr = inject(ChangeDetectorRef);

  photos = PHOTOS;

  activeIndex = 0;
  lightboxOpen = false;

  open(i: number) {
    this.activeIndex = i;
    this.lightboxOpen = true;
    this.cdr.detectChanges();
  }

  close() {
    this.lightboxOpen = false;
    this.cdr.detectChanges();
  }

  prev() {
    this.activeIndex = (this.activeIndex - 1 + this.photos.length) % this.photos.length;
    this.cdr.detectChanges();
  }

  next() {
    this.activeIndex = (this.activeIndex + 1) % this.photos.length;
    this.cdr.detectChanges();
  }
}
