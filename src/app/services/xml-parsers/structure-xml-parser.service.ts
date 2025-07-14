import { Injectable } from '@angular/core';
import { AppConfig } from '../../app.config';
import { ApparatusEntry, ApparatusEntryExponent, Attribute, DocumentApparatusEntries, EditionStructure, ElementApparatusEntries, GenericElement, LacunaPair, OriginalEncodingNodeType, Page, XMLElement } from '../../models/evt-models';
import { createNsResolver, deepSearch, getElementsBetweenTreeNode, isNestedInElem } from '../../utils/dom-utils';
import { GenericParserService } from './generic-parser.service';
import { getID, ParseResult } from './parser-models';
import { getFromAttributeOrDefault, getToAttributeOrDefault } from 'src/app/extensions/apparatus.extensions';
import { FROM_ATTRIBUTE, TO_ATTRIBUTE } from 'src/app/models/constants';
import { v4 as uuidv4 } from 'uuid';
import { AlphabetService } from '../alphabet.service';
import { AppParser } from './app-parser';
import { ErrorsService } from '../errors.service';

@Injectable({
  providedIn: 'root',
})
export class StructureXmlParserService {
  constructor(
    private genericParserService: GenericParserService,
    private alphabet: AlphabetService,
    private errorService: ErrorsService,
  ) {
  }

  private appParser = AppParser.create();
  private frontOrigContentAttr = 'document_front';
  private readonly frontTagName = 'front';
  private readonly pageTagName = AppConfig.evtSettings.edition.editionStructureSeparator;
  private readonly bodyTagName = 'body';
  //private readonly backTagName = 'back';

  allApps: XMLElement[] = [];
  groupedByWitLacunas = new Map<string, LacunaPair[]>();
  back: Element = null;

  readonly appExponents: Map<string, ApparatusEntryExponent> = new Map();

  parsePages(source: XMLElement): EditionStructure {
    const editionStructure = {
      pages: [] as Page[],
      documentApparatusEntries: new DocumentApparatusEntries()
    };

    if (!source) return editionStructure;

    const front: XMLElement = source.querySelector(this.frontTagName);
    const body: XMLElement = source.querySelector(this.bodyTagName);
    this.back = source.querySelector('back');

    const pbs = Array.from(source.querySelectorAll(this.pageTagName)).filter((p) => !p.getAttribute('ed'));
    const frontPbs = pbs.filter((p) => isNestedInElem(p, this.frontTagName));
    const bodyPbs = pbs.filter((p) => isNestedInElem(p, this.bodyTagName));
    const doc = source.firstElementChild.ownerDocument;

    if (frontPbs.length > 0 && bodyPbs.length > 0) {
      const pages = pbs.map((pb: XMLElement, idx, arr: XMLElement[]) => this.parseDocumentPage(doc, pb, arr[idx + 1], 'text'));
      editionStructure.pages.push(...pages);
    }
    else {
      const frontPages = frontPbs.length === 0 && front && this.isMarkedAsOrigContent(front)
        ? [this.parseSinglePage(doc, front, 'page_front', this.frontTagName, 'facs_front')]
        : frontPbs.map((pb, idx, arr) => this.parseDocumentPage(doc, pb as HTMLElement, arr[idx + 1] as HTMLElement, this.frontTagName));

      const bodyPages = bodyPbs.length === 0
        ? [this.parseSinglePage(doc, body, 'page1', 'mainText', 'facs1')] // TODO: tranlsate mainText
        : bodyPbs.map((pb, idx, arr) => this.parseDocumentPage(doc, pb as HTMLElement, arr[idx + 1] as HTMLElement, this.bodyTagName));

      editionStructure.pages.push(...frontPages, ...bodyPages);
    }

    const backElements = source.getElementsByTagName('back');
    const lacunasStart = Array.from(backElements[0].querySelectorAll('lacunaStart')).map(x => x as HTMLElement);
    const lacunasEnd = Array.from(backElements[0].querySelectorAll('lacunaEnd')).map(x => x as HTMLElement);

    for (const lacuna of lacunasStart.concat(lacunasEnd)) {
      const wit = Attribute.createOrDefault(lacuna.getAttribute('wit'))
        || Attribute.createOrDefault(lacuna.parentElement?.getAttribute('wit'));
      if (!wit) {
        this.errorService.logError("A Lacuna must either have a wit attribute or its parent should");
        continue;
      }

      lacuna.setAttribute('wit', wit.valueWithoutRef);

      const lacunaAnchestorApp = lacuna.closest('app') as HTMLElement;
      const startFrom = Attribute.createFromOrDefault(lacunaAnchestorApp);
      lacuna.setAttribute('from', startFrom.valueWithoutRef);
    }

    for (const lacunaStart of lacunasStart) {
      if (!lacunasEnd.length) break;

      const startWit = lacunaStart.getAttribute('wit');
      const lacunaEnd = lacunasEnd.find(lacunaEnd => {
        const endWit = lacunaEnd.getAttribute('wit');
        return startWit === endWit;
      });

      lacunasEnd.splice(0, 1);

      const startFrom = Attribute.createFromOrDefault(lacunaStart);
      const startAnchor = source.querySelector(`[*|id='${startFrom.valueWithoutRef}']`) as HTMLElement;


      const endFrom = Attribute.createFromOrDefault(lacunaEnd);
      const endAnchor = source.querySelector(`[*|id='${endFrom.valueWithoutRef}']`) as HTMLElement;


      const hasKey = this.groupedByWitLacunas.has(startWit);
      if (!hasKey) {
        this.groupedByWitLacunas.set(startWit, [])
      }
      const pairs = this.groupedByWitLacunas.get(startWit);
      pairs.push({ start: startAnchor, end: endAnchor });
    }
    return editionStructure;
  }

