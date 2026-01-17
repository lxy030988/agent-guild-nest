import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TreasuryEntity } from './entities/treasury.entity';
import { AssetType } from '@prisma/client';

/**
 * Treasury Service
 * Handles treasury asset tracking
 */
@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all treasury assets
   */
  async getAllAssets(): Promise<TreasuryEntity[]> {
    const assets = await this.prisma.treasury.findMany({
      orderBy: [{ assetType: 'asc' }, { balance: 'desc' }],
    });

    return assets.map((asset) => new TreasuryEntity(asset));
  }

  /**
   * Get treasury overview
   */
  async getOverview() {
    const assets = await this.prisma.treasury.findMany();

    // Group by asset type
    const assetsByType = assets.reduce(
      (acc, asset) => {
        if (!acc[asset.assetType]) {
          acc[asset.assetType] = [];
        }
        acc[asset.assetType].push(asset);
        return acc;
      },
      {} as Record<AssetType, any[]>,
    );

    // Calculate total assets by type
    const summary = Object.entries(assetsByType).map(([type, items]) => ({
      assetType: type,
      count: items.length,
      assets: items.map((item) => ({
        name: item.name,
        symbol: item.symbol,
        balance: item.balance.toString(),
        decimals: item.decimals,
        tokenAddress: item.tokenAddress,
      })),
    }));

    return {
      totalAssets: assets.length,
      assetTypes: Object.keys(assetsByType).length,
      summary,
      lastUpdated: assets.length > 0 ? assets[0].lastUpdated : null,
    };
  }

  /**
   * Get assets by type
   */
  async getAssetsByType(assetType: AssetType): Promise<TreasuryEntity[]> {
    const assets = await this.prisma.treasury.findMany({
      where: { assetType },
      orderBy: { balance: 'desc' },
    });

    return assets.map((asset) => new TreasuryEntity(asset));
  }

  /**
   * Update or create treasury asset
   */
  async upsertAsset(data: {
    assetType: AssetType;
    tokenAddress?: string;
    tokenId?: string;
    balance: string;
    symbol?: string;
    name?: string;
    decimals?: number;
  }): Promise<TreasuryEntity> {
    const whereKey = {
      assetType: data.assetType,
      tokenAddress: data.tokenAddress ?? null,
      tokenId: data.tokenId ? BigInt(data.tokenId) : null,
    } as const;

    const asset = await this.prisma.treasury.upsert({
      where: {
        assetType_tokenAddress_tokenId: whereKey as any,
      },
      create: {
        assetType: data.assetType,
        tokenAddress: data.tokenAddress,
        tokenId: data.tokenId ? BigInt(data.tokenId) : null,
        balance: BigInt(data.balance),
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
      },
      update: {
        balance: BigInt(data.balance),
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
        lastUpdated: new Date(),
      },
    });

    return new TreasuryEntity(asset);
  }

  /**
   * Increment asset balance
   */
  async incrementBalance(
    assetType: AssetType,
    tokenAddress: string | null,
    tokenId: string | null,
    amount: string,
  ): Promise<TreasuryEntity> {
    const whereKey = {
      assetType,
      tokenAddress,
      tokenId: tokenId ? BigInt(tokenId) : null,
    } as const;

    const asset = await this.prisma.treasury.upsert({
      where: {
        assetType_tokenAddress_tokenId: whereKey as any,
      },
      create: {
        assetType,
        tokenAddress,
        tokenId: tokenId ? BigInt(tokenId) : null,
        balance: BigInt(amount),
      },
      update: {
        balance: { increment: BigInt(amount) },
        lastUpdated: new Date(),
      },
    });

    return new TreasuryEntity(asset);
  }

  /**
   * Decrement asset balance
   */
  async decrementBalance(
    assetType: AssetType,
    tokenAddress: string | null,
    tokenId: string | null,
    amount: string,
  ): Promise<TreasuryEntity> {
    const whereKey = {
      assetType,
      tokenAddress,
      tokenId: tokenId ? BigInt(tokenId) : null,
    } as const;

    const asset = await this.prisma.treasury.update({
      where: {
        assetType_tokenAddress_tokenId: whereKey as any,
      },
      data: {
        balance: { decrement: BigInt(amount) },
        lastUpdated: new Date(),
      },
    });

    return new TreasuryEntity(asset);
  }

  /**
   * Get native ETH balance
   */
  async getNativeBalance(): Promise<TreasuryEntity | null> {
    const asset = await this.prisma.treasury.findFirst({
      where: {
        assetType: AssetType.NATIVE,
      },
    });

    return asset ? new TreasuryEntity(asset) : null;
  }

  /**
   * Get ERC20 token balance
   */
  async getERC20Balance(tokenAddress: string): Promise<TreasuryEntity | null> {
    const asset = await this.prisma.treasury.findFirst({
      where: {
        assetType: AssetType.ERC20,
        tokenAddress: tokenAddress.toLowerCase(),
      },
    });

    return asset ? new TreasuryEntity(asset) : null;
  }

  /**
   * Delete an asset (when balance is 0)
   */
  async deleteAsset(
    assetType: AssetType,
    tokenAddress: string | null,
    tokenId: string | null,
  ): Promise<void> {
    const whereKey = {
      assetType,
      tokenAddress,
      tokenId: tokenId ? BigInt(tokenId) : null,
    } as const;

    await this.prisma.treasury.delete({
      where: {
        assetType_tokenAddress_tokenId: whereKey as any,
      },
    });
  }
}
