import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';

/**
 * 全局异常过滤器
 * 统一处理所有异常（包括未处理的错误）
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // 判断是否为 HTTP 异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // 判断是 API 请求还是浏览器请求
    const acceptHeader = request.headers.accept || '';
    const isApiRequest =
      acceptHeader.includes('application/json') ||
      request.url.startsWith('/api/') ||
      request.url.startsWith('/users') ||
      request.url.startsWith('/posts');

    if (isApiRequest) {
      // 返回 JSON 响应（API 请求）
      response.status(status).json({
        success: false,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message,
      });
    } else {
      // 返回 HTML 页面（浏览器请求）
      if (status === 404) {
        // __dirname 是 dist/src/common/filters，向上3级到 dist
        response.status(404).sendFile(join(__dirname, '../../..', '404.html'));
      } else {
        response
          .status(status)
          .sendFile(join(__dirname, '../../..', '500.html'));
      }
    }
  }
}
