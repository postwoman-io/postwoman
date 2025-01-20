import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthProvider, authProviderCheck } from '../helper';
import { Observable } from 'rxjs';
import { AUTH_PROVIDER_NOT_SPECIFIED } from 'src/errors';
import { ConfigService } from '@nestjs/config';
import { throwHTTPErr } from 'src/utils';

@Injectable()
export class MicrosoftSSOGuard
  extends AuthGuard('microsoft')
  implements CanActivate
{
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (
      !authProviderCheck(
        AuthProvider.MICROSOFT,
        this.configService.get('INFRA.VITE_ALLOWED_AUTH_PROVIDERS'),
      )
    ) {
      throwHTTPErr({
        message: AUTH_PROVIDER_NOT_SPECIFIED,
        statusCode: 404,
      });
    }

    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    return {
      prompt: this.configService.get('INFRA.MICROSOFT_PROMPT'),
      state: {
        redirect_uri: req.query.redirect_uri,
      },
    };
  }
}
