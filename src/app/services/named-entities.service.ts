import { Injectable } from "@angular/core";
import { EditionDataService } from "./edition-data.service";
import { NamedEntitiesParserService } from "./xml-parsers/named-entities-parser.service";
import { map, shareReplay, Observable, forkJoin } from "rxjs";
import { NamedEntities, NamedEntityOccurrence } from "../models/evt-models";
import { StructureXmlParserService } from "./xml-parsers/structure-xml-parser.service";
import { Map } from '../utils/js-utils';

@Injectable({
    providedIn: 'root',
})
export class NamedEntitiesService {
    private readonly allEditionSources$: Observable<AllEditionSources> = forkJoin({
        main: this.editionDataService.mainEditionSource$,
        others: this.editionDataService.otherEditionSources$,
    }).pipe(
        map(({ main, others }) => new AllEditionSources(main, others)),
        shareReplay(1)
    );

    private readonly allPages$ = this.allEditionSources$.pipe(
        map(sources => sources
            .getAllEditionSources()
            .map(({ editionInfo, editionData }) => ({
                editionInfo,
                pages: this.editionStructureParser.parsePages(editionData).pages
            }))),
        shareReplay(1),
    );

    readonly allEntitiesOccurrences$: Observable<EditionNamedEntitiesOccurrences[]> = this.allPages$.pipe(
        map((pages) => pages.map(({ editionInfo, pages }) => ({
            editionInfo,
            entitiesOccurrences: this.namedEntitiesParser.parseNamedEntitiesOccurrences(pages)
        }))),
        shareReplay(1),
    );

    constructor(
        private editionDataService: EditionDataService,
        private namedEntitiesParser: NamedEntitiesParserService,
        private editionStructureParser: StructureXmlParserService,
    ) { }
}

export class AllEditionSources {
    constructor(private main: EditionSource, private others: EditionSource[]) { }

    getAllEditionSources(): EditionSource[] {
        return [this.main, ...this.others];
    }
    getEditionSource(editionTitle: string): EditionSource {
        if (editionTitle === this.main.editionInfo.editionTitle) return this.main;

        const edition = this.others.find(x => x.editionInfo.editionTitle === editionTitle);
        if (!edition) throw new Error('No edition found with title' + editionTitle);

        return edition;
    }
}

export interface EditionSource {
    editionInfo: EditionInfo;
    editionData: HTMLElement;
    glossary: HTMLElement;
}

export interface EditionInfo {
    editionTitle: string;
    editionFriendlyName: string;
}

export interface EditionNamedEntities {
    editionInfo: EditionInfo;
    namedEntities: NamedEntities;
}

export interface EditionNamedEntitiesOccurrences {
    editionInfo: EditionInfo;
    entitiesOccurrences: Map<NamedEntityOccurrence[]>;
}