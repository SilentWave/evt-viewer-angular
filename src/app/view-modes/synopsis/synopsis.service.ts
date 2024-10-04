import { Injectable } from "@angular/core";
import { combineLatest, map, Observable, shareReplay } from "rxjs";
import { StructureXmlParserService } from "../../services/xml-parsers/structure-xml-parser.service";
import { EVTStatusService } from "../../services/evt-status.service";
import { Page } from "../../models/evt-models";
import { PrefatoryMatterParserService } from "../../services/xml-parsers/prefatory-matter-parser.service";
import { EditionDataService } from "src/app/services/edition-data.service";
import { Attribute, SynopsisEdition } from "./synopsis.models";
import { EditionSource } from "src/app/services/named-entities.service";

@Injectable({
    providedIn: 'root',
})
export class SynopsisService {
    readonly mainEdition$: Observable<SynopsisEdition> = this.editionDataService.mainEditionSource$.pipe(
        map(editionSources => this.mapToSynopsisEdition([editionSources])[0]),
        shareReplay(1));

    readonly otherEditions$: Observable<SynopsisEdition[]> = this.editionDataService.otherEditionSources$.pipe(
        map(editionSources => this.mapToSynopsisEdition(editionSources)),
        shareReplay(1));

    readonly allEditions$: Observable<SynopsisEdition[]> = combineLatest([
        this.mainEdition$,
        this.otherEditions$,
    ]).pipe(
        map(([main, others]) => [main, ...others]),
        shareReplay(1));

    constructor(
        private editionDataService: EditionDataService,
        private evtStatusService: EVTStatusService,
        private editionStructureParser: StructureXmlParserService,
        private prefatoryMatterParser: PrefatoryMatterParserService,
    ) {
    }

    getXmlIdsWithCorrespInOtherEditions(editions: HTMLElement[], editionToSkip: HTMLElement, page: Page): string[] {
        const xmlIds = page.originalContent.flatMap(x => this.recursiveParseAttribute(x, "xml:id"));
        const corresps = editions
            .filter(x => x !== editionToSkip)
            .flatMap(x => {
                return this.recursiveParseAttribute(x, "corresp");
            });
        const result = xmlIds.filter(xmlId =>
            corresps.some(corresp =>  this.matchCorresp(corresp, xmlId.value)));
        return result.map(x => x.value);
    }

    getCorrespPageOrDefault(pages: Page[], xmlId: string): Page | null {
        if (!xmlId) return null;

        const page = pages.find(page => {
            const pageCorresps = page.originalContent.flatMap(x => this.recursiveParseAttribute(x, 'corresp'));
            const containsCorresp = pageCorresps.filter(corresp => this.matchCorresp(corresp, xmlId));
            return containsCorresp.length > 0;
        });
        return page;
    }

    private matchCorresp(corresp: Attribute, xmlId: string) {
        let parts = corresp.value.split(' ').map(x => x.trim());
        parts = parts.flatMap(x => x.split(':'));
        parts = parts.flatMap(x => x.startsWith('#') ? x.substring(1) : x);
        return parts.some(x => x === xmlId);
    }

    getPageElementByAttributeOrDefault(newPage: Page, attribute: Attribute): HTMLElement | null {
        for (const element of newPage.originalContent) {
            const foundElement = this.recursiveFindElementByAttributeOrDefault(element, attribute)
            if (foundElement) return foundElement;
        }

        return null;
    }

    private mapToSynopsisEdition(editionSources: EditionSource[]) {
        const result = editionSources.map(source => {
            const pages = this.editionStructureParser.parsePages(source.editionData).pages;
            const editionTitle = this.prefatoryMatterParser.parseEditionTitle(source.editionData);
            const defaultPage = pages[0];
            const xmlIds = this.getXmlIdsWithCorrespInOtherEditions(
                editionSources.map(x => x.editionData), source.editionData, defaultPage);
            const pageSelectionList = {
                selectedPage: {
                    pageId: defaultPage.id,
                    pageLabel: defaultPage.label
                },
                pages: pages.map(page => ({
                    pageId: page.id,
                    pageLabel: page.label,
                }))
            };
            const editionSource: SynopsisEdition = {
                editionData: source.editionData,
                pages: pages,
                selectedPage: {
                    page: defaultPage,
                    xmlIds: xmlIds,
                    selectedXmlId: xmlIds[0],
                    pageSelectionList: pageSelectionList
                },
                editionTitle: editionTitle,
                editionLevel: this.evtStatusService.defaultEditionLevel,
            };
            return editionSource;
        });
        return result;
    }

    private recursiveFindElementByAttributeOrDefault(element: HTMLElement, attribute: Attribute, values: HTMLElement[] = []): HTMLElement | null {
        const result = this.getAttributeOrDefault(element, attribute.key);
        if (result && result.value.includes(attribute.value)) return element;

        if (element.children) {
            for (const child of Array.from(element.children)) {
                const htmlChild = child as HTMLElement;
                const childResult = this.recursiveFindElementByAttributeOrDefault(htmlChild, attribute, values);
                if (childResult) return childResult;
            }
        }

        return null;
    }

    private recursiveParseAttribute(element: HTMLElement, attributeKey: string, values: Attribute[] = []): Attribute[] {
        const attribute = this.getAttributeOrDefault(element, attributeKey);
        if (attribute) values.push(attribute);

        if (element.children) {
            for (const child of Array.from(element.children)) {
                const htmlChild = child as HTMLElement;
                this.recursiveParseAttribute(htmlChild, attributeKey, values);
            }
        }

        return values;
    }

    private getAttributeOrDefault(element: HTMLElement, attributeKey: string): Attribute | null {
        if (element.hasAttribute !== undefined && element.hasAttribute(attributeKey)) {
            const attr = element.getAttribute(attributeKey);
            return { key: attributeKey, value: attr };
        }

        return null;
    }
}

