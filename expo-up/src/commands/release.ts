import chalk from "chalk";
import figlet from "figlet";
import fs from "fs";
import ora from "ora";
import { execSync } from "child_process";
import ExpoConfig from "@expo/config";
import dotenv from "dotenv";
import { DotenvPopulateInput } from "dotenv";
import archiver from "archiver";
import { __dirname__, basePath } from "../constants.js";
import FormData from "form-data";
import axios from "axios";

const pkg = JSON.parse(
  fs.readFileSync(`${__dirname__}/../package.json`, "utf-8")
);

const creatingBundleSpinner = ora("Creating Bundle...");
const zippingBundleSpinner = ora("Compressing Bundle...");
const uploadingBundleSpinner = ora("Uploading Bundle...");

export const releaseBundle = async (options: {
  platform: "ios" | "android";
  token: string;
}) => {
  figlet.text(
    pkg.name,
    {
      font: "Big",
    },
    (err, data) => {
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

        // Creating Bundle
        creatingBundleSpinner.start();
        execSync(`${mode} expo export --platform ${options.platform}`);

        // set env since it is need for expoConfig.json generation
        dotenv.config();
        dotenv.populate(process.env as DotenvPopulateInput, {
          NODE_ENV: "production",
        });
        const { exp } = ExpoConfig.getConfig(basePath, {
          skipSDKVersionRequirement: true,
          isPublicConfig: true,
        });
        // Create expoConfig.json
        fs.writeFileSync(
          `${basePath}/dist/expoConfig.json`,
          JSON.stringify(exp)
        );
        creatingBundleSpinner.succeed("Bundle created successfully");

        // zip bundle
        zippingBundleSpinner.start();

        const bundleTimestamp = new Date().getTime();
        const bundleName = `${bundleTimestamp}.zip`;
        const bundle = archiver("zip");
        const output = fs.createWriteStream(bundleName);

        bundle.pipe(output);
        bundle.directory(`${basePath}/dist`, false);
        bundle.finalize();

        output.on("close", async () => {
          zippingBundleSpinner.succeed("Bundle compressed successfully");

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

          // uploading bundle
          uploadingBundleSpinner.start();

          const zippedBundlePath = `${process.cwd()}/${bundleName}`;
          const zippedBundle = fs.readFileSync(zippedBundlePath);

          const formData = new FormData();
          formData.append("file", zippedBundle, bundleName);
          formData.append("updatesKey", key);
          formData.append("bundleTimestamp", bundleTimestamp);
          formData.append("platform", options.platform);
          formData.append("runtimeVersion", exp.version);

          let uploadState: "success" | "error" = "success";
          let uploadMessage: string = "Bundle uploaded successfully";
          try {
            const { status } = await axios.post(
              `${host}/api/expo-up`,
              formData,
              {
                headers: {
                  ...formData.getHeaders(),
                  Authorization: `Bearer ${options.token}`,
                },
              }
            );
            if (status === 200) {
              uploadMessage = "Bundle exists already";
              uploadState = "error";
            }
          } catch (error) {
            uploadState = "error";
            uploadMessage = "Something went wrong";
            if (axios.isAxiosError(error)) {
              if (error.response?.data?.error) {
                uploadMessage = error.response.data.error;
              }
            } else {
              console.log(chalk.red("\nError: ") + error);
            }
          }

          // delete bundle
          fs.rmSync(`${process.cwd()}/${bundleName}`);

          // delete dist folder
          fs.rmSync(`${process.cwd()}/dist`, { recursive: true, force: true });

          if (uploadState === "error") {
            uploadingBundleSpinner.fail(uploadMessage);
            process.exit(1);
          }

          uploadingBundleSpinner.succeed(uploadMessage);
          process.exit(0);
        });

        bundle.on("error", function (err) {
          console.log("Error: ", err);
          process.exit(1);
        });
      } catch (error) {
        console.log(chalk.red("Error: ") + error);
        process.exit(1);
      }
    }
  );
};
