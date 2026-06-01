import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Invitados } from './invitados/invitados';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'invitados', component: Invitados },
];
