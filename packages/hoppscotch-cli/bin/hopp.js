#!/usr/bin/env node
// * The entry point of the CLI
// @ts-check

import chalk from "chalk";
import { spawnSync } from "child_process";
import fs from "fs";
import { cloneDeep } from "lodash-es";
import semver from "semver";
import { fileURLToPath } from "url";

const highlightVersion = (version) => chalk.black.bgYellow(`v${version}`);

const packageJsonPath = fileURLToPath(
  new URL("../package.json", import.meta.url)
);
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

const requiredNodeVersionRange = packageJson.engines?.node || ">=20";

// Extract the major version from the start of the range
const requiredNodeVersion = semver.major(
  semver.minVersion(requiredNodeVersionRange) ?? "20"
);

const currentNodeVersion = process.versions.node;

// Last supported version of the CLI for Node.js v18
const lastSupportedVersion = "0.11.1";

if (!semver.satisfies(currentNodeVersion, requiredNodeVersionRange)) {
  console.error(
    `${chalk.greenBright("Hoppscotch CLI")} requires Node.js ${highlightVersion(requiredNodeVersion)} or higher and you're on Node.js ${highlightVersion(currentNodeVersion)}.`
  );

  console.error(
    `\nIf you prefer staying on Node.js ${highlightVersion("18")}, you can install the last supported version of the CLI:\n` +
      `${chalk.green(`npm install -g @hoppscotch/cli@${lastSupportedVersion}`)}`
  );
  process.exit(1);
}

// Dynamically importing the module after the Node.js version check prevents errors due to unrecognized APIs in older Node.js versions
const { cli } = await import("../dist/index.js");

// As per isolated-vm documentation, we need to supply `--no-node-snapshot` for node >= 20
// src: https://github.com/laverdet/isolated-vm?tab=readme-ov-file#requirements
if (!process.execArgv.includes("--no-node-snapshot")) {
  const argCopy = cloneDeep(process.argv);

  // Replace first argument with --no-node-snapshot
  // We can get argv[0] from process.argv0
  argCopy[0] = "--no-node-snapshot";

  const result = spawnSync(process.argv0, argCopy, { stdio: "inherit" });

  // Exit with the same status code as the spawned process
  process.exit(result.status ?? 0);
} else {
  cli(process.argv);
}
