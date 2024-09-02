import { Component, OnDestroy, OnInit } from '@angular/core';
import { SynopsisService } from './synopsis.service';
import { Subscription } from 'rxjs';
import { SynopsisEdition } from './synopsis.models';

@Component({
  selector: 'evt-synopsis',
  templateUrl: './synopsis.component.html',
  styleUrls: ['./synopsis.component.scss']
})
export class SynopsisComponent implements OnInit, OnDestroy {
  editions: SynopsisEdition[];
  private editionsSubscription: Subscription;

  constructor(
    private synopsisService: SynopsisService
  ) {
  }

  ngOnInit() {
    this.editionsSubscription = this.synopsisService.editions$.subscribe(editions => {
      this.editions = editions;
      console.log(this.editions);
    });
  }

  ngOnDestroy(): void {
    this.editionsSubscription.unsubscribe();
  }
}
