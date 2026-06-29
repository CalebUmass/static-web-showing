// app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TrenchBookService } from './app.service';

@Module({
  controllers: [AppController],
  providers: [TrenchBookService],
})
export class AppModule {}