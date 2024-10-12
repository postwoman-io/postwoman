import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as session from 'express-session';
import { emitGQLSchemaFile } from './gql-schema';
import { checkEnvironmentAuthProvider } from './utils';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { InfraTokensController } from './infra-token/infra-token.controller';
import { InfraTokenModule } from './infra-token/infra-token.module';

function setupSwagger(app) {
  const swaggerDocPath = '/api-docs';

  const config = new DocumentBuilder()
    .setTitle('Hoppscotch API Documentation')
    .setDescription('APIs for external integration')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'Bearer',
      },
      'infra-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [InfraTokenModule],
  });
  SwaggerModule.setup(swaggerDocPath, app, document, {
    swaggerOptions: { persistAuthorization: true, ignoreGlobalPrefix: true },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  console.log(`Running in production:  ${configService.get('PRODUCTION')}`);
  console.log(`Port: ${configService.get('PORT')}`);

  checkEnvironmentAuthProvider(
    configService.get('INFRA.VITE_ALLOWED_AUTH_PROVIDERS') ??
      configService.get('VITE_ALLOWED_AUTH_PROVIDERS'),
  );

  app.use(
    session({
      secret: configService.get('SESSION_SECRET'),
    }),
  );

  // Increase fil upload limit to 50MB
  app.use(
    json({
      limit: '100mb',
    }),
  );

if (configService.get('PRODUCTION') === 'false') { 
  console.log('Enabling CORS with development settings'); 
  app.enableCors({
    origin: configService.get('DEV_WHITELISTED_ORIGINS').split(','), 
    credentials: true,
  }); 
} else { 
  console.log('Enabling CORS with production settings'); 
  app.enableCors({
    origin: configService.get('PROD_WHITELISTED_ORIGINS'), 
    credentials: true,
  });
}

  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  await setupSwagger(app);

  await app.listen(configService.get('PORT') || 3170);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received');
    await app.close();
  });
}

if (!process.env.GENERATE_GQL_SCHEMA) {
  bootstrap();
} else {
  emitGQLSchemaFile();
}
