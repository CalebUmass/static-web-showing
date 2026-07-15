import { Module } from '@nestjs/common';
import { PhotosModule } from './photos/photos.module';
import { CassettaModule } from './cassetta/cassetta.module';

@Module({ imports: [PhotosModule, CassettaModule] })
export class AppModule {}