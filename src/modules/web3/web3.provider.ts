import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient, Chain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

/**
 * Web3 Provider
 * Manages Viem clients for blockchain interactions
 */
@Injectable()
export class Web3Provider implements OnModuleInit {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private chain: Chain;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const chainId = this.configService.get<number>('CHAIN_ID', 1);
    const rpcUrl = this.configService.get<string>('RPC_URL', 'https://eth.llamarpc.com');

    // Select chain based on chain ID
    this.chain = chainId === 1 ? mainnet : sepolia;

    // Create public client for reading blockchain data
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });

    // Create wallet client for writing transactions (if private key is provided)
    const privateKey = this.configService.get<string>('PRIVATE_KEY');
    if (privateKey) {
      this.walletClient = createWalletClient({
        chain: this.chain,
        transport: http(rpcUrl),
      });
    }

    console.log(`✅ Web3 Provider initialized for chain: ${this.chain.name}`);
  }

  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  getWalletClient(): WalletClient | undefined {
    return this.walletClient;
  }

  getChain(): Chain {
    return this.chain;
  }
}
