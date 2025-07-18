import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErrorsService {
  private _errors$ = new BehaviorSubject<SourceError[]>([]);
  errors$ = this._errors$.asObservable();

  private _isLoading = true;

  get isLoading() {
    return this._isLoading;
  }

  constructor() { }

  logError(error: string, elements?: HTMLElement[]) {
    const outherHtmlsOrDefault = elements?.map(x => x.outerHTML) ?? [];
    const sourceError: SourceError = { errorMessage: error, type: 'error', outerHTMLs: outherHtmlsOrDefault }
    const errors = this._errors$.getValue();
    if (errors.some(e => e.errorMessage === sourceError.errorMessage)) {
      return;
    }

    console.error(error, elements);
    this._errors$.next([...errors, sourceError]);
  }

  logWarning(error: string, elements?: HTMLElement[]) {
    const outherHtmlsOrDefault = elements?.map(x => x.outerHTML) ?? [];
    const sourceError: SourceError = { errorMessage: error, type: 'warning', outerHTMLs: outherHtmlsOrDefault }
    const errors = this._errors$.getValue();
    if (errors.some(e => e.errorMessage === sourceError.errorMessage)) {
      return;
    }

    console.warn(error, elements);
    this._errors$.next([...errors, sourceError]);
  }

  loadingStart() {
    this._isLoading = true;
  }

  loadingEnd() {
    this._isLoading = false;
  }

  dismissAll() {
    this._errors$.next([]);
  }

  dismiss(error: SourceError) {
    const newValue = this._errors$.value.filter(x => x !== error);
    this._errors$.next(newValue);
  }
}

export interface SourceError {
  errorMessage: String,
  outerHTMLs: string[];
  type: 'error' | 'warning',
}
