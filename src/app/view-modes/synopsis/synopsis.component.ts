import { Component, OnDestroy, OnInit } from '@angular/core';
import { SynopsisService } from './synopsis.service';
import { Subscription } from 'rxjs';
import { PageChangedArgs, SynopsisEdition, XmlIdChangedArgs } from './synopsis.models';
import { DisplayGrid, GridsterConfig, GridType } from 'angular-gridster2';

@Component({
  selector: 'evt-synopsis',
  templateUrl: './synopsis.component.html',
  styleUrls: ['./synopsis.component.scss']
})
export class SynopsisComponent implements OnInit, OnDestroy {
  public readonly options: GridsterConfig = {
    gridType: GridType.Fit,
    displayGrid: DisplayGrid.None,
    margin: 0,
    maxCols: 5,
    maxRows: 1,
    draggable: {
      enabled: true,
      ignoreContent: true,
      dragHandleClass: 'panel-header',
    },
    resizable: {
      enabled: false,
    },
  };

  public editions: SynopsisEdition[];
  private editionsSubscription: Subscription;
  error: string | null;

  constructor(
    private synopsisService: SynopsisService
  ) {
  }

  ngOnInit() {
    this.editionsSubscription = this.synopsisService.allEditions$.subscribe({
      next: (editions) => {
        this.editions = editions;
        this.changeXmlId({ editionTitle: editions[0].editionTitle, xmlId: editions[0].selectedPage.selectedXmlId })
      },
      error: e => { this.error = e; }
    });
  }

  changePage(args: PageChangedArgs): void {
    const edition = this.editions.find(x => x.editionTitle === args.editionTitle);
    const newPage = edition.pages.find(x => x.id == args.pageId);
    const newPageXmlIds = this.synopsisService.getXmlIdsWithCorrespInOtherEditions(this.editions.map(x => x.editionSource), newPage);
    edition.selectedPage.page = newPage;
    edition.selectedPage.xmlIds = newPageXmlIds;

    this.changeXmlId({ editionTitle: edition.editionTitle, xmlId: newPageXmlIds[0] })
  }

  changeXmlId(args: XmlIdChangedArgs): void {
    const edition = this.editions.find(x => x.editionTitle === args.editionTitle);
    const newXmlId = edition.selectedPage.xmlIds.find(x => x === args.xmlId);
    edition.selectedPage.selectedXmlId = newXmlId;

    const otherEditions = this.editions.filter(x => x.editionTitle !== args.editionTitle);
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

      const newPageXmlIds = this.synopsisService.getXmlIdsWithCorrespInOtherEditions(this.editions.map(x => x.editionSource), newPage);
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