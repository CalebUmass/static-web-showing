//Trench book metadata lookups for the reader frontend.
//OCdata.json and the scanned page images live in the reader's public folder,
//which Apache serves to browsers directly; this service only reads the
//metadata and checks which image files exist. Set TRENCH_DATA_DIR if that
//folder ever moves out of the repository (e.g. onto server-only storage).
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

//metadata for a single trench book, as stored in OCdata.json
interface Book {
  author: string;
  date: string;
  'trench-book-images': {
    location: string;
    contents: string[];
  };
}

@Injectable()
export class TrenchBookService {
  private readonly logger = new Logger(TrenchBookService.name);

  //compiled file sits at api/dist/trench-book/, so three levels up is the
  //repository root
  private readonly dataDir =
    process.env.TRENCH_DATA_DIR ||
    path.join(__dirname, '..', '..', '..', 'reader', 'public');

  private books: Record<string, Book> = {};

  constructor() {
    //read the metadata once at startup; it is small and rarely changes.
    //a missing file must not kill the process: this app also serves the
    //cassetta and photo endpoints, so log and carry on with no books.
    const dataPath = path.join(this.dataDir, 'OCdata.json');
    try {
      this.books = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
      this.logger.error(`Failed to read ${dataPath}: ${e}`);
    }
  }

  //true if the given book label exists in the metadata
  bookExists(label: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.books, label);
  }

  //image filenames for a book, or [] if the label is unknown.
  //only files that actually exist on disk are returned, without reading
  //any image bytes into memory.
  listImages(label: string): string[] {
    const book = this.books[label];
    if (!book) return [];
    return book['trench-book-images'].contents
      .filter((rel) => fs.existsSync(path.join(this.dataDir, rel)))
      .map((rel) => path.basename(rel));
  }

  //validates that a book exists and reports its image count
  describeBook(label: string): string {
    if (!this.bookExists(label)) {
      return `Failed to load "${label}": not found`;
    }
    const count = this.listImages(label).length;
    return `Book "${label}" ready with ${count} images`;
  }
}