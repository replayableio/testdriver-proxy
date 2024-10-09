const { spawn } = require("node:child_process");
const ipc = require("@node-ipc/node-ipc").default;
const fs = require("fs");
const chalk = require("chalk");
const os = require("node:os");
const path = require("path");

if (!["darwin", "win32"].includes(process.platform)) {
  throw new Error("Unsupported platform: " + process.platform);
}

ipc.config.id = "world";
ipc.config.retry = 1500;
// ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.sync = true;
ipc.config.silent = true;
// ipc.config.logDepth = 0; //default
// ipc.config.logger = () => {};

// log the version from package.json
console.log("testdriver-proxy version", require("./package.json").version);

function markdownToListArray(markdown) {
  // Normalize line breaks
  const normalizedMarkdown = markdown.replace(/\\n/g, "\n");

  // Split into lines, filter out non-list items, and remove the leading number and period
  const listItems = normalizedMarkdown
    .split("\n")
    .filter((line) => line.match(/^\d+\. /))
    .map((item) => {
      item = item.replace(/^\d+\. /, "");
      item = item.replace(/\\r/g, "");
      return item;
    }); // Remove the leading numbers and period

  return listItems;
}

ipc.serve(function () {
  ipc.server.on("connect", function (socket) {
    ipc.server.emit(socket, "status", "connected");
  });

  ipc.server.on("command", async (data, socket) => {
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! command");
    const { env, cwd, prerun, instructions } = JSON.parse(data.toString());
    const version =
      env.TESTDRIVERAI_VERSION || process.env.TESTDRIVERAI_VERSION || "latest";

    await installTestdriverai(version, socket)
      .then(() => {
        ipc.server.emit(
          socket,
          "stdout",
          "\nSuccessfully installed testdriverai package\n"
        );
      })
      .catch((err) => {
        const errorMessage = `Failed to install testdriverai package: ${err.message}`;
        console.error(errorMessage);
        ipc.server.emit(socket, "stderr", `\n${errorMessage}\n`);
        ipc.server.emit(socket, "close", 1);
      });

    await spawnShell({ cwd, env, prerun }, socket)
      .then(() => {
        ipc.server.emit(socket, "stdout", "\nSuccessfully ran prerun script\n");
      })
      .catch((err) => {
        const errorMessage = `Failed to run prerun script: ${err.message}`;
        console.error(errorMessage);
        ipc.server.emit(socket, "stderr", `\n${errorMessage}\n`);
        ipc.server.emit(socket, "close", 1);
      });

    setTimeout(() => {
      // give prerun tiem to resolve, launch an app, etc
      // this gives chrome time to launch, so prompts assume prerun has resolved
      spawnInterpreter({ cwd, env, instructions }, socket);
    }, 5000);
  });
});

const installTestdriverai = async function (version, socket) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn("yarn", ["global", "add", `testdriverai@${version}`], {
        env: process.env,
        shell: true,
        windowsHide: true,
      });

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (data) =>
        ipc.server.emit(socket, "stdout", data.toString())
      );
      child.stderr.on("data", (data) =>
        ipc.server.emit(socket, "stderr", data.toString())
      );
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) return resolve();
        reject(new Error(`yarn exited with code ${code}`));
      });
    } catch (err) {
      reject(err);
    }
  });
};

let i = 0;
const spawnInterpreter = function (
  { cwd, env, inspect, instructions },
  socket
) {
  let child;
  let step = 0;
  try {
    console.log("!!! SPAWNING");

    list = markdownToListArray(instructions);

    let command = "testdriverai";
    let args = [];
    if (inspect && process.platform === "win32") {
      command = "node";
      args = [
        "--inspect",
        "C:\\Users\\testdriver\\AppData\\Local\\Yarn\\global\\node_modules\\testdriverai\\index.js",
      ];
    }

    child = spawn(command, args, {
      env: {
        TD_SPEAK: false,
        TD_ANALYTICS: true,
        TD_NOTIFY: true,
        ...process.env,
        ...env,
        FORCE_COLOR: true,
      },
      cwd,
      shell: true,
      windowsHide: true,
    });
    child.stdout.setEncoding("utf8");
  } catch (e) {
    console.log("caught", e);
    ipc.server.emit(socket, "stderr", e.toString());
  }

  child.on("error", function (e) {
    console.log("error", e);

    ipc.server.emit(socket, "stderr", e.toString());
  });

  let lineBuffer = "";
  child.stdout.on("data", async (data) => {
    lineBuffer = data.toString();
    let lines = lineBuffer.split("\n");

    ipc.server.emit(socket, "stdout", lineBuffer);

    if (stripAnsi(lines[lines.length - 1]).indexOf(">") === 0) {
      if (!list[i]) {
        child.stdin.end();
        child.stdout.destroy();
        child.stderr.destroy();
        child.kill();
      } else {
        let command = list[i];
        child.stdin.write(`${command}\r\n`);

        i++;
      }

      lineBuffer = "";

      step += 1;
    }
  });

  child.stderr.on("data", (data) => {
    ipc.server.emit(socket, "stderr", data.toString());
  });

  child.on("close", (code) => {
    console.log(code, "close");
    if (typeof code !== "number") {
      code = 0;
    }

    ipc.server.emit(socket, "close", code);
  });
};

