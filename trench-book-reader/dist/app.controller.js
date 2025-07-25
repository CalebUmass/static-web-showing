"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    trenchBookService;
    constructor(trenchBookService) {
        this.trenchBookService = trenchBookService;
    }
    loadBook(body) {
        return this.trenchBookService.loadBook(body.bookLabel);
    }
    getImage(bookLabel, filename, res) {
        if (!bookLabel || !filename) {
            throw new common_1.BadRequestException('Missing bookLabel or filename');
        }
        const imageBuffer = this.trenchBookService.getImage(bookLabel, filename);
        if (!imageBuffer) {
            throw new common_1.NotFoundException('Image not found in memory');
        }
        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Length': imageBuffer.length,
        });
        res.send(imageBuffer);
    }
    listImages(bookLabel) {
        if (!bookLabel)
            return [];
        return this.trenchBookService.isBookLoaded(bookLabel)
            ? this.trenchBookService.listImages()
            : [];
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Post)('load'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "loadBook", null);
__decorate([
    (0, common_1.Get)('image'),
    __param(0, (0, common_1.Query)('bookLabel')),
    __param(1, (0, common_1.Query)('filename')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getImage", null);
__decorate([
    (0, common_1.Get)('list-images'),
    __param(0, (0, common_1.Query)('bookLabel')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Array)
], AppController.prototype, "listImages", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)('trench-book'),
    __metadata("design:paramtypes", [app_service_1.TrenchBookService])
], AppController);
//# sourceMappingURL=app.controller.js.map