import { Module } from '@nestjs/common';
import { TrenchBookController } from './trench-book.controller';
import { TrenchBookService } from './trench-book.service';

@Module({
  controllers: [TrenchBookController],
  providers: [TrenchBookService],
})
export class TrenchBookModule {}