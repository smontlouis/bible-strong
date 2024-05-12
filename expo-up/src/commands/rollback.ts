import chalk from "chalk";
import figlet from "figlet";
import fs from "fs";
import ora from "ora";
import { execSync } from "child_process";
import ExpoConfig from "@expo/config";
import dotenv from "dotenv";
import { DotenvPopulateInput } from "dotenv";
import { __dirname__, basePath } from "../constants.js";
import axios from "axios";

const gettingAppInfoSpinner = ora("Getting App Info...");
const revertingSpinner = ora();

const pkg = JSON.parse(
  fs.readFileSync(`${__dirname__}/../package.json`, "utf-8")
);

export const rollbackBundle = async (options: {
  platform: "ios" | "android";
  token: string;
  embedded: boolean;
}) => {
  figlet.text(
    pkg.name,
    {
      font: "Big",
    },
    async (err, data) => {
      if (err) {
        console.log("Something went wrong...");
        console.dir(err);
        return;
      }

      let mode: "yarn" | "npx" = "npx";
      const yarnLock = fs.existsSync(`${basePath}/yarn.lock`);

      if (yarnLock) {
        mode = "yarn";
      }

      // check if expo installed
      try {
        execSync(`${mode} expo -v`, { stdio: "ignore" });
      } catch (error) {
        console.log(
          chalk.blue("expo-update: ") +
            chalk.red(
              "You are not in an expo project. Please run this command in an expo project."
            )
        );
        process.exit(1);
      }

      try {
        console.log(chalk.bgCyan(data) + "\n");

        gettingAppInfoSpinner.start();

        // set env since it is need for expoConfig.json generation
        dotenv.config();
        dotenv.populate(process.env as DotenvPopulateInput, {
          NODE_ENV: "production",
        });
        const { exp } = ExpoConfig.getConfig(basePath, {
          skipSDKVersionRequirement: true,
          isPublicConfig: true,
        });

        gettingAppInfoSpinner.succeed(
          "Successfully retrieved app information."
        );

        if (!exp.version) {
          console.log(
            chalk.red(
              "Error: You need to set the version in app.json or app.config.js"
            )
          );
          process.exit(1);
        }

        if (!exp.updates?.url) {
          console.log(
            chalk.red(
              "Error: You need to set the updates.url in app.json or app.config.js"
            )
          );
          process.exit(1);
        }

        const key = exp.updates?.requestHeaders?.["x-expo-updates-key"];

        if (!key) {
          console.log(
            chalk.red(
              "Error: You need to set the updates.requestHeaders.x-expo-updates-key in app.json or app.config.js"
            )
          );
          process.exit(1);
        }

        // get host
        const url = new URL(exp.updates.url);
        const host = `${url.protocol}//${url.host}`;

        console.log(chalk.blue("expo-up: ") + "Detected Host: " + host);
        console.log(chalk.blue("expo-up: ") + "Detected Key: " + key);

        let revertState: "success" | "error" = "success";
        let revertMessage: string = `Successfully reverted ${exp.version} to previous update.`;

        if (options.embedded) {
          revertingSpinner.start(
            `Reverting ${exp.version} to embedded update...`
          );
          revertMessage = `Successfully reverted ${exp.version} to embedded update.`;
        } else {
          revertingSpinner.start(
            `Reverting ${exp.version} to previous update...`
          );
        }

        try {
          await axios.post(
            `${host}/api/expo-up`,
            {
              rollbackType: options.embedded ? "embedded" : "previous",
              platform: options.platform,
              runtimeVersion: exp.version,
              updatesKey: key,
            },
            {
              headers: {
                Authorization: `Bearer ${options.token}`,
              },
            }
          );
        } catch (error) {
          revertState = "error";
          revertMessage = "Something went wrong";
          if (axios.isAxiosError(error)) {
            if (error.response?.data?.error) {
              revertMessage = error.response.data.error;
            }
          } else {
            console.log(chalk.red("\nError: ") + error);
          }
        }

        if (revertState === "success") {
          revertingSpinner.succeed(revertMessage);
        } else {
          revertingSpinner.fail(revertMessage);
        }
      } catch (error) {
        console.log(chalk.red("Error: ") + error);
        process.exit(1);
      }
    }
  );
};
