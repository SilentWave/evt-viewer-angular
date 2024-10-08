import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BibliographicList } from '../../models/evt-models';
@Component({
  selector: 'evt-biblio-list',
  templateUrl: './biblio-list.component.html',
  styleUrls: ['./biblio-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BiblioListComponent {
  @Input() data: BibliographicList;
}
