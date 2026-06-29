import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertExpiryJob } from './alert-expiry.job';
import { EligibilityJob } from './eligibility.job';
import { LeaderboardJob } from './leaderboard.job';
import { PurchaseOrderExpiryJob } from './purchase-order-expiry.job';
import { TokenExpireJob } from './token-expire.job';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    AlertExpiryJob,
    EligibilityJob,
    LeaderboardJob,
    PurchaseOrderExpiryJob,
    TokenExpireJob,
  ],
})
export class JobsModule {}
