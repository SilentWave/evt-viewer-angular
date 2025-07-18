import { ID_SELECTOR_PREFIX } from "../models/constants";

declare global {
    interface String {
        /**
         * Return the string without the starting id selector character 
         * 
         * Ex: #hello => hello
        */
        withoutSelectorCharacter(): string;

        /**
         * Return the string with the starting id selector character
         * 
         * Ex: hello => #hello
        */
        withSelectorCharacter(): string;
    }
}


String.prototype.withoutSelectorCharacter = function (this: string) {
    return this.startsWith(ID_SELECTOR_PREFIX) ? this.slice(1) : this;
};

String.prototype.withSelectorCharacter = function (this: string) {
    return this.startsWith(ID_SELECTOR_PREFIX) ? this : ID_SELECTOR_PREFIX + this;
};

export { };