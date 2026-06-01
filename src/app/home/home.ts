import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Hero } from '../hero/hero';
import { Gallery } from '../gallery/gallery';
import { Location } from '../location/location';
import { Rsvp } from '../rsvp/rsvp';
import { Butterflies } from '../butterflies/butterflies';
import { Versiculo } from '../versiculo/versiculo';
import { Vestimenta } from '../vestimenta/vestimenta';
import { Regalos } from '../regalos/regalos';
import { Footer } from '../footer/footer';
import AOS from 'aos';
import { HeroAgradecimiento } from '../hero/agradecimiento/agradecimiento';

@Component({
  selector: 'app-home',
  imports: [Hero, Gallery, Location, Vestimenta, Regalos, Rsvp, HeroAgradecimiento, Butterflies, Versiculo, Footer],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, AfterViewInit {
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