  public processCriticalApparatus(source: HTMLElement, editionStructure: EditionStructure): void {
    if (!this.allApps.length) {
      this.allApps = Array.from(source.querySelectorAll("app"));
      if (!this.allApps.length) {
        this.errorService.logWarning('There are no apps in the source');
        return;
      }

      // this can load after some times as errors can be available later
      setTimeout(() => {
        this.errorService.loadingStart();

        for (const app of this.allApps) {

          const from = Attribute.createFromOrDefault(app);
          if (!from) {
            this.errorService.logError('From attribute is missing:', [app]);
            continue;
          }

          const to = Attribute.createToOrDefault(app);
          if (!to) continue;

          const fromElement = source.querySelector(`[*|id='${from.valueWithoutRef}']`);
          const toElement = source.querySelector(`[*|id='${to.valueWithoutRef}']`);

          if (!fromElement || !toElement) continue;

          // instead of loading all errors right away, this avoid blocking the ui
          setTimeout(() => {
            const otherApps = this.allApps.filter(x => !x.isEqualNode(app));
            for (const otherApp of otherApps) {
              const otherFrom = Attribute.createFromOrDefault(otherApp);
              if (!otherFrom) continue;

              const otherElement = source.querySelector(`[*|id='${otherFrom.valueWithoutRef}']`);
              if (!otherElement) {
                this.errorService.logError(
                  `No element found with xml:id ${otherFrom.valueWithoutRef}`,
                  [otherApp]
                );
                continue;
              }

              if (isIntersecting(fromElement, toElement, otherElement)) {
                const duplicates = findDuplicateWitnesses(app, otherApp);
                if (duplicates.length) {
                  this.errorService.logError(
                    `Duplicated witness found in intersecting elements: ${duplicates.join(', ')}`,
                    [app, otherApp]
                  );
                }
              }
            }
          }, 1);
        }

        this.errorService.loadingEnd();
      }, 1_000);

      function isIntersecting(fromElement: Element, toElement: Element, otherElement: Element) {
        const isAfterFromInclusive =
          (fromElement.compareDocumentPosition(otherElement) & Node.DOCUMENT_POSITION_FOLLOWING) ||
          otherElement.isEqualNode(fromElement);

        const isBeforeToInclusive =
          (otherElement.compareDocumentPosition(toElement) & Node.DOCUMENT_POSITION_FOLLOWING) ||
          otherElement.isEqualNode(toElement);

        return isAfterFromInclusive && isBeforeToInclusive;
      }

      function findDuplicateWitnesses(app: HTMLElement, otherApp: HTMLElement): string[] {
        const wit = 'wit';
        const withSelector = `[${wit}]`;
        const exceptParent = 'lem';

        const extractWits = (element: HTMLElement) =>
          Array.from(element.querySelectorAll(withSelector))
            .filter(x => !x.closest(exceptParent))
            .flatMap(x => x.getAttribute(wit)?.split(' ') || []);

        const appWits = extractWits(app);
        const otherAppWits = extractWits(otherApp);

        return findDuplicates([...appWits, ...otherAppWits]);
      }
    }

    const result = this.getDocumentApparatusEntries(editionStructure.pages);
    result.apps.forEach((value, key) => {
      editionStructure.documentApparatusEntries.apps.set(key, value);
    });

    let counter = 0;
    const enumerateBy = AppConfig.evtSettings.edition.exponentEnumerateBy;
    const enumeratedByElements = Array.from(source.querySelectorAll(enumerateBy));
    const enumeratedByJsonElements: string[] = [];
    for (let enumeratedByElement of enumeratedByElements) {
      const enumeratedByParsed = this.genericParserService.parse(enumeratedByElement as XMLElement);
      const enumerateByJson = JSON.stringify(enumeratedByParsed);
      enumeratedByJsonElements.push(enumerateByJson);
    }

    // const app = document.createElement('app')
    // app.setAttribute('from', '#Luc-001-37');
    // app.setAttribute('to', '#Luc-001-41');

    // const rdg = document.createElement('rdg');
    // rdg.setAttribute('wit', '#Mon3')
    // app.appendChild(rdg);

    // this.allApps.push(app);

    for (let i = 0; i < editionStructure.pages.length; i++) {
      const page = editionStructure.pages[i];
      this.addApparatusExponents(
        page.parsedContent,
        (app, exponent) => onApparatusEntryReplaced(page, app, exponent),
        () => exponentLabelFactory(this.alphabet),
        onShouldResetCounter,
      )
    }

    function onApparatusEntryReplaced(page: Page, app: ApparatusEntry, exponent: ApparatusEntryExponent): void {
      const exponentId = exponent.id().valueWithoutRef;
      const pageAppEntries = editionStructure.documentApparatusEntries.apps.get(page.id);
      const elementAppEntries = pageAppEntries.apps.get(exponentId);
      if (elementAppEntries) {
        elementAppEntries.apps.push(app);
      }
      else {
        const elementAppEntries: ElementApparatusEntries = {
          elementId: exponentId,
          apps: [app]
        };
        pageAppEntries.apps.set(exponentId, elementAppEntries);
      }
    }

    function exponentLabelFactory(alphabet: AlphabetService): string {
      const label = alphabet.createBase26Label(counter);
      counter++;
      return label;
    }

    function onShouldResetCounter(item: GenericElement): void {
      const currentItemJson = JSON.stringify(item);
      const matchesSelector = enumeratedByJsonElements.some(x => x === currentItemJson);
      if (enumerateBy !== 'global' && matchesSelector) {
        counter = 0;
      }
    }

    function findDuplicates(array: string[]): string[] {
      const uniqueElements = new Set();
      const duplicates = [];

      array.forEach(item => {
        if (uniqueElements.has(item)) {
          duplicates.push(item);
        } else {
          uniqueElements.add(item);
        }
      });

      return duplicates;
    }
  }

