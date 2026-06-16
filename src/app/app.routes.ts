import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'sistemas',
  },
  {
    path: 'sistemas',
    loadComponent: () =>
      import('./features/sistemas/sistemas.component').then((module) => module.SistemasComponent),
  },
  {
    path: 'correos',
    loadComponent: () =>
      import('./features/correos/correos.component').then((module) => module.CorreosComponent),
  },
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./features/usuarios/usuarios.component').then((module) => module.UsuariosComponent),
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('./features/configuracion/configuracion.component').then((module) => module.ConfiguracionComponent),
  },
  {
    path: '**',
    redirectTo: 'sistemas',
  },
];
