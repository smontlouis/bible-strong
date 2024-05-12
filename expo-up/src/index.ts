#!/usr/bin/env node
import { Command } from "commander";
import { releaseBundle } from "./commands/release.js";
import { rollbackBundle } from "./commands/rollback.js";
import fs from "fs";
import { __dirname__ } from "./constants.js";

// package.json
const pkg = JSON.parse(
  fs.readFileSync(`${__dirname__}/../package.json`, "utf-8")
);

const program = new Command();

program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command("release")
  .description("Release")
  .requiredOption("-p, --platform <platform>", "Platform")
  .requiredOption("-t, --token <token>", "Auth Token for custom server")
  .action(releaseBundle);

program
  .command("rollback")
  .description("Release")
  .requiredOption("-p, --platform <platform>", "Platform")
  .requiredOption("-t, --token <token>", "Auth Token for custom server")
  .option("-e, --embedded", "Rollback to embedded version")
  .action(rollbackBundle);

program.parse();
