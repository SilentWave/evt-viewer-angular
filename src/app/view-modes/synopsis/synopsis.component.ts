import { Component, OnDestroy, OnInit } from '@angular/core';
import { SynopsisService } from './synopsis.service';
import { combineLatest, map, Subscription } from 'rxjs';
import { PageChangedArgs, SynopsisEdition, XmlIdChangedArgs } from './synopsis.models';
import { CompactType, DisplayGrid, GridsterConfig, GridsterItem, GridType } from 'angular-gridster2';

@Component({
  selector: 'evt-synopsis',
  templateUrl: './synopsis.component.html',
  styleUrls: ['./synopsis.component.scss']
})
export class SynopsisComponent implements OnInit, OnDestroy {
  public readonly gridsterOptions: GridsterConfig = {
    gridType: GridType.Fit,
    displayGrid: DisplayGrid.None,
    margin: 0,
    maxCols: 2,
    maxRows: 1,
    draggable: {
      enabled: false,
    },
    resizable: {
      enabled: false,
    },
  };

  public otherPanelGridsterItem: GridsterItem = { cols: 2, rows: 1, y: 0, x: 1 };

  public otherPanelGridsterOptions: GridsterConfig = {
    gridType: GridType.ScrollHorizontal,
    displayGrid: DisplayGrid.None,
    compactType: CompactType.CompactLeft,
    scrollToNewItems: true,
    margin: 0,
    maxRows: 1,
    draggable: {
      enabled: true,
      ignoreContent: true,
      dragHandleClass: 'panel-header',
    },
    resizable: {
      enabled: false,
    },
    mobileBreakpoint: 0,
    // itemResizeCallback: this.updateFixedColWidth.bind(this),
    // itemChangeCallback: this.itemChange.bind(this),
  };

  public allEditions: SynopsisEdition[] = [];
  public mainEdition: SynopsisEditionItem;
  public otherEditions: SynopsisEditionItem[] = [];

  private editionsSubscription: Subscription;
  error: string | null;

  constructor(
    private synopsisService: SynopsisService
  ) {
  }

  ngOnInit() {
    this.editionsSubscription = combineLatest([
      this.synopsisService.allEditions$,
      this.synopsisService.mainEdition$,
      this.synopsisService.otherEditions$
    ]).pipe(
      map(([_, main, others]) => {
        this.mainEdition = {
          edition: main,
          gridsterItem: { cols: 1, rows: 1, y: 0, x: 0 }
        }
        this.otherEditions = others.map((x, i) => ({
          edition: x,
          gridsterItem: { cols: 1, rows: 1, y: 0, x: i + 1 }
        }));
        this.allEditions = [this.mainEdition.edition, ...this.otherEditions.map(x => x.edition)]
      })).subscribe(() => this.changeXmlId({
        editionTitle: this.mainEdition.edition.editionTitle,
        xmlId: this.mainEdition.edition.selectedPage.selectedXmlId
      }));
  }

  changePage(args: PageChangedArgs): void {
    const edition = this.allEditions.find(x => x.editionTitle === args.editionTitle);
    const newPage = edition.pages.find(x => x.id == args.pageId);
    const newPageXmlIds = this.synopsisService.getXmlIdsWithCorrespInOtherEditions(this.allEditions.map(x => x.editionSource), newPage);
    edition.selectedPage.page = newPage;
    edition.selectedPage.xmlIds = newPageXmlIds;

    this.changeXmlId({ editionTitle: edition.editionTitle, xmlId: newPageXmlIds[0] })
  }

  changeXmlId(args: XmlIdChangedArgs): void {
    const edition = this.allEditions.find(x => x.editionTitle === args.editionTitle);
    const newXmlId = edition.selectedPage.xmlIds.find(x => x === args.xmlId);
    edition.selectedPage.selectedXmlId = newXmlId;

    const otherEditions = this.allEditions.filter(x => x.editionTitle !== args.editionTitle);
    for (const otherEdition of otherEditions) {
      console.group(otherEdition.editionTitle)

      const newPage = this.synopsisService.getCorrespPageOrDefault(otherEdition.pages, newXmlId);
      if (!newPage) {
        console.log("No corresp page found", newXmlId);
        console.groupEnd();
        continue;
      }

      console.log("Corresp page found", newPage);

      if (newPage.id === otherEdition.selectedPage.page.id) {
        console.log("The corresp page found is the current one")
      }

      const newPageXmlIds = this.synopsisService.getXmlIdsWithCorrespInOtherEditions(this.allEditions.map(x => x.editionSource), newPage);
      const element = this.synopsisService.getPageElementByAttributeOrDefault(newPage, { key: "corresp", value: newXmlId });
      const elementXmlId = element?.getAttribute("xml:id");
      console.log("Element found is", element, newXmlId, elementXmlId);

      if (!newPageXmlIds.length && elementXmlId) {
        newPageXmlIds.push(elementXmlId)
      }

      otherEdition.selectedPage.page = newPage;
      otherEdition.selectedPage.xmlIds = newPageXmlIds;
      otherEdition.selectedPage.selectedXmlId = elementXmlId;
      otherEdition.selectedPage.pageSelectionList.selectedPage = {
        pageId: newPage.id,
        pageLabel: newPage.label,
      }

      console.groupEnd();
    }
  }

  getGridsterItemForIndex(index: number) {
    return { cols: 1, rows: 1, y: 0, x: index }
  }

  ngOnDestroy(): void {
    this.editionsSubscription.unsubscribe();
  }
}

export interface SynopsisEditionItem {
  edition: SynopsisEdition;
  gridsterItem: GridsterItem;
}