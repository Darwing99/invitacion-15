import { Component } from '@angular/core';
import { Presentacion } from '../presentacion/presentacion';
import { HeroBanner } from './banner/banner';
import { HeroPoema } from './poema/poema';
import { HeroAgradecimiento } from './agradecimiento/agradecimiento';
import { HeroFecha } from './fecha/fecha';

@Component({
  selector: 'app-hero',
  imports: [HeroBanner, Presentacion, HeroPoema, HeroFecha],
  templateUrl: './hero.html',
})
export class Hero {
  nombreLinea1 = 'Ivana Lilibeth';
  nombreLinea2 = 'Peralta Garmendia';
  madre = 'Elizabeth Garmendia Meza';
  padre = 'Cesar Ivan Peralta';
  fecha = new Date('2026-06-27T18:00:00');
}
