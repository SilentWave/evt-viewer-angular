import { Surplus, XMLElement } from '../../models/evt-models';
import { AttributeParser, EmptyParser } from './basic-parsers';
import { createParser, getClass, parseChildren, Parser } from './parser-models';

export class SurplusParser extends EmptyParser implements Parser<XMLElement> {
    attributeParser = createParser(AttributeParser, this.genericParse);
    parse(xml: XMLElement): Surplus {
        const attributes = this.attributeParser.parse(xml);
        const { reason } = attributes;

        return {
            type: Surplus,
            reason,
            class: getClass(xml),
            content: parseChildren(xml, this.genericParse),
            attributes,
        };
    }
}
