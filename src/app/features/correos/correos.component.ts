import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexWorkspaceService } from '../../index-workspace.service';

@Component({
  selector: 'app-correos',
  imports: [FormsModule],
  templateUrl: './correos.component.html',
})
export class CorreosComponent implements OnInit {
  readonly vm = inject(IndexWorkspaceService);

  ngOnInit(): void {
    void this.vm.initializeMailbox();
  }
}
