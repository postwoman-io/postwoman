import { AuthProvider } from 'src/auth/helper';
import {
  AUTH_PROVIDER_NOT_CONFIGURED,
  DATABASE_TABLE_NOT_EXIST,
  ENV_INVALID_DATA_ENCRYPTION_KEY,
} from 'src/errors';
import { PrismaService } from 'src/prisma/prisma.service';
import { InfraConfigEnum } from 'src/types/InfraConfig';
import { decrypt, encrypt, throwErr } from 'src/utils';
import { randomBytes } from 'crypto';
import { InfraConfig } from '@prisma/client';

export enum ServiceStatus {
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE',
}

type DefaultInfraConfig = {
  name: InfraConfigEnum;
  value: string;
  lastSyncedEnvFileValue: string;
  isEncrypted: boolean;
};

const AuthProviderConfigurations = {
  [AuthProvider.GOOGLE]: [
    InfraConfigEnum.GOOGLE_CLIENT_ID,
    InfraConfigEnum.GOOGLE_CLIENT_SECRET,
    InfraConfigEnum.GOOGLE_CALLBACK_URL,
    InfraConfigEnum.GOOGLE_SCOPE,
  ],
  [AuthProvider.GITHUB]: [
    InfraConfigEnum.GITHUB_CLIENT_ID,
    InfraConfigEnum.GITHUB_CLIENT_SECRET,
    InfraConfigEnum.GITHUB_CALLBACK_URL,
    InfraConfigEnum.GITHUB_SCOPE,
  ],
  [AuthProvider.MICROSOFT]: [
    InfraConfigEnum.MICROSOFT_CLIENT_ID,
    InfraConfigEnum.MICROSOFT_CLIENT_SECRET,
    InfraConfigEnum.MICROSOFT_CALLBACK_URL,
    InfraConfigEnum.MICROSOFT_SCOPE,
    InfraConfigEnum.MICROSOFT_TENANT,
  ],
  [AuthProvider.EMAIL]:
    process.env.MAILER_USE_CUSTOM_CONFIGS === 'true'
      ? [
          InfraConfigEnum.MAILER_SMTP_HOST,
          InfraConfigEnum.MAILER_SMTP_PORT,
          InfraConfigEnum.MAILER_SMTP_SECURE,
          InfraConfigEnum.MAILER_SMTP_USER,
          InfraConfigEnum.MAILER_SMTP_PASSWORD,
          InfraConfigEnum.MAILER_TLS_REJECT_UNAUTHORIZED,
          InfraConfigEnum.MAILER_ADDRESS_FROM,
        ]
      : [InfraConfigEnum.MAILER_SMTP_URL, InfraConfigEnum.MAILER_ADDRESS_FROM],
};

/**
 * Load environment variables from the database and set them in the process
 *
 * @Description Fetch the 'infra_config' table from the database and return it as an object
 * (ConfigModule will set the environment variables in the process)
 */
export async function loadInfraConfiguration() {
  try {
    const prisma = new PrismaService();

    const infraConfigs = await prisma.infraConfig.findMany();

    let environmentObject: Record<string, any> = {};
    infraConfigs.forEach((infraConfig) => {
      if (infraConfig.isEncrypted) {
        environmentObject[infraConfig.name] = decrypt(infraConfig.value);
      } else {
        environmentObject[infraConfig.name] = infraConfig.value;
      }
    });

    return { INFRA: environmentObject };
  } catch (error) {
    if (error.code === 'ERR_OSSL_BAD_DECRYPT')
      throw new Error(ENV_INVALID_DATA_ENCRYPTION_KEY);

    // Prisma throw error if 'Can't reach at database server' OR 'Table does not exist'
    // Reason for not throwing error is, we want successful build during 'postinstall' and generate dist files
    return { INFRA: {} };
  }
}

/**
 * Read the default values from .env file and return them as an array
 * @returns Array of default infra configs
 */
