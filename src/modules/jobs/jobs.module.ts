import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsMatchingService } from './jobs-matching.service';
import { JobsExecutionService } from './jobs-execution.service';
import { JobsCompetitionService } from './jobs-competition.service'; // 🆕
import { JobApplicationController } from './job-application.controller';
import { JobApplicationService } from './job-application.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillsModule } from '../bills/bills.module';

@Module({
  imports: [PrismaModule, BillsModule],
  controllers: [JobsController, JobApplicationController],
  providers: [
    JobsService,
    JobsMatchingService,
    JobsExecutionService,
    JobsCompetitionService, // 🆕
    JobApplicationService,
  ],
  exports: [
    JobsService,
    JobsMatchingService,
    JobsExecutionService,
    JobsCompetitionService, // 🆕
    JobApplicationService,
  ],
})
export class JobsModule {}
