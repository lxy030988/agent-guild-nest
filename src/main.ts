import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动删除非白名单属性
      forbidNonWhitelisted: true, // 如果有非白名单属性则抛出错误
      transform: true, // 自动转换类型
    }),
  );

  // 全局拦截器
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // 全局异常过滤器（处理所有异常）
  app.useGlobalFilters(new AllExceptionsFilter());

  // 启用 CORS
  app.enableCors();

  // 配置 Swagger
  const config = new DocumentBuilder()
    .setTitle('Agent Guild Nest API')
    .setDescription('Web3 / DAO 驱动的多智能体协作与管理平台 API')
    .setVersion('1.0')
    .addBearerAuth() // 添加 JWT Bearer Token 认证
    .addTag('认证', 'Web3 钱包登录与用户认证')
    .addTag('users', '用户管理')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
