import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyMessage } from 'ethers';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * 生成随机 Nonce
   */
  private generateNonce(): string {
    return Math.floor(Math.random() * 1000000).toString();
  }

  /**
   * 生成签名消息
   */
  private getSignMessage(walletAddress: string, nonce: string): string {
    return `Welcome to Agent Guild!\n\nSign this message to authenticate your wallet.\n\nWallet: ${walletAddress}\nNonce: ${nonce}`;
  }

  /**
   * 获取或创建用户的 Nonce
   */
  async getNonce(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    const lowerAddress = walletAddress.toLowerCase();

    // 查找或创建用户
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: lowerAddress },
    });

    // 生成新的 nonce
    const nonce = this.generateNonce();

    if (user) {
      // 更新现有用户的 nonce
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { nonce },
      });
    } else {
      // 创建新用户
      user = await this.prisma.user.create({
        data: {
          walletAddress: lowerAddress,
          nonce,
        },
      });
    }

    const message = this.getSignMessage(lowerAddress, nonce);

    return { nonce, message };
  }

  /**
   * 验证签名并登录
   */
  async web3Login(
    walletAddress: string,
    signature: string,
  ): Promise<{ access_token: string; user: any }> {
    const lowerAddress = walletAddress.toLowerCase();

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: lowerAddress },
    });

    if (!user || !user.nonce) {
      throw new UnauthorizedException('Please request a nonce first');
    }

    // 生成期望的消息
    const message = this.getSignMessage(lowerAddress, user.nonce);

    try {
      // 验证签名
      const recoveredAddress = verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== lowerAddress) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch (error) {
      throw new UnauthorizedException('Signature verification failed');
    }

    // 清除 nonce（防止重放攻击）
    await this.prisma.user.update({
      where: { id: user.id },
      data: { nonce: null },
    });

    // 生成 JWT Token
    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '7d', // Token 有效期 7 天
    });

    return {
      access_token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * 获取用户信息
   */
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
