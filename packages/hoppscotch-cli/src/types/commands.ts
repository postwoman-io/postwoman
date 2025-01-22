export type TestCmdOptions = {
  env?: string;
  delay?: string;
  token?: string;
  server?: string;
  reporterJunit?: string;
  iterationCount?: number;
  iterationData?: string;
};

// Consumed in the collection `file_path_or_id` argument action handler
export type TestCmdCollectionOptions = Omit<TestCmdOptions, "env" | "delay">;

// Consumed in the `--env, -e` flag action handler
export type TestCmdEnvironmentOptions = Omit<TestCmdOptions, "env"> & {
  env: string;
};

export type HOPP_ENV_FILE_EXT = "json";
