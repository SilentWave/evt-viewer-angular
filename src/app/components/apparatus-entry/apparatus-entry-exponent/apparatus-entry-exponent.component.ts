import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { ApparatusEntryExponent } from 'src/app/models/evt-models';
import { register } from 'src/app/services/component-register.service';
import { EVTStatusService } from 'src/app/services/evt-status.service';
import { BehaviorSubject, combineLatest, map, tap } from 'rxjs';
import { HoverService } from 'src/app/services/hover.service';
import { isElementBetween } from 'src/app/utils/dom-utils';

@Component({
  selector: 'evt-apparatus-entry-exponent',
  templateUrl: './apparatus-entry-exponent.component.html',
  styleUrls: ['./apparatus-entry-exponent.component.scss']
})
@register(ApparatusEntryExponent)
export class ApparatusEntryExponentComponent implements OnDestroy {
  @Input() data: ApparatusEntryExponent;
  @ViewChild('evtNoteButton', { read: ElementRef }) evtNoteButton!: ElementRef;

  noteType: string = 'critical'; // Temp, it's probably correct but needs confirmation
  apparatusDetailsShown$ = combineLatest([
    this.statusService.currentViewMode$,
    this.hoverService.selectedApparatusEntries$
  ]).pipe(
    map(([viewMode, selectedAppEntries]) => {
      if (viewMode.id === 'readingText') {
        return false;
      }
      const id = this.data.id();
      const result = selectedAppEntries.find(app => id.equals(app.additionalAttributes.exponentId));
      return result;
    })
  );

  private isBetweenElementMemo = new Map<string, boolean>();
  private updateHovered$ = new BehaviorSubject<boolean>(false);

  private isSelected$ = this.hoverService.selectedApparatusEntries$.pipe(
    map(selectedAppEntries => {
      const isSelected = selectedAppEntries.some(app => this.data.id().equals(app.additionalAttributes.exponentId));
      return isSelected;
    }),
    tap(isSelected => {
      if (isSelected) {
        this.evtNoteButton?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    })
  );

  isHighlighted$ = combineLatest([
    this.updateHovered$,
    this.isSelected$,
    this.hoverService.hoveredTextOrDefault$,
  ]).pipe(
    map(([updateHovered, isSelected, hoveredText]) => {
      const value = this.hoverService.highlightedAppExponents$.value.filter(x => !x.id().equals(this.data.id()));
      if (updateHovered || isSelected) {
        this.hoverService.highlightedAppExponents$.next([...value, this.data]);
        return true;
      }

      if (!hoveredText) {
        this.hoverService.highlightedAppExponents$.next([]);
        return false;
      }

      const { id, element, isHovering } = hoveredText;
      if (!this.isBetweenElementMemo.has(id)) {
        const { fromEl, toEl } = this.hoverService.getDepaElements(this.data);
        const result = isElementBetween(fromEl, element, toEl);
        this.isBetweenElementMemo.set(id, result);
      }

      const result = isHovering && this.isBetweenElementMemo.get(id);
      const newValue = result ? [...value, this.data] : value;
      this.hoverService.highlightedAppExponents$.next(newValue);
      return result;
    })
  );

  constructor(
    private statusService: EVTStatusService,
    private hoverService: HoverService,
  ) {
  }

  ngOnInit(): void {

  }

  onExponentButtonClicked() {
    this.hoverService.toggleApparatusEntry(this.data.appEntry);
  }

  onHover(isHovering: boolean) {
    this.updateHovered$.next(isHovering);
  }

  ngOnDestroy(): void {
  }
}