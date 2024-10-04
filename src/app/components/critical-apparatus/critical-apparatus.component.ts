/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, Input } from '@angular/core';
import { EVTStatusService } from '../../services/evt-status.service';
import { map, Observable } from 'rxjs';
import { ApparatusEntry } from 'src/app/models/evt-models';

@Component({
  selector: 'evt-critical-apparatus',
  templateUrl: './critical-apparatus.component.html',
  styleUrls: ['./critical-apparatus.component.scss'],
})
export class CriticalApparatusComponent {
  @Input() pageID : string;

  private appClasses = ['app'];
  private apparatusInCurrentPage = this.evtStatusService.getPageElementsByClassList(this.appClasses)
  public entries$: Observable<ApparatusEntry[]> = this.apparatusInCurrentPage.pipe(
    map(data => data.flat())
  )

  stopPropagation(e: MouseEvent) {
    e.stopPropagation();
  }

  constructor(
    private evtStatusService: EVTStatusService,
  ) {}
}
