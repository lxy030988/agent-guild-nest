import { Controller, Get, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getIndex(@Res() res: Response): void {
    // __dirname 是 dist/src，向上一级到 dist
    res.sendFile(join(__dirname, '..', 'index.html'));
  }

  @Public()
  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}
