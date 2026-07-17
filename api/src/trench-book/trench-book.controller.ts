//HTTP layer for the trench book reader (moved here from the standalone
//reader NestJS app so one API process serves the whole site).
//Routes (behind the Apache proxy these appear at the site root):
//  POST /api/trench-book/load
//  GET  /api/trench-book/list-images?bookLabel=...
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { TrenchBookService } from './trench-book.service';

@Controller('trench-book')
export class TrenchBookController {
  constructor(private readonly trenchBooks: TrenchBookService) {}

  //validates the requested book exists and returns a status string.
  //kept for frontend compatibility; it never loads image bytes into memory.
  @Post('load')
  loadBook(@Body() body: { bookLabel: string }): string {
    return this.trenchBooks.describeBook(body?.bookLabel ?? '');
  }

  //returns the image filenames for any book, independent of other requests
  @Get('list-images')
  listImages(@Query('bookLabel') bookLabel: string): string[] {
    if (!bookLabel) return [];
    return this.trenchBooks.listImages(bookLabel);
  }
}