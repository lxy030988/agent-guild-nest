import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number; // 用户 ID
  walletAddress: string; // 钱包地址
  iat?: number; // 签发时间
  exp?: number; // 过期时间
}

/**
 * JWT 认证策略
 * 用于验证 JWT Token 并解析用户信息
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // 从 Authorization Header 提取 Token
      ignoreExpiration: false, // 不忽略过期时间
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-please-change-in-production',
    });
  }

  /**
   * 验证 JWT Payload
   * 这里返回的对象会被注入到 request.user
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.walletAddress) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId: payload.sub, // 映射 sub 到 userId
      walletAddress: payload.walletAddress,
    };
  }
}
