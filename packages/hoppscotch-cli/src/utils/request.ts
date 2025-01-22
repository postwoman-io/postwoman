import {
  Environment,
  HoppCollection,
  HoppRESTRequest,
  RESTReqSchemaVersion,
} from "@hoppscotch/data";
import axios, { Method } from "axios";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";
import * as S from "fp-ts/string";
import { hrtime } from "process";
import { URL } from "url";
import { EffectiveHoppRESTRequest, RequestConfig } from "../interfaces/request";
import { RequestRunnerResponse } from "../interfaces/response";
import { HoppCLIError, error } from "../types/errors";
import {
  HoppEnvs,
  ProcessRequestParams,
  RequestReport,
} from "../types/request";
import { RequestMetrics } from "../types/response";
import { responseErrors } from "./constants";
import {
  printPreRequestRunner,
  printRequestRunner,
  printTestRunner,
} from "./display";
import { getDurationInSeconds, getMetaDataPairs } from "./getters";
import { preRequestScriptRunner } from "./pre-request";
import { getTestScriptParams, hasFailedTestCases, testRunner } from "./test";

/**
 * Processes given variable, which includes checking for secret variables
 * and getting value from system environment
 * @param variable Variable to be processed
 * @returns Updated variable with value from system environment
 */
const processVariables = (variable: Environment["variables"][number]) => {
  if (variable.secret) {
    return {
      ...variable,
      value:
        "value" in variable ? variable.value : process.env[variable.key] || "",
    };
  }
  return variable;
};

/**
 * Processes given envs, which includes processing each variable in global
 * and selected envs
 * @param envs Global + selected envs used by requests with in collection
 * @returns Processed envs with each variable processed
 */
const processEnvs = (envs: Partial<HoppEnvs>) => {
  // This can take the shape `{ global: undefined, selected: undefined }` when no environment is supplied
  const processedEnvs = {
    global: envs.global?.map(processVariables) ?? [],
    selected: envs.selected?.map(processVariables) ?? [],
  };

  return processedEnvs;
};

/**
 * Transforms given request data to request-config used by request-runner to
 * perform HTTP request.
 * @param req Effective request data with parsed ENVs.
 * @returns Request config with data realted to HTTP request.
 */
export const createRequest = (req: EffectiveHoppRESTRequest): RequestConfig => {
  const config: RequestConfig = {
    displayUrl: req.effectiveFinalDisplayURL,
  };

  const { finalBody, finalEndpoint, finalHeaders, finalParams } = getRequest;

  const reqParams = finalParams(req);
  const reqHeaders = finalHeaders(req);

  config.url = finalEndpoint(req);
  config.method = req.method as Method;
  config.params = getMetaDataPairs(reqParams);
  config.headers = getMetaDataPairs(reqHeaders);

  config.data = finalBody(req);

  return config;
};

/**
 * Performs http request using axios with given requestConfig axios
 * parameters.
 * @param requestConfig The axios request config.
 * @returns If successfully ran, we get runner-response including HTTP response data.
 * Else, HoppCLIError with appropriate error code & data.
 */
export const requestRunner =
  (
    requestConfig: RequestConfig
  ): TE.TaskEither<HoppCLIError, RequestRunnerResponse> =>
  async () => {
    const start = hrtime();

    try {
      // NOTE: Temporary parsing check for request endpoint.
      requestConfig.url = new URL(requestConfig.url ?? "").toString();

      let status: number;
      const baseResponse = await axios(requestConfig);
      const { config } = baseResponse;
      // PR-COMMENT: type error
      const runnerResponse: RequestRunnerResponse = {
        ...baseResponse,
        endpoint: getRequest.endpoint(config.url),
        method: getRequest.method(config.method),
        body: baseResponse.data,
        duration: 0,
      };

      const end = hrtime(start);
      const duration = getDurationInSeconds(end);
      runnerResponse.duration = duration;

      return E.right(runnerResponse);
    } catch (e) {
      let status: number;
      const runnerResponse: RequestRunnerResponse = {
        endpoint: "",
        method: "GET",
        body: {},
        statusText: responseErrors[400],
        status: 400,
        headers: [],
        duration: 0,
      };

      if (axios.isAxiosError(e)) {
        runnerResponse.endpoint = e.config?.url ?? "";

        if (e.response) {
          const { data, status, statusText, headers } = e.response;
          runnerResponse.body = data;
          runnerResponse.statusText = statusText;
          runnerResponse.status = status;
          runnerResponse.headers = headers;
        } else if (e.request) {
          return E.left(error({ code: "REQUEST_ERROR", data: E.toError(e) }));
        }

        const end = hrtime(start);
        const duration = getDurationInSeconds(end);
        runnerResponse.duration = duration;

        return E.right(runnerResponse);
      }

      return E.left(error({ code: "REQUEST_ERROR", data: E.toError(e) }));
    }
  };