  /**
   * This function adds the apparatus exponents on the parsed content of the body
   * based on many different cases for inline and standoff apparatuses.
   * So these exponents are added inline.
   * 
   * @param items the items to be processed.
   * @param onApparatusEntryReplaced callback for adding apparatus entries.
   */
  addApparatusExponents(
    items: any[],
    onApparatusEntryReplaced: (app: ApparatusEntry, exponent: ApparatusEntryExponent) => void,
    getExponentLabel: () => string,
    onShouldResetCounter: (item: GenericElement) => void,
  ) {

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      onShouldResetCounter(item);

      if (item.type?.name === 'ApparatusEntry') {
        const app = item as ApparatusEntry;
        if (!app) throw new Error("Invalid type " + app);

        const id = this.getExponentId();
        const to = id; // the exponent itself as the To element
        let exponent: ApparatusEntryExponent = null;
        if (app.lemma) {
          const from = app.lemma.id; // lemma exist so it will be the From element
          exponent = ApparatusEntryExponent.create(id, from, to, getExponentLabel(), app);
          // the inline apparatus has a lemma so it must be rendered 
          items[i] = app.lemma;
          items.splice(i + 1, 0, exponent);
        } else {
          const from = id; // the exponent itself as the To element, because there is no lemma to render
          exponent = ApparatusEntryExponent.create(id, from, to, getExponentLabel(), app);
          // the inline apparatus has no lemma so we just replace the app with the exponent
          // this is considered an error which handling will be improved in a future feature
          // for now just the exponent is rendered without any preceding text
          items[i] = exponent;
        }
        this.appExponents.set(exponent.id().valueWithoutRef, exponent);
        onApparatusEntryReplaced(item, exponent);
        app.exponent = exponent.label;
      }
      else if (item.type?.name === 'Anchor') {
        const anchorId = item.attributes['id'];
        const apps = this.getApparatusEntriesOrDefault(anchorId);
        if (!apps.length) {
          console.warn("This anchor has not apparatus entry associated with its id and will be skipped", item);
          continue;
        }

        for (const app of apps) {
          const appFrom = Attribute.createOrDefault(app.attributes[FROM_ATTRIBUTE]);
          if (!appFrom) {
            throw new Error(`A standoff apparatus entry must have a valid ${FROM_ATTRIBUTE} attribute`);
          }

          const appTo = Attribute.createOrDefault(app.attributes[TO_ATTRIBUTE]);
          const isToAnchor = appTo && appTo.equals(anchorId);
          if (!isToAnchor) {
            //console.log("This anchor will be skipped because is the starting anchor, exponent will be place on the ending anchor", item);
            continue;
          }

          const id = this.getExponentId();
          const exponent = ApparatusEntryExponent.create(id, appFrom.valueWithoutRef, appTo.valueWithoutRef, getExponentLabel(), app);
          // insert at index
          items.splice(i + 1, 0, exponent);
          this.appExponents.set(exponent.id().valueWithoutRef, exponent);
          app.exponent = exponent.label;
        }
      }
      // in other cases exponents are added to the items array, so we skip them
      else if (item.type?.name === 'ApparatusEntryExponent') {
        //console.log("The element is an exponent, skipping", item);
        continue;
      }
      else if (item.content) {
        // recursive check for nested entries
        this.addApparatusExponents(item.content, onApparatusEntryReplaced, getExponentLabel, onShouldResetCounter);

        // now check if the item itself has an apparatus entry and add it's exponent as last child
        const itemId = item.attributes['id'];
        const apps = this.getApparatusEntriesOrDefault(itemId);
        if (!apps.length) {
          //console.log("This item has no apparatus entry, skipping", item);
          continue;
        }

        for (const app of apps) {
          const id = this.getExponentId();
          const appFrom = Attribute.createOrDefault(app.attributes[FROM_ATTRIBUTE]);
          const appTo = Attribute.createOrDefault(app.attributes[TO_ATTRIBUTE]);
          const isToElement = appTo && appTo.valueWithoutRef === itemId;
          if (isToElement) {
            const from = appFrom.valueWithoutRef;
            const to = id; // the exponent will be the To element itself since is placed as next sibling of the current item
            const exponent = ApparatusEntryExponent.create(id, from, to, getExponentLabel(), app);
            item.content.push(exponent); // insert as sibling because this component is not an anchor
            this.appExponents.set(exponent.id().valueWithoutRef, exponent);
            app.exponent = exponent.label;
          }
          else if (!appTo) {
            const from = itemId; // from itself since the apparatus entry refer to it
            const to = id; // the exponent will be place as the last child of the element so it marks the end
            const exponent = ApparatusEntryExponent.create(id, from, to, getExponentLabel(), app);
            item.content.push(exponent);
            this.appExponents.set(exponent.id().valueWithoutRef, exponent);
            app.exponent = exponent.label; 
          }
        }
      }
      else {
        //console.log('Node is not of interest for apparatus processing', item);
      }
    }
  }

  private getExponentId(): string {
    const uuid = uuidv4();
    return 'app-exponent-' + uuid;
  }

  private getApparatusEntriesOrDefault(id: string): ApparatusEntry[] {
    if (!id) return [];

    let appDatas = this.getAppsData();
    appDatas = appDatas.filter(x => x.appFrom?.valueWithoutRef === id || x.appTo?.valueWithoutRef === id);
    if (!appDatas) return [];

    const apps = []
    for (const appData of appDatas) {
      const app = this.appParser.parse(appData.app);
      apps.push(app as ApparatusEntry);
    }
    return apps;
  }

  private getDocumentApparatusEntries(pages: Page[]): DocumentApparatusEntries {
    const appsData = this.getAppsData();

    const searchValues = appsData.map(x => x.appTo ?? x.appFrom).filter(x => !!x).map(x => x.valueWithoutRef);
    const searchAttribute = "id";
    const attributesNotIncludedInSearch = ['originalEncoding', 'type', 'spanElements', 'includedElements'];

    const documentApparatusEntries = new DocumentApparatusEntries();
    for (const page of pages) {
      const elementAppEntries: Map<string, ElementApparatusEntries> = new Map();
      documentApparatusEntries.apps.set(page.id, {
        pageId: page.id,
        apps: elementAppEntries
      });

      const searchResults = deepSearch(page.parsedContent, searchAttribute, searchValues, 4000, attributesNotIncludedInSearch);
      for (const result of searchResults) {
        const element = result as GenericElement;
        if (!element) continue;

        const elementId = element.attributes[searchAttribute];
        const elementApps = appsData.filter(x => x.appFrom?.equals(elementId) || x.appTo?.equals(elementId));
        const parsedApps = elementApps.map(x => this.appParser.parse(x.app) as ApparatusEntry);
        elementAppEntries.set(elementId, {
          elementId,
          apps: [...parsedApps]
        });
      }
    }
    return documentApparatusEntries;
  }

  private getAppsData(): { app: HTMLElement, appFrom: Attribute, appTo: Attribute }[] {
    return this.allApps
      .map(app => {
        const appFrom = Attribute.createOrDefault(getFromAttributeOrDefault(app));
        const appTo = Attribute.createOrDefault(getToAttributeOrDefault(app));
        return {
          app,
          appFrom,
          appTo,
        };
      });
  }

  parseDocumentPage(doc: Document, pb: XMLElement, nextPb: XMLElement, ancestorTagName: string): Page {
    /* If there is a next page we retrieve the elements between two page nodes
    otherweise we retrieve the nodes between the page node and the last node of the body node */
    // TODO: check if querySelectorAll can return an empty array in this case
    if (pb.tagName !== 'pb') {
      return {
        id: getID(pb, 'page'),
        label: pb.getAttribute('n') || 'page',
        facs: (pb.getAttribute('facs') || 'page').split('#').slice(-1)[0],
        originalContent: [pb],
        parsedContent: this.parsePageContent(doc, [pb]),
        url: this.getPageUrl(getID(pb, 'page')),
        facsUrl: this.getPageUrl((pb.getAttribute('facs') || getID(pb, 'page')).split('#').slice(-1)[0]),
      };
    }

    const nextNode = nextPb || Array.from(doc.querySelectorAll(ancestorTagName)).reverse()[0].lastChild;
    const originalContent = getElementsBetweenTreeNode(pb, nextNode)
      .filter((n) => n.tagName !== this.pageTagName)
      .filter((c) => ![4, 7, 8].includes(c.nodeType)); // Filter comments, CDATAs, and processing instructions

    return {
      id: getID(pb, 'page'),
      label: pb.getAttribute('n') || 'page',
      facs: (pb.getAttribute('facs') || 'page').split('#').slice(-1)[0],
      originalContent,
      parsedContent: this.parsePageContent(doc, originalContent),
      url: this.getPageUrl(getID(pb, 'page')),
      facsUrl: this.getPageUrl((pb.getAttribute('facs') || getID(pb, 'page')).split('#').slice(-1)[0]),
    };
  }

  private parseSinglePage(doc: Document, el: XMLElement, id: string, label: string, facs: string): Page {
    const originalContent: XMLElement[] = getElementsBetweenTreeNode(el.firstChild, el.lastChild);

    return {
      id,
      label,
      facs,
      originalContent,
      parsedContent: this.parsePageContent(doc, originalContent),
      url: this.getPageUrl(id),
      facsUrl: this.getPageUrl(facs || id),
    };
  }

  private getPageUrl(id) {
    // TODO: check if exists <graphic> element connected to page and return its url
    // TODO: handle multiple version of page
    const image = id.split('.')[0];

    //Nel file_config imagesFolderUrls deve terminare già con uno /
    return `${AppConfig.evtSettings.files.imagesFolderUrls.single}${image}.jpg`;
  }
  // lbId = '';
  // quando trovi un lbId allora lbId = 'qualcosa'


  parsePageContent(doc: Document, pageContent: OriginalEncodingNodeType[]): Array<ParseResult<GenericElement>> {
    return pageContent
      .map((node) => {

        const origEl = getEditionOrigNode(node, doc);
        // issue #228
        // the original line is commented because this function causes the node to be revered at its original state
        // before the pb division, see issue #228 details for further info.
        // for now this quick fix allows a proper text division but we need to investigate exceptions and particular cases
        //const origEl = node;

        if (origEl.nodeName === this.frontTagName || isNestedInElem(origEl, this.frontTagName)) {
          if (this.hasOriginalContent(origEl)) {
            return Array.from(origEl.querySelectorAll(`[type=${this.frontOrigContentAttr}]`))
              .map((c) => this.genericParserService.parse(c as XMLElement));
          }
          if (this.isMarkedAsOrigContent(origEl)) {
            return [this.genericParserService.parse(origEl)];
          }

          return [] as Array<ParseResult<GenericElement>>;
        }

        if (origEl.tagName === 'text' && origEl.querySelectorAll && origEl.querySelectorAll(this.frontTagName).length > 0) {
          return this.parsePageContent(doc, Array.from(origEl.children) as HTMLElement[]);
        }

        return [this.genericParserService.parse(origEl)];
      })
      .reduce((x, y) => x.concat(y), []);
  }

  hasOriginalContent(el: XMLElement): boolean {
    return el.querySelectorAll(`[type=${this.frontOrigContentAttr}]`).length > 0;
  }

  isMarkedAsOrigContent(el: XMLElement): boolean {
    return el.nodeType !== 3 &&
      (el.getAttribute('type') === this.frontOrigContentAttr ||
        this.hasOriginalContent(el) ||
        isNestedInElem(el, '', [{ key: 'type', value: this.frontOrigContentAttr }])
      );
  }
}



//this function is only momentarily commented, waiting for issue #228 to be better addressed
function getEditionOrigNode(el: XMLElement, doc: Document) {
  if (el.getAttribute && el.getAttribute('xpath')) {
    const path = doc.documentElement.namespaceURI ? el.getAttribute('xpath').replace(/\//g, '/ns:') : el.getAttribute('xpath');
    const xpathRes = doc.evaluate(path, doc, createNsResolver(doc), XPathResult.ANY_TYPE, undefined);

    return xpathRes.iterateNext() as XMLElement;
  }

  return el;
}