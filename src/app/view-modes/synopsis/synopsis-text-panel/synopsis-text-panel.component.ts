import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SynopsisEdition, PageChangedArgs, XmlIdChangedArgs } from '../synopsis.models';

@Component({
  selector: 'evt-synopsis-text-panel',
  templateUrl: './synopsis-text-panel.component.html',
  styleUrls: ['./synopsis-text-panel.component.scss']
})
export class SynopsisTextPanelComponent implements OnInit {
  @Input() edition: SynopsisEdition;
  @Output() onPageChanged = new EventEmitter<PageChangedArgs>();
  @Output() onXmlIdChanged = new EventEmitter<XmlIdChangedArgs>();

  constructor(
  ) {
  }

  ngOnInit(): void {
    console.log("ngOnInit", this.edition.editionTitle)
  }

  changePage(pageId: string): void {
    this.onPageChanged.emit({ editionTitle: this.edition.editionTitle, pageId: pageId });
  }

  changeXmlId(xmlId: string): void {
    this.onXmlIdChanged.emit({editionTitle: this.edition.editionTitle, xmlId: xmlId })
  }
}


