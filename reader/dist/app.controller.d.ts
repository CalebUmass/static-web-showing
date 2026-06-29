import { Response } from 'express';
import { TrenchBookService } from './app.service';
export declare class AppController {
    private readonly trenchBookService;
    constructor(trenchBookService: TrenchBookService);
    loadBook(body: {
        bookLabel: string;
    }): string;
    getImage(bookLabel: string, filename: string, res: Response): void;
    listImages(bookLabel: string): string[];
}
