import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Hero } from './hero/hero';
import { Gallery } from './gallery/gallery';
import { Location } from './location/location';
import { Rsvp } from './rsvp/rsvp';
import { Butterflies } from './butterflies/butterflies';
import { Versiculo } from './versiculo/versiculo';
import AOS from 'aos';

@Component({
  selector: 'app-root',
  imports: [Hero, Gallery, Location, Rsvp, Butterflies, Versiculo],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, AfterViewInit {
  ngOnInit() {
    AOS.init({
      duration: 900,
      once: false,
      offset: 50,
      easing: 'ease-out-cubic',
      mirror: true,
    });
  }

  ngAfterViewInit() {
    setTimeout(() => AOS.refresh(), 400);
    setTimeout(() => AOS.refresh(), 1200);
  }
}
