import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexWorkspaceService } from '../../index-workspace.service';

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  readonly vm = inject(IndexWorkspaceService);

  ngOnInit(): void {
    if (this.vm.canManageUsers()) {
      void this.vm.loadPlatformUsers();
    }
  }
}
