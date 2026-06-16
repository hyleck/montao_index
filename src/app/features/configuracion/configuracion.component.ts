import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexWorkspaceService } from '../../index-workspace.service';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.component.html',
})
export class ConfiguracionComponent {
  readonly vm = inject(IndexWorkspaceService);
}
