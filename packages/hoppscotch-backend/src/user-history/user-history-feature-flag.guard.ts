import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { USER_HISTORY_FEATURE_FLAG_DISABLED } from 'src/errors';
import { InfraConfigService } from 'src/infra-config/infra-config.service';
import { throwErr } from 'src/utils';
import * as E from 'fp-ts/Either';
import { ServiceStatus } from 'src/infra-config/helper';

@Injectable()
export class UserHistoryFeatureFlagGuard implements CanActivate {
  constructor(private readonly infraConfigService: InfraConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isEnabled = await this.infraConfigService.isUserHistoryEnabled();
    if (E.isLeft(isEnabled)) throwErr(isEnabled.left);

    if (isEnabled.right.value !== ServiceStatus.ENABLE)
      throwErr(USER_HISTORY_FEATURE_FLAG_DISABLED);

    return true;
  }
}
