//HTTP layer only; all real work happens in CassettaService.
//Routes (behind the Apache proxy these appear at the site root):
//  GET  /api/cassetta/find?number=PC%2019720072&site=PC
//  GET  /api/cassetta/status
//  POST /api/cassetta/refresh
import { BadRequestException, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CassettaService } from './cassetta.service';

@Controller('api/cassetta')
export class CassettaController {
  constructor(private readonly cassetta: CassettaService) {}

  @Get('find')
  async find(@Query('number') number = '', @Query('site') site = 'PC') {
    const parsed = this.cassetta.parseNumber(number, site);
    if (!parsed) {
      throw new BadRequestException('number not recognized, expected forms like PC 19720072');
    }
    const { matches, indexedAt } = await this.cassetta.find(parsed.key);
    return {
      number: parsed.display,
      found: matches.length > 0,
      matches,
      indexedAt,
    };
  }

  @Get('status')
  status() {
    return this.cassetta.status();
  }

  @Post('refresh')
  @HttpCode(202)
  refresh() {
    return this.cassetta.requestRefresh();
  }
}
