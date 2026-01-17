import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ProposalsService } from './proposals.service';
import { VotingService } from './voting.service';
import { StakingService } from './staking.service';
import { TreasuryService } from './treasury.service';
import { GovernanceStatsService } from './governance-stats.service';
import { EventListenerService } from './event-listener.service';
import { IndexerService } from './indexer.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CreateVoteDto } from './dto/vote.dto';
import { QueryProposalsDto } from './dto/query-proposals.dto';
import { QueryVotesDto } from './dto/query-votes.dto';
import { ProposalEntity } from './entities/proposal.entity';
import { VoteEntity } from './entities/vote.entity';
import { StakeEntity } from './entities/stake.entity';
import { TreasuryEntity } from './entities/treasury.entity';
import { GovernanceStatsEntity } from './entities/governance-stats.entity';
import { GovernanceActivityEntity } from './entities/governance-activity.entity';
import { AssetType } from '@prisma/client';

@ApiTags('dao')
@Controller('dao')
export class DaoController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly votingService: VotingService,
    private readonly stakingService: StakingService,
    private readonly treasuryService: TreasuryService,
    private readonly governanceStatsService: GovernanceStatsService,
    private readonly eventListenerService: EventListenerService,
    private readonly indexerService: IndexerService,
  ) {}

  // ==================== Proposals ====================

  @Public()
  @Get('proposals')
  @ApiOperation({ summary: 'Get all proposals with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of proposals',
    type: [ProposalEntity],
  })
  async getProposals(@Query() query: QueryProposalsDto) {
    return this.proposalsService.findAll(query);
  }

  @Public()
  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get proposal details by ID' })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns proposal details',
    type: ProposalEntity,
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposal(@Param('id') id: string) {
    return this.proposalsService.findOne(id);
  }

  @Post('proposals')
  @ApiOperation({ summary: 'Create a new proposal record' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Proposal created successfully',
    type: ProposalEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @HttpCode(HttpStatus.CREATED)
  async createProposal(@Body() createProposalDto: CreateProposalDto) {
    return this.proposalsService.create(createProposalDto);
  }

  @Post('proposals/sync/:id')
  @ApiOperation({ summary: 'Sync proposal data from blockchain' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({
    status: 200,
    description: 'Proposal synced successfully',
    type: ProposalEntity,
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  @ApiResponse({ status: 400, description: 'Failed to sync from blockchain' })
  @HttpCode(HttpStatus.OK)
  async syncProposal(@Param('id') id: string) {
    return this.proposalsService.syncFromBlockchain(id);
  }

  @Public()
  @Get('proposals/:id/votes')
  @ApiOperation({ summary: 'Get votes for a specific proposal' })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of votes',
    type: [VoteEntity],
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposalVotes(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.proposalsService.getProposalVotes(id, page, limit);
  }

  @Public()
  @Get('proposals/:id/stats')
  @ApiOperation({ summary: 'Get voting statistics for a proposal' })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns vote statistics',
  })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposalStats(@Param('id') id: string) {
    return this.votingService.getProposalVoteStats(id);
  }

  // ==================== Votes ====================

  @Public()
  @Get('votes/:walletAddress')
  @ApiOperation({ summary: 'Get vote history for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated vote history',
    type: [VoteEntity],
  })
  async getVotesByWallet(
    @Param('walletAddress') walletAddress: string,
    @Query() query: QueryVotesDto,
  ) {
    return this.votingService.findByWallet(walletAddress, query);
  }

  @Post('votes')
  @ApiOperation({ summary: 'Record a new vote' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Vote recorded successfully',
    type: VoteEntity,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  @ApiResponse({ status: 409, description: 'User has already voted' })
  @HttpCode(HttpStatus.CREATED)
  async createVote(@Body() createVoteDto: CreateVoteDto) {
    return this.votingService.create(createVoteDto);
  }

  @Public()
  @Get('votes/:walletAddress/history')
  @ApiOperation({ summary: 'Get detailed voting history for a wallet' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns voting history summary',
  })
  async getVotingHistory(@Param('walletAddress') walletAddress: string) {
    return this.governanceStatsService.getVotingHistory(walletAddress);
  }

  // ==================== Staking ====================

  @Public()
  @Get('staking/:walletAddress')
  @ApiOperation({ summary: 'Get all stakes for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of stakes',
    type: [StakeEntity],
  })
  async getStakesByWallet(@Param('walletAddress') walletAddress: string) {
    return this.stakingService.findByWallet(walletAddress);
  }

  @Public()
  @Get('staking/:walletAddress/active')
  @ApiOperation({ summary: 'Get active stakes for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of active stakes',
    type: [StakeEntity],
  })
  async getActiveStakes(@Param('walletAddress') walletAddress: string) {
    return this.stakingService.getActiveStakes(walletAddress);
  }

  @Public()
  @Get('staking/power/:walletAddress')
  @ApiOperation({ summary: 'Get voting power for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns voting power information',
  })
  async getVotingPower(@Param('walletAddress') walletAddress: string) {
    return this.stakingService.getVotingPower(walletAddress);
  }

  @Public()
  @Get('staking/:walletAddress/summary')
  @ApiOperation({ summary: 'Get staking summary for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns staking summary',
  })
  async getStakingSummary(@Param('walletAddress') walletAddress: string) {
    return this.stakingService.getStakingSummary(walletAddress);
  }

  // ==================== Treasury ====================

  @Public()
  @Get('treasury')
  @ApiOperation({ summary: 'Get treasury overview' })
  @ApiResponse({
    status: 200,
    description: 'Returns treasury overview with all assets',
  })
  async getTreasuryOverview() {
    return this.treasuryService.getOverview();
  }

  @Public()
  @Get('treasury/assets')
  @ApiOperation({ summary: 'Get all treasury assets' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of all treasury assets',
    type: [TreasuryEntity],
  })
  async getAllTreasuryAssets() {
    return this.treasuryService.getAllAssets();
  }

  @Public()
  @Get('treasury/assets/:assetType')
  @ApiOperation({ summary: 'Get treasury assets by type' })
  @ApiParam({
    name: 'assetType',
    enum: AssetType,
    description: 'Asset type (NATIVE, ERC20, ERC721, ERC1155)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of assets by type',
    type: [TreasuryEntity],
  })
  async getTreasuryAssetsByType(@Param('assetType') assetType: AssetType) {
    return this.treasuryService.getAssetsByType(assetType);
  }

  @Public()
  @Get('treasury/native')
  @ApiOperation({ summary: 'Get native ETH balance' })
  @ApiResponse({
    status: 200,
    description: 'Returns native ETH balance',
    type: TreasuryEntity,
  })
  async getNativeBalance() {
    return this.treasuryService.getNativeBalance();
  }

  @Public()
  @Get('treasury/erc20/:tokenAddress')
  @ApiOperation({ summary: 'Get ERC20 token balance' })
  @ApiParam({ name: 'tokenAddress', description: 'ERC20 token address' })
  @ApiResponse({
    status: 200,
    description: 'Returns ERC20 token balance',
    type: TreasuryEntity,
  })
  async getERC20Balance(@Param('tokenAddress') tokenAddress: string) {
    return this.treasuryService.getERC20Balance(tokenAddress);
  }

  // ==================== Governance Stats ====================

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Get overall governance statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns overall governance statistics',
  })
  async getOverallStats() {
    return this.governanceStatsService.getOverallStats();
  }

  @Public()
  @Get('stats/:walletAddress')
  @ApiOperation({ summary: 'Get governance statistics for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns governance statistics for the wallet',
    type: GovernanceStatsEntity,
  })
  async getUserStats(@Param('walletAddress') walletAddress: string) {
    return this.governanceStatsService.getStats(walletAddress);
  }

  @Public()
  @Get('stats/:walletAddress/participation')
  @ApiOperation({ summary: 'Get participation rate for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiResponse({
    status: 200,
    description: 'Returns participation rate',
  })
  async getParticipationRate(@Param('walletAddress') walletAddress: string) {
    return this.governanceStatsService.getParticipationRate(walletAddress);
  }

  // ==================== Activity ====================

  @Public()
  @Get('activity/:walletAddress')
  @ApiOperation({ summary: 'Get governance activity feed for a wallet address' })
  @ApiParam({ name: 'walletAddress', description: 'Ethereum wallet address' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Returns activity feed',
    type: [GovernanceActivityEntity],
  })
  async getUserActivity(
    @Param('walletAddress') walletAddress: string,
    @Query('limit') limit?: number,
  ) {
    return this.governanceStatsService.getUserActivity(walletAddress, limit);
  }

  @Public()
  @Get('activity')
  @ApiOperation({ summary: 'Get recent governance activities (global feed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Returns recent activities',
    type: [GovernanceActivityEntity],
  })
  async getRecentActivity(@Query('limit') limit?: number) {
    return this.governanceStatsService.getRecentActivity(limit);
  }

  // ==================== Event Listener Management ====================

  @Public()
  @Get('listener/status')
  @ApiOperation({ summary: 'Get event listener status' })
  @ApiResponse({
    status: 200,
    description: 'Returns event listener status and configuration',
  })
  async getListenerStatus() {
    return this.eventListenerService.getStatus();
  }

  @Post('listener/start')
  @ApiOperation({ summary: 'Start event listener (admin only)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Event listener started successfully',
  })
  @HttpCode(HttpStatus.OK)
  async startListener() {
    await this.eventListenerService.startListening();
    return { message: 'Event listener started successfully' };
  }

  @Post('listener/stop')
  @ApiOperation({ summary: 'Stop event listener (admin only)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Event listener stopped successfully',
  })
  @HttpCode(HttpStatus.OK)
  async stopListener() {
    await this.eventListenerService.stopListening();
    return { message: 'Event listener stopped successfully' };
  }

  @Post('indexer/reindex')
  @ApiOperation({ summary: 'Re-index events from a specific block (admin only)' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'fromBlock',
    required: true,
    type: String,
    description: 'Starting block number for re-indexing',
  })
  @ApiResponse({
    status: 200,
    description: 'Re-indexing completed successfully',
  })
  @HttpCode(HttpStatus.OK)
  async reindexFromBlock(@Query('fromBlock') fromBlock: string) {
    await this.indexerService.reindexFromBlock(BigInt(fromBlock));
    return { message: 'Re-indexing completed successfully' };
  }
}
