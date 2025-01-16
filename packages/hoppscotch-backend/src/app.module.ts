import { HttpException, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { UserModule } from './user/user.module';
import { GQLComplexityPlugin } from './plugins/GQLComplexityPlugin';
import { AuthModule } from './auth/auth.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { UserEnvironmentsModule } from './user-environment/user-environments.module';
import { UserRequestModule } from './user-request/user-request.module';
import { UserHistoryModule } from './user-history/user-history.module';
import { subscriptionContextCookieParser, extractAccessTokenFromAuthRecords } from './auth/helper';
import { TeamModule } from './team/team.module';
import { TeamEnvironmentsModule } from './team-environments/team-environments.module';
import { TeamCollectionModule } from './team-collection/team-collection.module';
import { TeamRequestModule } from './team-request/team-request.module';
import { TeamInvitationModule } from './team-invitation/team-invitation.module';
import { AdminModule } from './admin/admin.module';
import { UserCollectionModule } from './user-collection/user-collection.module';
import { ShortcodeModule } from './shortcode/shortcode.module';
import { COOKIES_NOT_FOUND } from './errors';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InfraConfigModule } from './infra-config/infra-config.module';
import { loadInfraConfiguration } from './infra-config/helper';
import { MailerModule } from './mailer/mailer.module';
import { PosthogModule } from './posthog/posthog.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { AccessTokenModule } from './access-token/access-token.module';
import { UserLastActiveOnInterceptor } from './interceptors/user-last-active-on.interceptor';
import { InfraTokenModule } from './infra-token/infra-token.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [async () => loadInfraConfiguration()],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          buildSchemaOptions: {
            numberScalarMode: 'integer',
          },
          playground: configService.get('PRODUCTION') !== 'true',
          autoSchemaFile: true,
          installSubscriptionHandlers: true,
          subscriptions: {
            'subscriptions-transport-ws': {
              path: '/graphql',
              onConnect: (connectionParams, websocket) => {
                const websocketHeaders = websocket?.upgradeReq?.headers;

                try {
                  const accessToken = extractAccessTokenFromAuthRecords(connectionParams);
                  const authorization = `Bearer ${accessToken}`

                  return { headers: { ...websocketHeaders, authorization } };
                } catch (authError) {
                  const cookiesFromHeader = websocketHeaders?.cookie;
                  const cookies = cookiesFromHeader
                    ? subscriptionContextCookieParser(cookiesFromHeader)
                    : null;

                  if (!cookies) {
                    throw new HttpException(COOKIES_NOT_FOUND, 400, {
                      cause: new Error(COOKIES_NOT_FOUND),
                    });
                  }

                  return { headers: { ...websocketHeaders, cookies } };
                }
              }
            },
          },
          context: ({ req, res, connection }) => ({
            req,
            res,
            connection,
          }),
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => [
        {
          ttl: +configService.get('RATE_LIMIT_TTL'),
          limit: +configService.get('RATE_LIMIT_MAX'),
        },
      ],
    }),
    MailerModule.register(),
    UserModule,
    AuthModule.register(),
    AdminModule,
    UserSettingsModule,
    UserEnvironmentsModule,
    UserHistoryModule,
    UserRequestModule,
    TeamModule,
    TeamEnvironmentsModule,
    TeamCollectionModule,
    TeamRequestModule,
    TeamInvitationModule,
    UserCollectionModule,
    ShortcodeModule,
    InfraConfigModule,
    PosthogModule,
    ScheduleModule.forRoot(),
    HealthModule,
    AccessTokenModule,
    InfraTokenModule,
  ],
  providers: [
    GQLComplexityPlugin,
    { provide: 'APP_INTERCEPTOR', useClass: UserLastActiveOnInterceptor },
  ],
  controllers: [AppController],
})
export class AppModule {}
