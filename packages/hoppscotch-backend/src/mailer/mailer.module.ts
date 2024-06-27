import { Global, Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailerService } from './mailer.service';
import { throwErr } from 'src/utils';
import {
  MAILER_FROM_ADDRESS_UNDEFINED,
  MAILER_SMTP_URL_UNDEFINED,
} from 'src/errors';
import { ConfigService } from '@nestjs/config';
import { loadInfraConfiguration } from 'src/infra-config/helper';

@Global()
@Module({
  imports: [],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {
  static async register() {
    const env = await loadInfraConfiguration();

    let mailerSmtpUrl = env.INFRA.MAILER_SMTP_URL;
    let mailerAddressFrom = env.INFRA.MAILER_ADDRESS_FROM;

    if (!env.INFRA.MAILER_SMTP_URL || !env.INFRA.MAILER_ADDRESS_FROM) {
      const config = new ConfigService();
      mailerSmtpUrl = config.get('MAILER_SMTP_URL');
      mailerAddressFrom = config.get('MAILER_ADDRESS_FROM');
    }

    return {
      module: MailerModule,
      imports: [
        NestMailerModule.forRootAsync({
          useFactory: () => ({
            transport: {
              host: process.env.SMTP_DOMAIN,
              port: process.env.SMTP_PORT,
              secure: process.env.SMTP_SECURE, // Use `true` for port 465, `false` for all other ports
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              },
              tls: {
                rejectUnauthorized: process.env.SMTP_REJECT_WITHOUT_VALID_CERT, // If not false it will reject TLS with invalid cert
              },
            },
            defaults: {
              from:
                process.env.MAILER_ADDRESS_FROM ??
                throwErr(MAILER_FROM_ADDRESS_UNDEFINED),
            },
            template: {
              dir: __dirname + '/templates',
              adapter: new HandlebarsAdapter(),
            },
          }),
        }),
      ],
    };
  }
}
