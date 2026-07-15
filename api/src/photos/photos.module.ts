//Feature module for the dig map photo points.
//Registered in src/app.module.ts alongside CassettaModule.
import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
