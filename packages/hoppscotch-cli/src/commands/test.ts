import fs from "fs";
import { isSafeInteger } from "lodash-es";
import Papa from "papaparse";
import path from "path";

import { handleError } from "../handlers/error";
import { parseDelayOption } from "../options/test/delay";
import { parseEnvsData } from "../options/test/env";
import { IterationDataItem } from "../types/collections";
import { TestCmdEnvironmentOptions, TestCmdOptions } from "../types/commands";
import { error } from "../types/errors";
import { HoppEnvs } from "../types/request";
import { isHoppCLIError } from "../utils/checks";
import {
  collectionsRunner,
  collectionsRunnerExit,
  collectionsRunnerResult,
} from "../utils/collections";
import { parseCollectionData } from "../utils/mutators";

export const test = (pathOrId: string, options: TestCmdOptions) => async () => {
  try {
    const { delay, env, iterationCount, iterationData, reporterJunit } =
      options;

    if (
      iterationCount !== undefined &&
      (iterationCount < 1 || !isSafeInteger(iterationCount))
    ) {
      throw error({
        code: "INVALID_ARGUMENT",
        data: "The value must be a positive integer",
      });
    }

    const resolvedDelay = delay ? parseDelayOption(delay) : 0;

    const envs = env
      ? await parseEnvsData(options as TestCmdEnvironmentOptions)
      : <HoppEnvs>{ global: [], selected: [] };

    let parsedIterationData: unknown[] | null = null;
    let transformedIterationData: IterationDataItem[][] | undefined;

    const collections = await parseCollectionData(pathOrId, options);

    if (iterationData) {
      // Check file existence
      if (!fs.existsSync(iterationData)) {
        throw error({ code: "FILE_NOT_FOUND", path: iterationData });
      }

      // Check the file extension
      if (path.extname(iterationData) !== ".csv") {
        throw error({
          code: "INVALID_DATA_FILE_TYPE",
          data: iterationData,
        });
      }

      const csvData = fs.readFileSync(iterationData, "utf8");
      parsedIterationData = Papa.parse(csvData, { header: true }).data;

      // Transform data into the desired format
      transformedIterationData = parsedIterationData
        .map((item) => {
          const iterationDataItem = item as Record<string, unknown>;
          const keys = Object.keys(iterationDataItem);

          return (
            keys
              // Ignore keys with empty string values
              .filter((key) => iterationDataItem[key] !== "")
              .map(
                (key) =>
                  <IterationDataItem>{
                    key: key,
                    value: iterationDataItem[key],
                    secret: false,
                  }
              )
          );
        })
        // Ignore items that result in an empty array
        .filter((item) => item.length > 0);
    }

    const report = await collectionsRunner({
      collections,
      envs,
      delay: resolvedDelay,
      iterationData: transformedIterationData,
      iterationCount,
    });
    const hasSucceeded = collectionsRunnerResult(report, reporterJunit);

    collectionsRunnerExit(hasSucceeded);
  } catch (e) {
    if (isHoppCLIError(e)) {
      handleError(e);
      process.exit(1);
    } else throw e;
  }
};
