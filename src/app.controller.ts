import { Controller, Get, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getIndex(@Res() res: Response): void {
    // __dirname 是 dist/src，向上一级到 dist
    res.sendFile(join(__dirname, '..', 'index.html'));
  }

  @Get('api')
  getHello(): string {
    return this.appService.getHello();
  }
}
