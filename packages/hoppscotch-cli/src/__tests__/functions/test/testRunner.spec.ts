import { TestResponse } from "@hoppscotch/js-sandbox";
import * as E from "fp-ts/Either";
import { TestRunnerRes } from "../../../types/response";
import { HoppCLIError } from "../../../types/errors";
import { getTestMetrics, testRunner } from "../../../utils/test";
import { HoppEnvs } from "../../../types/request";

import "@relmify/jest-fp-ts";
import { describe, it, expect, beforeAll } from "vitest"; // Importing from vitest

const SAMPLE_ENVS: HoppEnvs = {
  global: [],
  selected: [
    {
      key: "DEVBLIN",
      value: "set-by-devblin",
    },
  ],
};
const SAMPLE_RESPONSE: TestResponse = {
  status: 200,
  headers: [],
  body: {},
};

describe("testRunner", () => {
  let SUCCESS_TEST_RUNNER_RES: E.Either<HoppCLIError, TestRunnerRes>,
    FAILURE_TEST_RUNNER_RES: E.Either<HoppCLIError, TestRunnerRes>;

  beforeAll(async () => {
    SUCCESS_TEST_RUNNER_RES = await testRunner({
      testScript: `
			// Check status code is 200
			pw.test("Status code is 200", ()=> {
					pw.expect(pw.response.status).toBe(200);
			});

			// Check JSON response property
			pw.test("Check JSON response property", ()=> {
					pw.expect(pw.response.body).toBeType("string")
					pw.expect(pw.response.body).toBe("body");
			});
			`,
      envs: SAMPLE_ENVS,
      response: SAMPLE_RESPONSE,
    })();

    FAILURE_TEST_RUNNER_RES = await testRunner({
      testScript: "a",
      envs: SAMPLE_ENVS,
      response: SAMPLE_RESPONSE,
    })();
  });

  it("Should have 2 failed, 1 passed test-cases; 1 failed, 1 passed test-suites.", () => {
    expect(SUCCESS_TEST_RUNNER_RES).toBeRight();

    if (E.isRight(SUCCESS_TEST_RUNNER_RES)) {
      const { duration, testsReport } = SUCCESS_TEST_RUNNER_RES.right;
      const { tests, testSuites } = getTestMetrics(testsReport, duration, []);

      expect(tests.failed).toStrictEqual(2);
      expect(tests.passed).toStrictEqual(1);
      expect(testSuites.failed).toStrictEqual(1);
      expect(testSuites.passed).toStrictEqual(1);
    }
  });

  it("Should fail to execute with test-script-error.", () => {
    expect(FAILURE_TEST_RUNNER_RES).toEqualLeft(<HoppCLIError>{
      code: "TEST_SCRIPT_ERROR",
    });
  });
});
