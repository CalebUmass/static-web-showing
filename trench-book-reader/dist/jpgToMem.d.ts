interface Book {
    author: string;
    date: string;
    'trench-book-images': {
        location: string;
        contents: string[];
    };
}
export declare class TrenchBookLoader {
    bookLabel: string;
    bookData: Book;
    images: Map<string, Buffer>;
    constructor(bookLabel: string);
    private loadImages;
    getImage(filename: string): Buffer | undefined;
    listImages(): string[];
}
export {};
