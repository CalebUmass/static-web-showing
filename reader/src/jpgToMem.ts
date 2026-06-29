import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents the metadata for a trench book, including author, date,
 * and image information.
 */

interface Book {
  author: string;
  date: string;
  'trench-book-images': {
    location: string;    // Base folder path where images are stored
    contents: string[];  // List of relative image file paths
  };
}

/**
 * Represents the full JSON data mapping trench book labels to their metadata.
 */
interface Data {
  [bookLabel: string]: Book;
}

// // Get the directory of the current script file
// const scriptDir = path.dirname(__filename);

// Construct the path to the JSON data file
const dataPath = path.join(process.cwd(), 'public','OCdata.json');

let rawData: Buffer;
try {
  // Synchronously read the JSON data file as a buffer
  rawData = fs.readFileSync(dataPath);
} catch (e) {
  console.error(`Failed to read ${dataPath}:`, e);
  process.exit(1);
}

// Parse the JSON data into a typed object
const jsonData: Data = JSON.parse(rawData.toString('utf-8'));

/**
 * Class responsible for loading and managing images for a single trench book.
 */
export class TrenchBookLoader {
  /** Label of the trench book */
  bookLabel: string;

  /** Metadata object for the trench book */
  bookData: Book;

  /** Map of image file paths to their binary data buffers */
  images: Map<string, Buffer>;

  /**
   * Creates an instance of TrenchBookLoader for a given trench book.
   * Loads all images for that book into memory.
   * 
   * @param bookLabel - The label identifier of the trench book to load
   * @throws Error if the given bookLabel does not exist in the JSON data
   */
  constructor(bookLabel: string) {
    const book = jsonData[bookLabel];
    if (!book) throw new Error(`Trench book "${bookLabel}" not found.`);

    this.bookLabel = bookLabel;
    this.bookData = book;
    this.images = new Map();

    this.loadImages();
  }

  /**
   * Loads all images listed in the trench book's metadata into memory as Buffers.
   * Images are stored in the `images` map, keyed by their relative file paths.
   * Any failure to load an individual image is logged but does not stop the process.
   */
  private loadImages() {
    for (const scan of this.bookData['trench-book-images'].contents) {
      // build full path relative to public folder
      const filePath = path.join(process.cwd(), 'public', scan);
      try {
        const buffer = fs.readFileSync(filePath);
        const filename = path.basename(scan);
        this.images.set(filename, buffer);
      } catch (e) {
        console.error(`Failed to load ${filePath}:`, e);
      }
    }
  }

  /**
   * Retrieves the binary image data buffer for a given filename within the trench book.
   * 
   * @param filename - The image filename to retrieve (e.g., '001.jpg')
   * @returns The image Buffer if found, or undefined if not loaded or does not exist
   */
  getImage(filename: string): Buffer | undefined {
    return this.images.get(filename);
  }

  /**
   * Lists all loaded image file paths currently held in memory for this trench book.
   * 
   * @returns An array of relative image file paths as strings
   */
  listImages(): string[] {
    return Array.from(this.images.keys()); // just ['001.jpg', '002.jpg', ...]
  }
}