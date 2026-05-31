import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-presentacion',
  imports: [],
  templateUrl: './presentacion.html',
  styleUrl: './presentacion.scss',
})
export class Presentacion {
  @Input() madre = 'Elizabeth Garmendia Meza';
  @Input() padre = 'Cesar Ivan Peralta';
  @Input() nombreLinea1 = 'Ivana Lilibeth';
  @Input() nombreLinea2 = 'Peralta Garmendia';

  readonly particulas = [1, 2, 3, 4, 5, 6, 7, 8];
}
