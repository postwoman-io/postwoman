import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { InfraConfig } from './infra-config.model';
import { InfraConfigService } from './infra-config.service';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { PubSubService } from 'src/pubsub/pubsub.service';
import { InfraConfigEnum } from 'src/types/InfraConfig';
import * as E from 'fp-ts/Either';
import { throwErr } from 'src/utils';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => InfraConfig)
export class InfraConfigResolver {
  constructor(
    private infraConfigService: InfraConfigService,
    private pubsub: PubSubService,
  ) {}

  /* Query */

  @Query(() => Boolean, {
    description: 'Check if the SMTP is enabled or not',
  })
  @UseGuards(GqlAuthGuard)
  isSMTPEnabled() {
    return this.infraConfigService.isSMTPEnabled();
  }

  @Query(() => InfraConfig, {
    description: 'Check if user history is enabled or not',
  })
  @UseGuards(GqlAuthGuard)
  async isUserHistoryEnabled() {
    const isEnabled = await this.infraConfigService.isUserHistoryEnabled();
    if (E.isLeft(isEnabled)) throwErr(isEnabled.left);
    return isEnabled.right;
  }

  /* Subscriptions */

  @Subscription(() => String, {
    description: 'Subscription for infra config update',
    resolve: (value) => value,
  })
  @SkipThrottle()
  @UseGuards(GqlAuthGuard)
  infraConfigUpdate(
    @Args({
      name: 'configName',
      description: 'Infra config key',
      type: () => InfraConfigEnum,
    })
    configName: string,
  ) {
    return this.pubsub.asyncIterator(`infra_config/${configName}/updated`);
  }
}
