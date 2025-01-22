import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { UserModule } from '../user/user.module';
import { TeamModule } from '../team/team.module';
import { TeamInvitationModule } from '../team-invitation/team-invitation.module';
import { TeamEnvironmentsModule } from '../team-environments/team-environments.module';
import { TeamCollectionModule } from '../team-collection/team-collection.module';
import { TeamRequestModule } from '../team-request/team-request.module';
import { InfraResolver } from './infra.resolver';
import { ShortcodeModule } from 'src/shortcode/shortcode.module';
import { InfraConfigModule } from 'src/infra-config/infra-config.module';
import { UserHistoryModule } from 'src/user-history/user-history.module';

@Module({
  imports: [
    PrismaModule,
    PubSubModule,
    UserModule,
    TeamModule,
    TeamInvitationModule,
    TeamEnvironmentsModule,
    TeamCollectionModule,
    TeamRequestModule,
    ShortcodeModule,
    InfraConfigModule,
    UserHistoryModule,
  ],
  providers: [InfraResolver, AdminResolver, AdminService],
  exports: [AdminService],
})
export class AdminModule {}
