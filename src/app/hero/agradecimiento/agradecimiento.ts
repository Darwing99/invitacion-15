import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-hero-agradecimiento',
  imports: [],
  templateUrl: './agradecimiento.html',
  styleUrl: './agradecimiento.scss',
})
export class HeroAgradecimiento {
  @Input() nombre = 'Ivana';
}
