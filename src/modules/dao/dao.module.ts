import { Module } from '@nestjs/common';
import { DaoController } from './dao.controller';
import { ProposalsService } from './proposals.service';
import { VotingService } from './voting.service';
import { StakingService } from './staking.service';
import { TreasuryService } from './treasury.service';
import { GovernanceStatsService } from './governance-stats.service';
import { EventListenerService } from './event-listener.service';
import { IndexerService } from './indexer.service';
import { Web3Module } from '../web3/web3.module';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * DAO Module
 * Provides DAO governance functionality including proposals, voting, staking, and treasury management
 * Includes event listeners for real-time blockchain synchronization
 */
@Module({
  imports: [PrismaModule, Web3Module],
  controllers: [DaoController],
  providers: [
    ProposalsService,
    VotingService,
    StakingService,
    TreasuryService,
    GovernanceStatsService,
    IndexerService,
    EventListenerService,
  ],
  exports: [
    ProposalsService,
    VotingService,
    StakingService,
    TreasuryService,
    GovernanceStatsService,
    IndexerService,
    EventListenerService,
  ],
})
export class DaoModule {}
