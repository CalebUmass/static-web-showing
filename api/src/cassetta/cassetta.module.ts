//Feature module for the mag-search cassetta lookup.
//Registered in src/app.module.ts alongside PhotosModule.
import { Module } from '@nestjs/common';
import { CassettaController } from './cassetta.controller';
import { CassettaService } from './cassetta.service';

@Module({
  controllers: [CassettaController],
  providers: [CassettaService],
})
export class CassettaModule {}
