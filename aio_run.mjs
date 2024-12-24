#!/usr/local/bin/node
// @ts-check

import { execSync, spawn } from "child_process"
import fs from "fs"
import process from "process"

function runChildProcessWithPrefix(command, args, prefix) {
  const childProcess = spawn(command, args);

  childProcess.stdout.on('data', (data) => {
    const output = data.toString().trim().split('\n');
    output.forEach((line) => {
      console.log(`${prefix} | ${line}`);
    });
  });

  childProcess.stderr.on('data', (data) => {
    const error = data.toString().trim().split('\n');
    error.forEach((line) => {
      console.error(`${prefix} | ${line}`);
    });
  });

  childProcess.on('close', (code) => {
    console.log(`${prefix} Child process exited with code ${code}`);
  });

  childProcess.on('error', (stuff) => {
    console.log("error")
    console.log(stuff)
  })

  return childProcess
}

const envFileContent = Object.entries(process.env)
  .filter(([env]) => env.startsWith("VITE_"))
  .map(([env, val]) => `${env}=${
    (val.startsWith("\"") && val.endsWith("\""))
      ? val
      : `"${val}"`
  }`)
  .join("\n")

fs.writeFileSync("build.env", envFileContent)

execSync(`npx import-meta-env -x build.env -e build.env -p "/site/**/*"`)

fs.rmSync("build.env")

const caddyFileName = process.env.ENABLE_SUBPATH_BASED_ACCESS === 'true' ? 'aio-subpath-access.Caddyfile' : 'aio-multiport-setup.Caddyfile'
const caddyProcess = runChildProcessWithPrefix("caddy", ["run", "--config", `/etc/caddy/${caddyFileName}`, "--adapter", "caddyfile"], "App/Admin Dashboard Caddy")
const backendProcess = runChildProcessWithPrefix("node", ["/dist/backend/dist/main.js"], "Backend Server")
const webappProcess = runChildProcessWithPrefix("webapp-server", [], "Webapp Server")

caddyProcess.on("exit", (code) => {
  console.log(`Exiting process because Caddy Server exited with code ${code}`)
  process.exit(code)
})

backendProcess.on("exit", (code) => {
  console.log(`Exiting process because Backend Server exited with code ${code}`)
  process.exit(code)
})

webappProcess.on("exit", (code) => {
  console.log(`Exiting process because Webapp Server exited with code ${code}`)
  process.exit(code)
})

process.on('SIGINT', () => {
  console.log("SIGINT received, exiting...")

  caddyProcess.kill("SIGINT")
  backendProcess.kill("SIGINT")
  webappProcess.kill("SIGINT")

  process.exit(0)
})
