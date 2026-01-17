import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Web3Provider } from './web3.provider';
import { Address, parseAbiItem } from 'viem';

/**
 * Contracts Service
 * Provides helper methods for interacting with smart contracts
 */
@Injectable()
export class ContractsService {
  private governorAddress: Address;
  private tokenAddress: Address;
  private stakingAddress: Address;

  constructor(
    private web3Provider: Web3Provider,
    private configService: ConfigService,
  ) {
    this.governorAddress = this.configService.get<Address>('GOVERNOR_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000');
    this.tokenAddress = this.configService.get<Address>('TOKEN_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000');
    this.stakingAddress = this.configService.get<Address>('STAKING_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000');
  }

  /**
   * Get proposal details from Governor contract
   */
  async getProposal(proposalId: bigint) {
    const client = this.web3Provider.getPublicClient();

    try {
      const proposal = await client.readContract({
        address: this.governorAddress,
        abi: [
          parseAbiItem('function proposals(uint256) view returns (uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed)'),
        ],
        functionName: 'proposals',
        args: [proposalId],
      });

      return proposal;
    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      throw error;
    }
  }

  /**
   * Get proposal state from Governor contract
   */
  async getProposalState(proposalId: bigint): Promise<number> {
    const client = this.web3Provider.getPublicClient();

    try {
      const state = await client.readContract({
        address: this.governorAddress,
        abi: [
          parseAbiItem('function state(uint256) view returns (uint8)'),
        ],
        functionName: 'state',
        args: [proposalId],
      });

      return Number(state);
    } catch (error) {
      console.error(`Error fetching proposal state ${proposalId}:`, error);
      throw error;
    }
  }

  /**
   * Get voting power for an address at a specific block
   */
  async getVotingPower(address: Address, blockNumber?: bigint): Promise<bigint> {
    const client = this.web3Provider.getPublicClient();

    try {
      const votingPower = await client.readContract({
        address: this.tokenAddress,
        abi: [
          parseAbiItem('function getPastVotes(address, uint256) view returns (uint256)'),
        ],
        functionName: 'getPastVotes',
        args: [address, blockNumber || 0n],
      });

      return votingPower as bigint;
    } catch (error) {
      console.error(`Error fetching voting power for ${address}:`, error);
      return 0n;
    }
  }

  /**
   * Get current voting power for an address
   */
  async getCurrentVotingPower(address: Address): Promise<bigint> {
    const client = this.web3Provider.getPublicClient();

    try {
      const votingPower = await client.readContract({
        address: this.tokenAddress,
        abi: [
          parseAbiItem('function getVotes(address) view returns (uint256)'),
        ],
        functionName: 'getVotes',
        args: [address],
      });

      return votingPower as bigint;
    } catch (error) {
      console.error(`Error fetching current voting power for ${address}:`, error);
      return 0n;
    }
  }

  /**
   * Get staking information for an address
   */
  async getStakeInfo(address: Address) {
    const client = this.web3Provider.getPublicClient();

    try {
      const stakeInfo = await client.readContract({
        address: this.stakingAddress,
        abi: [
          parseAbiItem('function stakes(address) view returns (uint256 amount, uint256 lockPeriod, uint256 unlockTime, uint256 multiplier)'),
        ],
        functionName: 'stakes',
        args: [address],
      });

      return stakeInfo;
    } catch (error) {
      console.error(`Error fetching stake info for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: `0x${string}`) {
    const client = this.web3Provider.getPublicClient();

    try {
      return await client.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      console.error(`Error fetching transaction receipt ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Get block information
   */
  async getBlock(blockNumber: bigint) {
    const client = this.web3Provider.getPublicClient();

    try {
      return await client.getBlock({ blockNumber });
    } catch (error) {
      console.error(`Error fetching block ${blockNumber}:`, error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<bigint> {
    const client = this.web3Provider.getPublicClient();
    return await client.getBlockNumber();
  }

  /**
   * Get contract addresses
   */
  getGovernorAddress(): Address {
    return this.governorAddress;
  }

  getTokenAddress(): Address {
    return this.tokenAddress;
  }

  getStakingAddress(): Address {
    return this.stakingAddress;
  }
}
