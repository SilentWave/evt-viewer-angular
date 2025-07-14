import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, shareReplay, tap } from 'rxjs/operators';
import { AppConfig, EditionUrl } from '../app.config';
import { parseXml } from '../utils/xml-utils';
import { PrefatoryMatterParserService } from './xml-parsers/prefatory-matter-parser.service';
import { EditionInfo, EditionSource } from './named-entities.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class EditionDataService {
  private readonly editionUrls = AppConfig.evtSettings.files.editionUrls || [];
  private readonly mainUrl = this.editionUrls.find(x => this.isMainUrl(x)) ?? this.editionUrls[0];
  private readonly otherUrls = this.editionUrls.filter(x => !this.isMainUrl(x)) ?? this.editionUrls.slice(1);

  readonly mainEditionSource$: Observable<EditionSource> = this.loadAndParseMainEditionData().pipe(
    shareReplay(1));
  readonly otherEditionSources$: Observable<EditionSource[]> = this.loadOtherEditionsData().pipe(
    shareReplay(1));
  readonly allEditionSources$: Observable<EditionSource[]> = forkJoin({
    main: this.mainEditionSource$,
    others: this.otherEditionSources$,
  }).pipe(
    map(({ main, others }) => [main, ...others]),
    shareReplay(1));

  constructor(
    private http: HttpClient,
    private prefatoryMatterParser: PrefatoryMatterParserService
  ) {

  }

  private loadAndParseMainEditionData(): Observable<EditionSource> {
    return this.loadAndParseEditionData(this.mainUrl);
  }

  private loadOtherEditionsData(): Observable<EditionSource[]> {
    if (!this.otherUrls.length) return of([]);

    const requests = this.otherUrls.map(editionUrl => this.loadAndParseEditionData(editionUrl));
    return forkJoin(requests);
  }

  private isMainUrl(url: EditionUrl): boolean {
    return url.type === 'main';
  }

  private loadAndParseEditionData(editionUrl: EditionUrl): Observable<EditionSource> {
    return this.http.get(editionUrl.value, { responseType: 'text' }).pipe(
      map((source) => parseXml(source)),
      tap(source => {
        setId(source.lastElementChild as HTMLElement);
        console.log('edited source', source);

        function setId(element: HTMLElement) {
          if (element.setAttributeNS) {
            if (element.getAttribute('xml:id') === null) {
              element.setAttributeNS("http://www.w3.org/XML/1998/namespace", 'xml:id', `evt-${uuidv4()}`);
            }
            for (const child of Array.from(element.children)) {
              setId(child as HTMLElement);
            }
          }
        }
      }),
      // merge lists if both urls and xi:include are specified
      mergeMap((editionData) => this.loadXIinclude(editionData, editionUrl.value.substring(0, editionUrl.value.lastIndexOf('/') + 1))),
      mergeMap(editionData =>
        forkJoin({
          editionData: of(editionData),
          glossary: editionUrl.glossaryUrl ? this.http.get(editionUrl.glossaryUrl, { responseType: 'text' }) : of(''),
        })
      ),
      map(({ editionData, glossary }) => {
        const editionInfo: EditionInfo = {
          editionTitle: this.prefatoryMatterParser.parseEditionTitle(editionData),
          editionFriendlyName: editionUrl.friendlyName
        };
        const parsedGlossary = glossary ? parseXml(glossary) : null;
        return { editionData, editionInfo, glossary: parsedGlossary };
      }),
      catchError(() => throwError(() => this.createError()))
    );
  }

  loadXIinclude(doc: HTMLElement, baseUrlPath: string) {
    const filesToInclude = Array.from(doc.getElementsByTagName('xi:include'));
    const xiIncludeLoadsSubs = filesToInclude.map((element) =>
      this.http.get(baseUrlPath + element.getAttribute('href'), { responseType: 'text' })
        .pipe(
          tap((fileData) => {
            const includedDoc = parseXml(fileData);
            const fileXpointer = element.getAttribute('xpointer');
            let includedTextElem: Node;
            if (fileXpointer) {
              includedTextElem = doc.querySelector(`[*|id="${fileXpointer}"]`)
                || includedDoc.querySelector(`[*|id="${fileXpointer}"]`)
                || includedDoc.querySelector('text');
            } else {
              includedTextElem = includedDoc.querySelector('text');
            }
            // element.parentNode.replaceChild(includedTextElem, element);
            element.parentNode.appendChild(includedTextElem);
          }),
          catchError((_) => {
            Array.from(element.getElementsByTagName('xi:fallback')).map((el) => {
              const divEl = document.createElement('div');
              divEl.classList.add('xiinclude-fallback');
              divEl.setAttribute('xml:id', element.getAttribute('xpointer'));
              divEl.innerHTML = `<p>${el.innerHTML}</p>`;

              return divEl;
            }).forEach((el) => element.parentNode.replaceChild(el, element));

            return of(doc);
          }),
        ));
    if (xiIncludeLoadsSubs.length > 0) {
      return forkJoin(xiIncludeLoadsSubs).pipe(map(() => doc));
    }

    return of(doc);
  }

  private createError() {
    if (!this.editionUrls || this.editionUrls.length === 0) {
      return new Error('Missing configuration for edition files. Data cannot be loaded.');
    } else {
      return new Error('There was an error in loading edition files.');
    }
  }
}
