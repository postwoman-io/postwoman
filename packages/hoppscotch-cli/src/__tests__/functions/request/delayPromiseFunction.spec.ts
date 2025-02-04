import { hrtime } from "process";
import { describe, it, expect, beforeEach } from "vitest"; // Import Vitest functions
import { getDurationInSeconds } from "../../../utils/getters";
import { delayPromiseFunction } from "../../../utils/request";

describe("describePromiseFunction", () => {
  let promiseFunc = (): Promise<number> => new Promise((resolve) => resolve(2));
  
  beforeEach(() => {
    promiseFunc = (): Promise<number> => new Promise((resolve) => resolve(2));
  });

  it("Should resolve the promise<number> after 2 seconds.", async () => {
    const start = hrtime();
    const res = await delayPromiseFunction(promiseFunc, 2000);
    const end = hrtime(start);
    const duration = getDurationInSeconds(end);

    expect(Math.floor(duration)).toEqual(2);
    expect(typeof res).toBe("number");
  });

  it("Should resolve the promise<number> after 4 seconds.", async () => {
    const start = hrtime();
    const res = await delayPromiseFunction(promiseFunc, 4000);
    const end = hrtime(start);
    const duration = getDurationInSeconds(end);

    expect(Math.floor(duration)).toEqual(4);
    expect(typeof res).toBe("number");
  });
});
