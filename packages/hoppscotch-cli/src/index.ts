import chalk from "chalk";
import { Command } from "commander";
import * as E from "fp-ts/Either";

import { version } from "../package.json";
import { test } from "./commands/test";
import { handleError } from "./handlers/error";

const accent = chalk.greenBright;

/**
 * * Program Default Configuration
 */
const CLI_BEFORE_ALL_TXT = `hopp: The ${accent(
  "Hoppscotch"
)} CLI - Version ${version} (${accent(
  "https://hoppscotch.io"
)}) ${chalk.black.bold.bgYellowBright(" ALPHA ")} \n`;

const CLI_AFTER_ALL_TXT = `\nFor more help, head on to ${accent(
  "https://docs.hoppscotch.io/documentation/clients/cli/overview"
)}`;

const program = new Command();

program
  .name("hopp")
  .version(version, "-v, --ver", "see the current version of hopp-cli")
  .usage("[options or commands] arguments")
  .addHelpText("beforeAll", CLI_BEFORE_ALL_TXT)
  .addHelpText("after", CLI_AFTER_ALL_TXT)
  .configureHelp({
    optionTerm: (option) => accent(option.flags),
    subcommandTerm: (cmd) => accent(cmd.name(), cmd.usage()),
    argumentTerm: (arg) => accent(arg.name()),
  })
  .addHelpCommand(false)
  .showHelpAfterError(true);

program.exitOverride().configureOutput({
  writeErr: (str) => program.help(),
  outputError: (str, write) =>
    handleError({ code: "INVALID_ARGUMENT", data: E.toError(str) }),
});

/**
 * * CLI Commands
 */
program
  .command("test")
  .argument(
    "<file_path_or_id>",
    "path to a hoppscotch collection.json file or collection ID from a workspace for CI testing"
  )
  .option(
    "-e, --env <file_path_or_id>",
    "path to an environment variables json file or environment ID from a workspace"
  )
  .option(
    "-d, --delay <delay_in_ms>",
    "delay in milliseconds(ms) between consecutive requests within a collection"
  )
  .option(
    "--token <access_token>",
    "personal access token to access collections/environments from a workspace"
  )
  .option("--server <server_url>", "server URL for SH instance")
  .option(
    "--reporter-junit [path]",
    "generate JUnit report optionally specifying the path"
  )
  .option(
    "--iteration-count <no_of_iterations>",
    "number of iterations to run the test",
    parseInt
  )
  .option(
    "--iteration-data <file_path>",
    "path to a CSV file for data-driven testing"
  )
  .allowExcessArguments(false)
  .allowUnknownOption(false)
  .description("running hoppscotch collection.json file")
  .addHelpText(
    "after",
    `\nFor help, head on to ${accent(
      "https://docs.hoppscotch.io/documentation/clients/cli/overview#commands"
    )}`
  )
  .action(async (pathOrId, options) => {
    const overrides: Record<string, unknown> = {};

    // Choose `hopp-junit-report.xml` as the default value if `reporter-junit` flag is supplied without a value
    if (options.reporterJunit === true) {
      overrides.reporterJunit = "hopp-junit-report.xml";
    }

    const effectiveOptions = { ...options, ...overrides };

    await test(pathOrId, effectiveOptions)();
  });

export const cli = async (args: string[]) => {
  try {
    await program.parseAsync(args);
  } catch (e) {}
};
