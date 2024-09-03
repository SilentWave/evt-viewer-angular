import { Injectable } from "@angular/core";
import { map, Observable, shareReplay } from "rxjs";
import { StructureXmlParserService } from "../../services/xml-parsers/structure-xml-parser.service";
import { EVTStatusService } from "../../services/evt-status.service";
import { Page } from "../../models/evt-models";
import { PrefatoryMatterParserService } from "../../services/xml-parsers/prefatory-matter-parser.service";
import { EditionDataService } from "src/app/services/edition-data.service";
import { Attribute, SynopsisEdition } from "./synopsis.models";

@Injectable({
    providedIn: 'root',
})
export class SynopsisService {
    readonly allEditions$: Observable<SynopsisEdition[]> = this.editionDataService.allEditionSources$.pipe(
        map(editionSources => this.mapToSynopsisEdition(editionSources)),
        shareReplay(1));

    constructor(
        private editionDataService: EditionDataService,
        private evtStatusService: EVTStatusService,
        private editionStructureParser: StructureXmlParserService,
        private prefatoryMatterParser: PrefatoryMatterParserService,
    ) {
    }

    getXmlIdsWithCorrespInOtherEditions(editions: HTMLElement[], page: Page): string[] {
        const xmlIds = page.originalContent.flatMap(x => this.recursiveParseAttribute(x, "xml:id"));
        const corresps = editions.flatMap(x => {
            return this.recursiveParseAttribute(x, "corresp");
        });
        const result = xmlIds.filter(xmlId =>
            corresps.some(corresp => corresp.value.includes(xmlId.value)));
        return result.map(x => x.value);
    }

    getCorrespPageOrDefault(pages: Page[], xmlId: string): Page | null {
        if (!xmlId) return null;

        const page = pages.find(page => {
            const pageCorresps = page.originalContent.flatMap(x => this.recursiveParseAttribute(x, 'corresp'));
            const containsCorresp = pageCorresps.filter(corresp => {
                const result = corresp.value.includes(xmlId);
                return result;
            });
            return containsCorresp.length > 0;
        });
        return page;
    }

    getPageElementByAttributeOrDefault(newPage: Page, attribute: Attribute): HTMLElement | null {
        for (const element of newPage.originalContent) {
            const foundElement = this.recursiveFindElementByAttributeOrDefault(element, attribute)
            if (foundElement) return foundElement;
        }

        return null;
    }

    private mapToSynopsisEdition(editionSources: HTMLElement[]) {
        const result = editionSources.map(source => {
            const pages = this.editionStructureParser.parsePages(source).pages;
            const editionTitle = this.prefatoryMatterParser.parseEditionTitle(source);
            const defaultPage = pages[0];
            const xmlIds = this.getXmlIdsWithCorrespInOtherEditions(editionSources, defaultPage);
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
            return {
                editionSource: source,
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
        });
        return result;
    }

    public recursiveFindElementByAttributeOrDefault(element: HTMLElement, attribute: Attribute, values: HTMLElement[] = []): HTMLElement | null {
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

