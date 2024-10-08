import { Component, EventEmitter, Output } from '@angular/core';
import { TextFlow } from 'src/app/app.config';
import { EvtIconInfo } from 'src/app/ui-components/icon/icon.component';
import { AppConfig } from 'src/app/app.config';

@Component({
  selector: 'evt-verse-prose-select',
  templateUrl: './verse-prose-select.component.html',
  styleUrls: ['./verse-prose-select.component.scss'],
})

export class VerseProseSelectComponent {

  @Output() textModeSelectionChange: EventEmitter<TextFlow> = new EventEmitter();

  public defaultTextFlow: TextFlow = AppConfig.evtSettings.edition.defaultTextFlow;

  public textFlowTypes: TextFlow[] = ['prose', 'prose_mixed', 'verses'];

  public selectedType: TextFlow = this.defaultTextFlow;

  getProseVersesTogglerIcon(textFlowMode: TextFlow): EvtIconInfo {
    return { icon: textFlowMode === 'verses' ? 'align-justify' : 'align-left', iconSet: 'fas' };
  }

  updateSelectedType(textFlowType: TextFlow) {
    this.textModeSelectionChange.emit(textFlowType);
  };

}
