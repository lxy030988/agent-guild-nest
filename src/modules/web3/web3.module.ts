import { Module, Global } from '@nestjs/common';
import { Web3Provider } from './web3.provider';
import { ContractsService } from './contracts.service';

/**
 * Web3 Module
 * Global module for blockchain interactions
 */
@Global()
@Module({
  providers: [Web3Provider, ContractsService],
  exports: [Web3Provider, ContractsService],
})
export class Web3Module {}
