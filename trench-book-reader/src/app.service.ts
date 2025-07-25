import { Injectable } from '@nestjs/common';
import { TrenchBookLoader } from './jpgToMem';

@Injectable()
export class TrenchBookService {
  /** Currently active image loader */
  private currentLoader: TrenchBookLoader | null = null;

  /** Label of the currently loaded trench book */
  private currentLabel: string | null = null;

  /**
   * Loads a trench book into memory by label.
   * Clears any previously loaded book.
   * 
   * @param label - The label of the book to load (e.g., 'Trench-Book-CT-III')
   * @returns A status message indicating success or failure
   */
  loadBook(label: string): string {
    if (this.currentLabel === label) {
      return `✅ "${label}" is already loaded.`;
    }

    if (this.currentLoader) {
      console.log(`🧹 Clearing previous book "${this.currentLabel}" from memory...`);
      this.currentLoader = null;
      this.currentLabel = null;
    }

    try {
      this.currentLoader = new TrenchBookLoader(label);
      this.currentLabel = label;
      const count = this.currentLoader.listImages().length;
      console.log(`📚 Loaded "${label}" with ${count} images`);
      return `📚 Book "${label}" loaded with ${count} images`;
    } catch (e: any) {
      console.error(`❌ Failed to load book "${label}":`, e.message);
      return `❌ Failed to load "${label}": ${e.message}`;
    }
  }

  /**
   * Retrieves an image buffer by filename from the currently loaded book.
   * 
   * @param label - The book label the image must belong to
   * @param filename - The filename of the image (e.g., '001.jpg')
   * @returns The image Buffer or null if not found
   */
  getImage(label: string, filename: string): Buffer | null {
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

  /**
   * Checks if a specific book is currently loaded in memory.
   * 
   * @param label - The label of the book to check
   * @returns True if the book is currently loaded
   */
  isBookLoaded(label: string): boolean {
    return this.currentLoader !== null && this.currentLabel === label;
  }

  /**
   * Returns a list of all image filenames currently loaded in memory.
   * 
   * @returns An array of image filenames or an empty array
   */
  listImages(): string[] {
    return this.currentLoader?.listImages() ?? [];
  }
}