export async function getDefaultInfraConfigs(): Promise<DefaultInfraConfig[]> {
  const prisma = new PrismaService();

  // Prepare rows for 'infra_config' table with default values (from .env) for each 'name'
  const configuredSSOProviders = getConfiguredSSOProvidersFromEnvFile();
  const generatedAnalyticsUserId = generateAnalyticsUserId();

  const infraConfigDefaultObjs: DefaultInfraConfig[] = [
    {
      name: InfraConfigEnum.MAILER_SMTP_ENABLE,
      value: process.env.MAILER_SMTP_ENABLE ?? 'true',
      lastSyncedEnvFileValue: process.env.MAILER_SMTP_ENABLE ?? 'true',
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_USE_CUSTOM_CONFIGS,
      value: process.env.MAILER_USE_CUSTOM_CONFIGS ?? 'false',
      lastSyncedEnvFileValue: process.env.MAILER_USE_CUSTOM_CONFIGS ?? 'false',
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_URL,
      value: encrypt(process.env.MAILER_SMTP_URL),
      lastSyncedEnvFileValue: encrypt(process.env.MAILER_SMTP_URL),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.MAILER_ADDRESS_FROM,
      value: process.env.MAILER_ADDRESS_FROM,
      lastSyncedEnvFileValue: process.env.MAILER_ADDRESS_FROM,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_HOST,
      value: process.env.MAILER_SMTP_HOST,
      lastSyncedEnvFileValue: process.env.MAILER_SMTP_HOST,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_PORT,
      value: process.env.MAILER_SMTP_PORT,
      lastSyncedEnvFileValue: process.env.MAILER_SMTP_PORT,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_SECURE,
      value: process.env.MAILER_SMTP_SECURE,
      lastSyncedEnvFileValue: process.env.MAILER_SMTP_SECURE,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_USER,
      value: process.env.MAILER_SMTP_USER,
      lastSyncedEnvFileValue: process.env.MAILER_SMTP_USER,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MAILER_SMTP_PASSWORD,
      value: encrypt(process.env.MAILER_SMTP_PASSWORD),
      lastSyncedEnvFileValue: encrypt(process.env.MAILER_SMTP_PASSWORD),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.MAILER_TLS_REJECT_UNAUTHORIZED,
      value: process.env.MAILER_TLS_REJECT_UNAUTHORIZED,
      lastSyncedEnvFileValue: process.env.MAILER_TLS_REJECT_UNAUTHORIZED,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.GOOGLE_CLIENT_ID,
      value: encrypt(process.env.GOOGLE_CLIENT_ID),
      lastSyncedEnvFileValue: encrypt(process.env.GOOGLE_CLIENT_ID),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.GOOGLE_CLIENT_SECRET,
      value: encrypt(process.env.GOOGLE_CLIENT_SECRET),
      lastSyncedEnvFileValue: encrypt(process.env.GOOGLE_CLIENT_SECRET),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.GOOGLE_CALLBACK_URL,
      value: process.env.GOOGLE_CALLBACK_URL,
      lastSyncedEnvFileValue: process.env.GOOGLE_CALLBACK_URL,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.GOOGLE_SCOPE,
      value: process.env.GOOGLE_SCOPE,
      lastSyncedEnvFileValue: process.env.GOOGLE_SCOPE,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.GITHUB_CLIENT_ID,
      value: encrypt(process.env.GITHUB_CLIENT_ID),
      lastSyncedEnvFileValue: encrypt(process.env.GITHUB_CLIENT_ID),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.GITHUB_CLIENT_SECRET,
      value: encrypt(process.env.GITHUB_CLIENT_SECRET),
      lastSyncedEnvFileValue: encrypt(process.env.GITHUB_CLIENT_SECRET),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.GITHUB_CALLBACK_URL,
      value: process.env.GITHUB_CALLBACK_URL,
      lastSyncedEnvFileValue: process.env.GITHUB_CALLBACK_URL,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.GITHUB_SCOPE,
      value: process.env.GITHUB_SCOPE,
      lastSyncedEnvFileValue: process.env.GITHUB_SCOPE,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MICROSOFT_CLIENT_ID,
      value: encrypt(process.env.MICROSOFT_CLIENT_ID),
      lastSyncedEnvFileValue: encrypt(process.env.MICROSOFT_CLIENT_ID),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.MICROSOFT_CLIENT_SECRET,
      value: encrypt(process.env.MICROSOFT_CLIENT_SECRET),
      lastSyncedEnvFileValue: encrypt(process.env.MICROSOFT_CLIENT_SECRET),
      isEncrypted: true,
    },
    {
      name: InfraConfigEnum.MICROSOFT_CALLBACK_URL,
      value: process.env.MICROSOFT_CALLBACK_URL,
      lastSyncedEnvFileValue: process.env.MICROSOFT_CALLBACK_URL,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MICROSOFT_SCOPE,
      value: process.env.MICROSOFT_SCOPE,
      lastSyncedEnvFileValue: process.env.MICROSOFT_SCOPE,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.MICROSOFT_TENANT,
      value: process.env.MICROSOFT_TENANT,
      lastSyncedEnvFileValue: process.env.MICROSOFT_TENANT,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.VITE_ALLOWED_AUTH_PROVIDERS,
      value: configuredSSOProviders,
      lastSyncedEnvFileValue: configuredSSOProviders,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.ALLOW_ANALYTICS_COLLECTION,
      value: false.toString(),
      lastSyncedEnvFileValue: null,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.ANALYTICS_USER_ID,
      value: generatedAnalyticsUserId,
      lastSyncedEnvFileValue: null,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.IS_FIRST_TIME_INFRA_SETUP,
      value: (await prisma.infraConfig.count()) === 0 ? 'true' : 'false',
      lastSyncedEnvFileValue: null,
      isEncrypted: false,
    },
    {
      name: InfraConfigEnum.USER_HISTORY_STORE_ENABLED,
      value: 'true',
      lastSyncedEnvFileValue: null,
      isEncrypted: false,
    },
  ];

  return infraConfigDefaultObjs;
}

