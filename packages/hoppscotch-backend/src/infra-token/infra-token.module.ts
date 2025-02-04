import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InfraTokenResolver } from './infra-token.resolver';
import { InfraTokenService } from './infra-token.service';
import { InfraTokensController } from './infra-token.controller';
import { AdminModule } from 'src/admin/admin.module';
import { UserModule } from 'src/user/user.module';
import { TeamModule } from 'src/team/team.module';

@Module({
  imports: [PrismaModule, AdminModule, UserModule, TeamModule],
  controllers: [InfraTokensController],
  providers: [InfraTokenResolver, InfraTokenService],
})
export class InfraTokenModule {}
