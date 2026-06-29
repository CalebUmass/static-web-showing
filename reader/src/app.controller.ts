import { Controller, Post, Body, Get, Query, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { TrenchBookService } from './app.service';

@Controller('trench-book')
export class AppController {
  constructor(private readonly trenchBookService: TrenchBookService) {}

  /**
   * POST /trench-book/load
   * Loads a trench book into memory given a label.
   * @param body.bookLabel - The identifier for the trench book to load.
   * @returns A string message indicating success or failure.
   */
  @Post('load')
  loadBook(@Body() body: { bookLabel: string }) {
    return this.trenchBookService.loadBook(body.bookLabel);
  }

  /**
   * GET /trench-book/image
   * Serves an image from memory as a JPEG binary.
   * @query bookLabel - The currently loaded trench book label.
   * @query filename - The image filename to retrieve.
   * @returns Binary image data or 404 if not found.
   */
  @Get('image')
  getImage(
    @Query('bookLabel') bookLabel: string,
    @Query('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!bookLabel || !filename) {
      throw new BadRequestException('Missing bookLabel or filename');
    }

    const imageBuffer = this.trenchBookService.getImage(bookLabel, filename);
    if (!imageBuffer) {
      throw new NotFoundException('Image not found in memory');
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': imageBuffer.length,
    });
    res.send(imageBuffer);
  }

  /**
   * GET /trench-book/list-images
   * Lists filenames of images currently loaded for the given trench book.
   * @query bookLabel - The label of the book to query.
   * @returns An array of image filenames (e.g., ['001.jpg', '002.jpg']).
   */
  @Get('list-images')
  listImages(@Query('bookLabel') bookLabel: string): string[] {
    if (!bookLabel) return [];

    return this.trenchBookService.isBookLoaded(bookLabel)
      ? this.trenchBookService.listImages()
      : [];
  }
}