/**
 * Getter object methods for request-runner.
 */
const getRequest = {
  method: (value: string | undefined) =>
    value ? (value.toUpperCase() as Method) : "GET",

  endpoint: (value: string | undefined): string => (value ? value : ""),

  finalEndpoint: (req: EffectiveHoppRESTRequest): string =>
    S.isEmpty(req.effectiveFinalURL) ? req.endpoint : req.effectiveFinalURL,

  finalHeaders: (req: EffectiveHoppRESTRequest) =>
    A.isNonEmpty(req.effectiveFinalHeaders)
      ? req.effectiveFinalHeaders
      : req.headers,

  finalParams: (req: EffectiveHoppRESTRequest) =>
    A.isNonEmpty(req.effectiveFinalParams)
      ? req.effectiveFinalParams
      : req.params,

  finalBody: (req: EffectiveHoppRESTRequest) =>
    req.effectiveFinalBody ? req.effectiveFinalBody : req.body.body,
};

/**
 * Processes given request, which includes executing pre-request-script,
 * running request & executing test-script.
 * @param request Request to be processed.
 * @param envs Global + selected envs used by requests with in collection.
 * @returns Updated envs and current request's report.
 */
export const processRequest =
  (
    params: ProcessRequestParams
  ): T.Task<{ envs: HoppEnvs; report: RequestReport }> =>
  async () => {
    const { envs, path, request, delay } = params;

    // Initialising updatedEnvs with given parameter envs, will eventually get updated.
    const result = {
      envs: <HoppEnvs>envs,
      report: <RequestReport>{},
    };

    // Initial value for current request's report with default values for properties.
    const report: RequestReport = {
      path: path,
      tests: [],
      errors: [],
      result: true,
      duration: { test: 0, request: 0, preRequest: 0 },
    };

    // Initial value for effective-request with default values for properties.
    let effectiveRequest = <EffectiveHoppRESTRequest>{
      ...request,
      effectiveFinalBody: null,
      effectiveFinalHeaders: [],
      effectiveFinalParams: [],
      effectiveFinalURL: "",
    };
    let updatedEnvs = <HoppEnvs>{};

    // Fetch values for secret environment variables from system environment
    const processedEnvs = processEnvs(envs);

    // Executing pre-request-script
    const preRequestRes = await preRequestScriptRunner(
      request,
      processedEnvs
    )();
    if (E.isLeft(preRequestRes)) {
      printPreRequestRunner.fail();

      // Updating report for errors & current result
      report.errors.push(preRequestRes.left);

      // Ensure, the CLI fails with a non-zero exit code if there are any errors
      report.result = false;
    } else {
      // Updating effective-request and consuming updated envs after pre-request script execution
      ({ effectiveRequest, updatedEnvs } = preRequestRes.right);
    }

    // Creating request-config for request-runner.
    const requestConfig = createRequest(effectiveRequest);

    printRequestRunner.start(requestConfig);

    // Default value for request-runner's response.
    let _requestRunnerRes: RequestRunnerResponse = {
      endpoint: "",
      method: "GET",
      headers: [],
      status: 400,
      statusText: "",
      body: Object(null),
      duration: 0,
    };
    // Executing request-runner.
    const requestRunnerRes = await delayPromiseFunction<
      E.Either<HoppCLIError, RequestRunnerResponse>
    >(requestRunner(requestConfig), delay);
    if (E.isLeft(requestRunnerRes)) {
      // Updating report for errors & current result
      report.errors.push(requestRunnerRes.left);

      // Ensure, the CLI fails with a non-zero exit code if there are any errors
      report.result = false;

      printRequestRunner.fail();
    } else {
      _requestRunnerRes = requestRunnerRes.right;
      report.duration.request = _requestRunnerRes.duration;
      printRequestRunner.success(_requestRunnerRes);
    }

    // Extracting test-script-runner parameters.
    const testScriptParams = getTestScriptParams(
      _requestRunnerRes,
      request,
      updatedEnvs
    );

    // Executing test-runner.
    const testRunnerRes = await testRunner(testScriptParams)();
    if (E.isLeft(testRunnerRes)) {
      printTestRunner.fail();

      // Updating report with current errors & result.
      report.errors.push(testRunnerRes.left);

      // Ensure, the CLI fails with a non-zero exit code if there are any errors
      report.result = false;
    } else {
      const { envs, testsReport, duration } = testRunnerRes.right;
      const _hasFailedTestCases = hasFailedTestCases(testsReport);

      // Updating report with current tests, result and duration.
      report.tests = testsReport;
      report.result = report.result && _hasFailedTestCases;
      report.duration.test = duration;

      // Updating resulting envs from test-runner.
      result.envs = envs;

      // Printing tests-report, when test-runner executes successfully.
      printTestRunner.success(testsReport, duration);
    }

    result.report = report;

    return result;
  };

