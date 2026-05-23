import { Component, OnInit } from '@angular/core';
import { Hero } from './hero/hero';
import { Gallery } from './gallery/gallery';
import { Location } from './location/location';
import { Rsvp } from './rsvp/rsvp';
import AOS from 'aos';

@Component({
  selector: 'app-root',
  imports: [Hero, Gallery, Location, Rsvp],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  ngOnInit() {
    AOS.init({ duration: 900, once: true, offset: 60, easing: 'ease-out-cubic' });
  }
}