/**
 * Get the missing entries in the 'infra_config' table
 * @returns Array of InfraConfig
 */
export async function getMissingInfraConfigEntries(
  infraConfigDefaultObjs: DefaultInfraConfig[],
) {
  const prisma = new PrismaService();
  const dbInfraConfigs = await prisma.infraConfig.findMany();

  const missingEntries = infraConfigDefaultObjs.filter(
    (config) =>
      !dbInfraConfigs.some((dbConfig) => dbConfig.name === config.name),
  );

  return missingEntries;
}

/**
 * Get the encryption required entries in the 'infra_config' table
 * @returns Array of InfraConfig
 */
export async function getEncryptionRequiredInfraConfigEntries(
  infraConfigDefaultObjs: DefaultInfraConfig[],
) {
  const prisma = new PrismaService();
  const dbInfraConfigs = await prisma.infraConfig.findMany();

  const requiredEncryption = dbInfraConfigs.filter((dbConfig) => {
    const defaultConfig = infraConfigDefaultObjs.find(
      (config) => config.name === dbConfig.name,
    );
    if (!defaultConfig) return false;
    return defaultConfig.isEncrypted !== dbConfig.isEncrypted;
  });

  return requiredEncryption;
}

/**
 * Sync the 'infra_config' table with .env file
 * @returns Array of InfraConfig
 */
export async function syncInfraConfigWithEnvFile() {
  const prisma = new PrismaService();
  const dbInfraConfigs = await prisma.infraConfig.findMany();

  const updateRequiredObjs: (Partial<InfraConfig> & { id: string })[] = [];

  for (const dbConfig of dbInfraConfigs) {
    let envValue = process.env[dbConfig.name];

    // lastSyncedEnvFileValue null check for backward compatibility from 2024.10.2 and below
    if (!dbConfig.lastSyncedEnvFileValue && envValue) {
      const configValue = dbConfig.isEncrypted ? encrypt(envValue) : envValue;
      updateRequiredObjs.push({
        id: dbConfig.id,
        value: dbConfig.value === null ? configValue : undefined,
        lastSyncedEnvFileValue: configValue,
      });
      continue;
    }

    // If the value in the database is different from the value in the .env file, means the value in the .env file has been updated
    const rawLastSyncedEnvFileValue = dbConfig.isEncrypted
      ? decrypt(dbConfig.lastSyncedEnvFileValue)
      : dbConfig.lastSyncedEnvFileValue;

    if (rawLastSyncedEnvFileValue != envValue) {
      const configValue = dbConfig.isEncrypted ? encrypt(envValue) : envValue;
      updateRequiredObjs.push({
        id: dbConfig.id,
        value: configValue ?? null,
        lastSyncedEnvFileValue: configValue ?? null,
      });
    }
  }

  return updateRequiredObjs;
}