/**
 * Generates new request without any missing/invalid data using
 * current request object.
 * @param request Hopp rest request to be processed.
 * @returns Updated request object free of invalid/missing data.
 */
export const preProcessRequest = (
  request: HoppRESTRequest,
  collection: HoppCollection
): HoppRESTRequest => {
  const tempRequest = Object.assign({}, request);
  const { headers: parentHeaders, auth: parentAuth } = collection;

  if (!tempRequest.v) {
    tempRequest.v = RESTReqSchemaVersion;
  }
  if (!tempRequest.name) {
    tempRequest.name = "Untitled Request";
  }
  if (!tempRequest.method) {
    tempRequest.method = "GET";
  }
  if (!tempRequest.endpoint) {
    tempRequest.endpoint = "";
  }
  if (!tempRequest.params) {
    tempRequest.params = [];
  }

  if (parentHeaders?.length) {
    // Filter out header entries present in the parent (folder/collection) under the same name
    // This ensures the child headers take precedence over the parent headers
    const filteredEntries = parentHeaders.filter((parentHeaderEntries) => {
      return !tempRequest.headers.some(
        (reqHeaderEntries) => reqHeaderEntries.key === parentHeaderEntries.key
      );
    });
    tempRequest.headers.push(...filteredEntries);
  } else if (!tempRequest.headers) {
    tempRequest.headers = [];
  }

  if (!tempRequest.preRequestScript) {
    tempRequest.preRequestScript = "";
  }
  if (!tempRequest.testScript) {
    tempRequest.testScript = "";
  }

  if (tempRequest.auth?.authType === "inherit") {
    tempRequest.auth = parentAuth;
  } else if (!tempRequest.auth) {
    tempRequest.auth = { authActive: false, authType: "none" };
  }

  if (!tempRequest.body) {
    tempRequest.body = { contentType: null, body: null };
  }
  return tempRequest;
};

/**
 * Get request-metrics object (stats+duration) based on existence of REQUEST_ERROR code
 * in hopp-errors list.
 * @param errors List of errors to check for REQUEST_ERROR.
 * @param duration Time taken (in seconds) to execute the request.
 * @returns Object containing details of request's execution stats i.e., failed/passed
 * data and duration.
 */
export const getRequestMetrics = (
  errors: HoppCLIError[],
  duration: number
): RequestMetrics =>
  pipe(
    errors,
    A.some(({ code }) => code === "REQUEST_ERROR"),
    (hasReqErrors) =>
      hasReqErrors ? { failed: 1, passed: 0 } : { failed: 0, passed: 1 },
    (requests) => <RequestMetrics>{ requests, duration }
  );

/**
 * A function to execute promises with specific delay in milliseconds.
 * @param func Function with promise with return type T.
 * @param delay TIme in milliseconds to delay function.
 * @returns Promise of type same as func.
 */
export const delayPromiseFunction = <T>(
  func: () => Promise<T>,
  delay: number
): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(func()), delay));
