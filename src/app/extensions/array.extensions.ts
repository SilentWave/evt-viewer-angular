declare global {
    interface Array<T> {
        skipWhile(predicate: (value: T) => boolean): T[];
        takeWhile(predicate: (value: T) => boolean, options?: { includeLastItem: boolean }): T[];
    }
}

Array.prototype.skipWhile = function <T>(this: T[], predicate: (value: T) => boolean): T[] {
    let index = 0;
    while (index < this.length && predicate(this[index])) {
        index++;
    }
    return this.slice(index);
};

Array.prototype.takeWhile = function <T>(this: T[], predicate: (value: T) => boolean, options?: { includeLastItem: boolean }): T[] {
    let index = 0;
    while (index < this.length && predicate(this[index])) {
        index++;
    }
    if (index !== 0 && options?.includeLastItem) index++;
    return this.slice(0, index);
};

export { };
