import { Routes } from '@angular/router';
import { Home } from './home/home';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'invitados',
    loadComponent: () => import('./invitados/invitados').then(m => m.Invitados),
  },
];
