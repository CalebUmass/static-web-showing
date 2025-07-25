export declare class TrenchBookService {
    private currentLoader;
    private currentLabel;
    loadBook(label: string): string;
    getImage(label: string, filename: string): Buffer | null;
    isBookLoaded(label: string): boolean;
    listImages(): string[];
}
