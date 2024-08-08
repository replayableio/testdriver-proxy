const { spawn } = require("node:child_process");
const ipc = require("@node-ipc/node-ipc").default;
const fs = require("fs");
const os = require("os");
const path = require("path");

const platform = os.platform();
if (!["darwin", "win32"].includes(platform)) {
  throw new Error("Unsupported platform: " + platform);
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

    await spawnShell(data, socket).catch((e) => {
      console.error(e);
    });

    setTimeout(() => {
      // give prerun tiem to resolve, launch an app, etc
      // this gives chrome time to launch, so prompts assume prerun has resolved
      spawnInterpreter(data, socket);
    }, 5000);
  });
});

let i = 0;
const spawnInterpreter = function (data, socket) {
  let child;
  let text;
  let key;
  let step = 0;
  try {
    const args = JSON.parse(data.toString());
    text = args[0];
    key = args[1];

    console.log("!!! SPAWNING");

    list = markdownToListArray(text);

    child = spawn(`testdriver`, [], {
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || key,
        FORCE_COLOR: true,
      },
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
        child.stdin.write(`${command}${platform === "win32" ? "\r" : ""}\n`);

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

const spawnShell = function (data, socket) {
  let child;

  return new Promise((resolve, reject) => {
    try {
      const args = JSON.parse(data.toString());
      const prerun = args[2];

      // example input  'rm ~/Desktop/WITH-LOVE-FROM-AMERICA.txt \\n npm install dashcam-chrome --save \\n /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --start-maximized --load-extension=./node_modules/dashcam-chrome/build/ 1>/dev/null 2>&1 & \\n exit'
      let prerunFilePath = `~/actions-runner/_work/testdriver/testdriver/prerun.sh`;
      if(process.platform !== "darwin") {
        prerunFilePath = 'C:\\actions-runner\\_work\\testdriver\\testdriver\\.testdriver\\prerun.ps1'
      }

      // Check if the prerun.sh file doesn't exist
      // this can happen if the repo supplies this file within `.testdriver/prerun.sh`
      // mostly for backward compatibility
      if (prerun) {
        // this should be swapped, prerun should take over
        // Write prerun to the prerun.sh file

        try {
          fs.writeFileSync(
            prerunFilePath,
            prerun
              .replace(/\\n/g, "\n")
              .replace(/\\\\/g, "\\")
              .replace(/\\"/g, '"'),
            { flag: "w+" }
          );
        } catch (e) {
          console.error(e);
        }
      } else {
      }

      switch (platform) {
        case "darwin":
          toRun = {
            command: "source",
            args: [prerunFilePath],
          };
        case "win32":
          toRun = {
            command: "powershell",
            args: [prerunFilePath],
          };
      }
      console.log(
        "spawning ",
        `${toRun.command} ${toRun.args
          .map((arg) => JSON.stringify(arg))
          .join(" ")}`
      );

      if (fs.existsSync(prerunFilePath)) {
        child = spawn(toRun.command, toRun.args, {
          env: { ...process.env }, // FORCE_COLOR: true,  will enable advanced rendering
          shell: true,
          windowsHide: true,
        });
      } else {
        ipc.server.emit(
          socket,
          "stderr",
          `Prerun file does not exist at ${prerunFilePath}`
        );
        resolve();
      }
    } catch (e) {
      ipc.server.emit(socket, "stderr", e.toString());
      resolve();
    }

    child.on("close", function (exitCode) {
      console.log("close", exitCode);
      ipc.server.emit(
        socket,
        "stderr",
        "Child process exited with code " + exitCode + "\n\n"
      );
      resolve();
    });

    child.on("error", function (e) {
      console.log("error", e);
      ipc.server.emit(socket, "stderr", e.toString() + "\n\n");
      resolve();
    });

    child.stdout.on("end", function () {
      ipc.server.emit(socket, "stderr", "Prerun.sh process end\n\n");
      resolve();
    });

    child.stdout.on("data", async (data) => {
      let dataToSend = data.toString();

      console.log("dataToSend", dataToSend);

      ipc.server.emit(socket, "stdout", dataToSend);
    });

    child.stderr.on("data", (data) => {
      ipc.server.emit(socket, "stdout", data.toString());
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

const last = (arr) => arr[arr.length - 1];
