import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, Optional } from '@angular/core';
import { ApparatusEntry, ChangeLayerData, GenericElement, Reading } from '../../../models/evt-models';
import { register } from '../../../services/component-register.service';
import { EVTModelService } from '../../../services/evt-model.service';
import { distinctUntilChanged } from 'rxjs';
import { EVTStatusService } from 'src/app/services/evt-status.service';
import { ApparatusEntryDetailService } from './apparatus-entry-detail.service';
import { WitnessPanelService } from 'src/app/panels/witness-panel/witness-panel.service';
import { EditionLevelType } from 'src/app/app.config';

@Component({
  selector: 'evt-apparatus-entry-detail',
  templateUrl: './apparatus-entry-detail.component.html',
  styleUrls: ['./apparatus-entry-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ApparatusEntryDetailService]
})

@register(ApparatusEntryDetailComponent)
export class ApparatusEntryDetailComponent implements OnInit, OnDestroy {
  private subscriptions;

  @Input() data: ApparatusEntry;
  @Input() isSelected: boolean = false;

  nestedApps: ApparatusEntry[] = [];
  rdgHasCounter = false;

  @Input() selectedLayer: string;

  public orderedLayers: string[];

  public significantReadings: Reading[] = [];
  public notSignificantReadings: Reading[] = [];
  public readingItems: ReadingItem[] = [];

  public get isTabContentExpanded(): boolean {
    return this.currentTab !== undefined;
  }
  currentTab: AppTabType = undefined;

  getLayerData(changeData: ChangeLayerData) {
    this.orderedLayers = changeData?.layerOrder;
  }

  showLemma: boolean = false;

  editionLevel: EditionLevelType = 'critical';

  constructor(
    public evtModelService: EVTModelService,
    public evtStatusService: EVTStatusService,
    private apparatusEntryDetailService: ApparatusEntryDetailService,
    @Optional() private witnessPanelService?: WitnessPanelService,
  ) {
  }

  ngOnInit() {
    this.apparatusEntryDetailService.apparatusEntry = this.data;

    if (this.data.nestedAppsIDs.length > 0) {
      this.recoverNestedApps(this.data);
    }
    this.subscriptions = this.evtStatusService.currentChanges$.pipe(distinctUntilChanged()).subscribe(({ next: (data) => this.getLayerData(data) }));

    this.significantReadings = this.data.readings.filter((rdg) => rdg?.significant);
    this.notSignificantReadings = this.data.readings.filter((rdg) => !rdg.significant);
    const readings = [this.data.lemma, ...this.significantReadings, ...this.notSignificantReadings];
    this.readingItems = readings.filter(rdg => !!rdg).map((rdg, i) => {
      const result = { reading: rdg, isFirst: i === 0, isLemma: rdg.class === 'lem' }
      return result;
    });

    if (this.witnessPanelService) {
      const isWitnessExcluded = this.data.isWitnessExcluded(this.witnessPanelService.witnessId);
      this.showLemma = !!this.data.lemma && !isWitnessExcluded;
    }
    else{
      this.showLemma = false;
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  recoverNestedApps(app: ApparatusEntry) {
    const nesApps = app.lemma.content.filter((c: ApparatusEntry | GenericElement) => c.type === ApparatusEntry);
    nesApps.forEach((nesApp: ApparatusEntry) => {
      this.nestedApps = this.nestedApps.concat(nesApp);
      if (nesApp.nestedAppsIDs.length > 0) {
        this.recoverNestedApps(nesApp);
      }
    });
  }

  isAppEntry(item: GenericElement | ApparatusEntry): boolean {
    return item.type === ApparatusEntry;
  }

  getNestedAppLemma(appId: string): Reading {
    return this.nestedApps.find((c) => c.id === appId).lemma;
  }

  getNestedAppPos(appId: string): number {
    return this.nestedApps.findIndex((nesApp) => nesApp.id === appId);
  }

  onTabClicked(tab: AppTabType) {
    if (this.currentTab === tab) {
      this.currentTab = undefined;
    }
    else {
      this.currentTab = tab;
    }
  }
}

export interface ReadingItem {
  reading: Reading;
  isLemma: boolean;
  isFirst: boolean;
}

export type AppTabType = 'xml' | 'info' | 'criticalNotes' | 'ortographicVariants' | 'corrSeq' | undefined;
