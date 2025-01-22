import { Environment, NonSecretEnvironment } from "@hoppscotch/data";
import { entityReference } from "verzod";
import { z } from "zod";

import { TestCmdEnvironmentOptions } from "../../types/commands";
import { error } from "../../types/errors";
import {
  HoppEnvKeyPairObject,
  HoppEnvPair,
  HoppEnvs,
} from "../../types/request";
import { getResourceContents } from "../../utils/getters";

/**
 * Parses environment data from a given path or ID and returns the data conforming to the latest version of the `Environment` schema.
 *
 * @param {TestCmdEnvironmentOptions} options Supplied values for CLI flags.
 * @param {string} options.env Path of the environment `.json` file to be parsed.
 * @param {string} [options.token] Personal access token to fetch workspace environments.
 * @param {string} [options.server] server URL for SH instance.
 * @returns {Promise<HoppEnvs>} A promise that resolves to the parsed environment object with global and selected environments.
 */
export async function parseEnvsData(options: TestCmdEnvironmentOptions) {
  const { env: pathOrId, token: accessToken, server: serverUrl } = options;

  const contents = await getResourceContents({
    pathOrId,
    accessToken,
    serverUrl,
    resourceType: "environment",
  });

  const envPairs: Array<HoppEnvPair | Record<string, string>> = [];

  // The legacy key-value pair format that is still supported
  const HoppEnvKeyPairResult = HoppEnvKeyPairObject.safeParse(contents);

  // Shape of the single environment export object that is exported from the app
  const HoppEnvExportObjectResult = Environment.safeParse(contents);

  // Shape of the bulk environment export object that is exported from the app
  const HoppBulkEnvExportObjectResult = z
    .array(entityReference(Environment))
    .safeParse(contents);

  // CLI doesnt support bulk environments export
  // Hence we check for this case and throw an error if it matches the format
  if (HoppBulkEnvExportObjectResult.success) {
    throw error({ code: "BULK_ENV_FILE", path: pathOrId, data: error });
  }

  //  Checks if the environment file is of the correct format
  // If it doesnt match either of them, we throw an error
  if (
    !HoppEnvKeyPairResult.success &&
    HoppEnvExportObjectResult.type === "err"
  ) {
    throw error({ code: "MALFORMED_ENV_FILE", path: pathOrId, data: error });
  }

  if (HoppEnvKeyPairResult.success) {
    for (const [key, value] of Object.entries(HoppEnvKeyPairResult.data)) {
      envPairs.push({ key, value, secret: false });
    }
  } else if (HoppEnvExportObjectResult.type === "ok") {
    // Original environment variables from the supplied export file
    const originalEnvVariables = (contents as NonSecretEnvironment).variables;

    // Above environment variables conforming to the latest schema
    // `value` fields if specified will be omitted for secret environment variables
    const migratedEnvVariables = HoppEnvExportObjectResult.value.variables;

    // The values supplied for secret environment variables have to be considered in the CLI
    // For each secret environment variable, include the value in case supplied
    const resolvedEnvVariables = migratedEnvVariables.map((variable, idx) => {
      if (variable.secret && originalEnvVariables[idx].value) {
        return {
          ...variable,
          value: originalEnvVariables[idx].value,
        };
      }

      return variable;
    });

    envPairs.push(...resolvedEnvVariables);
  }

  return <HoppEnvs>{ global: [], selected: envPairs };
}
