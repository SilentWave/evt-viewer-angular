import { Mod } from 'src/app/models/evt-models';
import { BehaviorSubject } from 'rxjs';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { EditionLevelType } from 'src/app/app.config';

@Component({
  selector: 'evt-mod-detail',
  templateUrl: './mod-detail.component.html',
  styleUrls: ['./mod-detail.component.scss','../../sources/sources.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModDetailComponent {

  private modEntry: Mod;
  public boxVisible: boolean;

  public ordLayers: string[];
  public selLayer: string;

  @Output() hide: EventEmitter<void> = new EventEmitter();

  @Input() set orderedLayers(layers: string[]) {
    this.ordLayers = layers;
  }
  get orderedLayers() { return this.ordLayers; }

  @Input() set selectedLayer(layer: string) {
    this.selLayer = layer;
  }
  get selectedLayer() { return this.selLayer; }

  @Input() set mod(el: Mod) {
    this.modEntry = el;
    this.isBoxVisible();
  }
  get mod() { return this.modEntry; }

  @Input() set editionLevel(el: EditionLevelType) {
    this.editionLevelChange.next(el);
  }

  editionLevelChange = new BehaviorSubject<EditionLevelType | ''>('');

  isBoxVisible() {
    this.boxVisible = !(this.modEntry?.insideApp[0]);
  }

  emitHide() {
    this.hide.emit();
  }


}

