import { Module } from '@nestjs/common';
import { PhotosModule } from './photos/photos.module';
import { CassettaModule } from './cassetta/cassetta.module';
import { TrenchBookModule } from './trench-book/trench-book.module';

@Module({ imports: [PhotosModule, CassettaModule, TrenchBookModule] })
export class AppModule {}