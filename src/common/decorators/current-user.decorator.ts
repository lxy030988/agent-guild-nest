import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 自定义装饰器：获取当前用户
 * 使用示例：@CurrentUser() user: User 或 @CurrentUser('userId') userId: number
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    console.log(
      '[CurrentUser DEBUG] data:',
      data,
      '| user:',
      JSON.stringify(user),
    );

    // 如果指定了字段名，返回该字段；否则返回整个用户对象
    const result = data ? user?.[data] : user;
    console.log('[CurrentUser DEBUG] returning:', result);
    return result;
  },
);
