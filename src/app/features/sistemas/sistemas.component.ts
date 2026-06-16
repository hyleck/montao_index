import { Component, inject } from '@angular/core';
import { IndexWorkspaceService } from '../../index-workspace.service';

@Component({
  selector: 'app-sistemas',
  templateUrl: './sistemas.component.html',
})
export class SistemasComponent {
  readonly vm = inject(IndexWorkspaceService);
}