/**
 * Verify if 'infra_config' table is loaded with all entries
 * @returns boolean
 */
export async function isInfraConfigTablePopulated(): Promise<boolean> {
  try {
    const defaultInfraConfigs = await getDefaultInfraConfigs();
    const propsRemainingToInsert =
      await getMissingInfraConfigEntries(defaultInfraConfigs);

    if (propsRemainingToInsert.length > 0) {
      console.log(
        'Infra Config table is not populated with all entries. Populating now...',
      );
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Stop the app after 5 seconds
 * (Docker will re-start the app)
 */
export function stopApp() {
  console.log('Stopping app in 5 seconds...');

  setTimeout(() => {
    console.log('Stopping app now...');
    process.kill(process.pid, 'SIGTERM');
  }, 5000);
}

/**
 * Get the configured SSO providers from .env file
 * @description This function verify if the required parameters for each SSO provider are configured in .env file. Usage on first time setup and reset.
 * @returns Array of configured SSO providers
 */
export function getConfiguredSSOProvidersFromEnvFile() {
  const allowedAuthProviders: string[] =
    process.env.VITE_ALLOWED_AUTH_PROVIDERS.split(',');
  let configuredAuthProviders: string[] = [];

  const addProviderIfConfigured = (provider) => {
    const configParameters: string[] = AuthProviderConfigurations[provider];

    const isConfigured = configParameters.every((configParameter) => {
      return process.env[configParameter];
    });
    if (isConfigured) configuredAuthProviders.push(provider);
  };

  allowedAuthProviders.forEach((provider) => addProviderIfConfigured(provider));

  if (configuredAuthProviders.length === 0) {
    throwErr(AUTH_PROVIDER_NOT_CONFIGURED);
  } else if (allowedAuthProviders.length !== configuredAuthProviders.length) {
    const unConfiguredAuthProviders = allowedAuthProviders.filter(
      (provider) => {
        return !configuredAuthProviders.includes(provider);
      },
    );
    console.log(
      `${unConfiguredAuthProviders.join(
        ',',
      )} SSO auth provider(s) are not configured properly in .env file. Do configure them from Admin Dashboard.`,
    );
  }

  return configuredAuthProviders.join(',');
}

/**
 * Get the configured SSO providers from 'infra_config' table.
 * @description Usage every time the app starts by AuthModule to initiate Strategies.
 * @returns Array of configured SSO providers
 */
export async function getConfiguredSSOProvidersFromInfraConfig() {
  const env = await loadInfraConfiguration();

  const allowedAuthProviders: string[] =
    env['INFRA'].VITE_ALLOWED_AUTH_PROVIDERS.split(',');
  let configuredAuthProviders: string[] = [];

  const addProviderIfConfigured = (provider) => {
    const configParameters: string[] = AuthProviderConfigurations[provider];

    const isConfigured = configParameters.every((configParameter) => {
      return env['INFRA'][configParameter];
    });
    if (isConfigured) configuredAuthProviders.push(provider);
  };

  allowedAuthProviders.forEach((provider) => addProviderIfConfigured(provider));

  if (configuredAuthProviders.length === 0) {
    return '';
  } else if (allowedAuthProviders.length !== configuredAuthProviders.length) {
    const prisma = new PrismaService();
    await prisma.infraConfig.update({
      where: { name: InfraConfigEnum.VITE_ALLOWED_AUTH_PROVIDERS },
      data: { value: configuredAuthProviders.join(',') },
    });
    stopApp();
    console.log(
      `${configuredAuthProviders.join(',')} SSO auth provider(s) are configured properly. To enable other SSO providers, configure them from Admin Dashboard.`,
    );
  }

  return configuredAuthProviders.join(',');
}

/**
 * Generate a hashed valued for analytics
 * @returns Generated hashed value
 */
export function generateAnalyticsUserId() {
  const hashedUserID = randomBytes(20).toString('hex');
  return hashedUserID;
}
