import { Component, EventEmitter, Output } from '@angular/core';
import { AppConfig, EditionLevel } from 'src/app/app.config';
import { EvtIconInfo } from 'src/app/ui-components/icon/icon.component';

@Component({
  selector: 'evt-synopsis-edition-level-selector',
  templateUrl: './synopsis-edition-level-selector.component.html',
  styleUrls: ['./synopsis-edition-level-selector.component.scss']
})
export class SynopsisEditionLevelSelectorComponent {
  private editionLevels = (AppConfig.evtSettings.edition.availableEditionLevels || []).filter((el) => el.enable);
  selectableEditionLevels: EditionLevel[] = this.editionLevels.filter((el) => !el.hidden);
  editionLevel = this.selectableEditionLevels[0];
  icon: EvtIconInfo = {
    icon: 'layer-group', // TODO: Choose better icon
    additionalClasses: 'me-2',
  };

  @Output() onEditionLevelChanged = new EventEmitter<EditionLevel>();

  changeEditionLevel(level: EditionLevel) {
    this.editionLevel = level;
    this.onEditionLevelChanged.emit(level);
  }

  stopPropagation(event: MouseEvent) {
    event.stopPropagation();
  }
}
