import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SynopsisEdition, PageChangedArgs, XmlIdChangedArgs, EditionLevelChangedArgs } from '../synopsis.models';
import { Subject } from 'rxjs';
import { EntitiesSelectItem } from 'src/app/components/entities-select/entities-select.component';
import { EditionLevel } from 'src/app/app.config';

@Component({
  selector: 'evt-synopsis-text-panel',
  templateUrl: './synopsis-text-panel.component.html',
  styleUrls: ['./synopsis-text-panel.component.scss']
})
export class SynopsisTextPanelComponent implements OnInit {
  @Input() edition: SynopsisEdition;
  @Output() onPageChanged = new EventEmitter<PageChangedArgs>();
  @Output() onXmlIdChanged = new EventEmitter<XmlIdChangedArgs>();
  @Output() onEditionLevelChanged = new EventEmitter<EditionLevelChangedArgs>();

  public itemsToHighlight$ = new Subject<EntitiesSelectItem[]>();

  constructor(
  ) {
  }

  ngOnInit(): void {

  }

  changePage(pageId: string): void {
    this.onPageChanged.emit({ editionTitle: this.edition.editionTitle, pageId: pageId });
  }

  changeXmlId(xmlId: string): void {
    this.onXmlIdChanged.emit({ editionTitle: this.edition.editionTitle, xmlId: xmlId })
  }

  changeSelection(items: EntitiesSelectItem[]) {
    this.itemsToHighlight$.next(items)
  }

  changeEditionLevel(level: EditionLevel) {
    this.onEditionLevelChanged.emit({ editionTitle: this.edition.editionTitle, editionLevel: level });
  }
}