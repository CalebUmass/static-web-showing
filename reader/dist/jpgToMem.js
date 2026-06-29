"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrenchBookLoader = void 0;
const fs = require("fs");
const path = require("path");
const dataPath = path.join(process.cwd(), 'public', 'OCdata.json');
let rawData;
try {
    rawData = fs.readFileSync(dataPath);
}
catch (e) {
    console.error(`Failed to read ${dataPath}:`, e);
    process.exit(1);
}
const jsonData = JSON.parse(rawData.toString('utf-8'));
class TrenchBookLoader {
    bookLabel;
    bookData;
    images;
    constructor(bookLabel) {
        const book = jsonData[bookLabel];
        if (!book)
            throw new Error(`Trench book "${bookLabel}" not found.`);
        this.bookLabel = bookLabel;
        this.bookData = book;
        this.images = new Map();
        this.loadImages();
    }
    loadImages() {
        for (const scan of this.bookData['trench-book-images'].contents) {
            const filePath = path.join(process.cwd(), 'public', scan);
            try {
                const buffer = fs.readFileSync(filePath);
                const filename = path.basename(scan);
                this.images.set(filename, buffer);
            }
            catch (e) {
                console.error(`Failed to load ${filePath}:`, e);
            }
        }
    }
    getImage(filename) {
        return this.images.get(filename);
    }
    listImages() {
        return Array.from(this.images.keys());
    }
}
exports.TrenchBookLoader = TrenchBookLoader;
//# sourceMappingURL=jpgToMem.js.map