const spawnShell = function ({ cwd, env, prerun }, socket) {
  let child;

  return new Promise((resolve, reject) => {
    try {
      const testdriverRepoPath =
        env.TESTDRIVERAI_REPO_PATH || process.env.TESTDRIVERAI_REPO_PATH;
      if (testdriverRepoPath) cwd = testdriverRepoPath;
      // example input  'rm ~/Desktop/WITH-LOVE-FROM-AMERICA.txt \\n npm install dashcam-chrome --save \\n /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --start-maximized --load-extension=./node_modules/dashcam-chrome/build/ 1>/dev/null 2>&1 & \\n exit'

      let prerunFilePath = "prerun.sh";
      if (process.platform === "win32") {
        prerunFilePath = "prerun.ps1";
      }

      if (testdriverRepoPath) {
        prerunFilePath = path.join(
          testdriverRepoPath,
          "testdriver",
          prerunFilePath
        );
      } else {
        prerunFilePath = path.join(os.tmpdir(), prerunFilePath);
      }

      // Check if the prerun file doesn't exist
      // this can happen if the repo supplies this file within `testdriver/prerun`
      // mostly for backward compatibility
      if (prerun) {
        // this should be swapped, prerun should take over
        // Write prerun to the prerun file

        ipc.server.emit(
          socket,
          "stdout",
          `
${chalk.green("TestDriver: ")}${chalk.yellow("Running Prerun Script")}

\`\`\`
${prerun.replace(/\r\n/g, "\n")}
\`\`\`

From: "${prerunFilePath}"
`
        );

        if (process.platform === "win32") {
          prerun = `$ErrorActionPreference = "Stop"
${prerun}`.replace(/(?<!\r)\n/g, "\r\n");
        }

        try {
          fs.writeFileSync(prerunFilePath, prerun, { flag: "w+" });
        } catch (e) {
          console.error(e);
        }
      }

      let toRun;
      switch (process.platform) {
        case "darwin":
          toRun = {
            command: "source",
            args: [prerunFilePath],
          };
          break;
        case "win32":
          toRun = {
            command: "powershell",
            args: [prerunFilePath],
          };
          break;
      }
      console.log(
        "spawning ",
        `${toRun.command} ${toRun.args
          .map((arg) => JSON.stringify(arg))
          .join(" ")}`
      );

      if (fs.existsSync(prerunFilePath) && toRun) {
        child = spawn(toRun.command, toRun.args, {
          env: { ...process.env, ...env },
          cwd,
          shell: true,
          windowsHide: true,
        });
      } else {
        throw new Error(`Prerun file does not exist at ${prerunFilePath}`);
      }
    } catch (e) {
      reject(e);
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", async (data) => {
      ipc.server.emit(socket, "stdout", data.toString());
    });

    child.stderr.on("data", (data) => {
      ipc.server.emit(socket, "stderr", data.toString());
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Prerun script exited with code ${code}`));
    });
  });
};

ipc.server.start();

const ansiRegex = (({ onlyFirst = false } = {}) => {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|");
  return new RegExp(pattern, onlyFirst ? undefined : "g");
})();

function stripAnsi(string) {
  if (typeof string !== "string") {
    throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
  }

  return string.replace(ansiRegex, "");
}

setInterval(function () {
  console.log("server running... " + new Date());
}, 1000 * 20);
