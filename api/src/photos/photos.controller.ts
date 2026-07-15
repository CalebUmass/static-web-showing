//Photo point endpoints for the dig map.
//Behind the Apache proxy (ProxyPass /api/photos -> 127.0.0.1:3001/photos)
//these become:
//  GET    /api/photos        public GeoJSON of all photo points
//  POST   /api/photos        create a point           (passphrase required)
//  PUT    /api/photos/:id    update a point           (passphrase required)
//  DELETE /api/photos/:id    delete a point           (passphrase required)

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PhotosService } from './photos.service';
import { EditTokenGuard } from './edit-token.guard';

//free-text identity for the audit log, not a security boundary
function editorName(header?: string): string {
  return (header || 'unknown').slice(0, 80);
}

@Controller('photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  list() {
    return this.photos.featureCollection();
  }

  @Post()
  @UseGuards(EditTokenGuard)
  create(@Body() body: unknown, @Headers('x-editor') editor?: string) {
    return this.photos.create(body, editorName(editor));
  }

  @Put(':id')
  @UseGuards(EditTokenGuard)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('x-editor') editor?: string,
  ) {
    return this.photos.update(id, body, editorName(editor));
  }

  @Delete(':id')
  @UseGuards(EditTokenGuard)
  remove(@Param('id') id: string, @Headers('x-editor') editor?: string) {
    return this.photos.remove(id, editorName(editor));
  }
}
