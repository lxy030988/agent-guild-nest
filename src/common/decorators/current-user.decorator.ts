import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 自定义装饰器：获取当前用户
 * 使用示例：@CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // 从请求中获取用户信息（需要先通过认证中间件设置）
  },
);
