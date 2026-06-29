"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrenchBookService = void 0;
const common_1 = require("@nestjs/common");
const jpgToMem_1 = require("./jpgToMem");
let TrenchBookService = class TrenchBookService {
    currentLoader = null;
    currentLabel = null;
    loadBook(label) {
        if (this.currentLabel === label) {
            return `✅ "${label}" is already loaded.`;
        }
        if (this.currentLoader) {
            console.log(`🧹 Clearing previous book "${this.currentLabel}" from memory...`);
            this.currentLoader = null;
            this.currentLabel = null;
        }
        try {
            this.currentLoader = new jpgToMem_1.TrenchBookLoader(label);
            this.currentLabel = label;
            const count = this.currentLoader.listImages().length;
            console.log(`📚 Loaded "${label}" with ${count} images`);
            return `📚 Book "${label}" loaded with ${count} images`;
        }
        catch (e) {
            console.error(`❌ Failed to load book "${label}":`, e.message);
            return `❌ Failed to load "${label}": ${e.message}`;
        }
    }
    getImage(label, filename) {
        if (!this.currentLoader) {
            console.log('No currentLoader loaded.');
            return null;
        }
        if (this.currentLabel !== label) {
            console.log(`Label mismatch: current="${this.currentLabel}", requested="${label}"`);
            return null;
        }
        const image = this.currentLoader.getImage(filename);
        if (!image) {
            console.log(`Image not found: "${filename}"`);
            console.log('Available keys:', this.currentLoader.listImages());
        }
        return image ?? null;
    }
    isBookLoaded(label) {
        return this.currentLoader !== null && this.currentLabel === label;
    }
    listImages() {
        return this.currentLoader?.listImages() ?? [];
    }
};
exports.TrenchBookService = TrenchBookService;
exports.TrenchBookService = TrenchBookService = __decorate([
    (0, common_1.Injectable)()
], TrenchBookService);
//# sourceMappingURL=app.service.js.map