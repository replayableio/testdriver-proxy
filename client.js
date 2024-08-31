const fs = require("fs");
const chalk = require("chalk");
const { cwd } = require("process");
const ipc = require("@node-ipc/node-ipc").default;

if (process.argv.length === 2) {
  console.error("Expected at least one argument");
  process.exit(1);
}

ipc.config.id = "hello";
// ipc.config.retry = 1500;
ipc.config.sync = true;
// ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.silent = true;

function removeAnsiControlChars(input) {
  // Regular expression to match ANSI control characters except color codes
  const controlCharRegex = /(?:\u001b\[\d*G|\u001b\[\d*;?\d*[ABCDHJK])/g;

  // Return the string after removing the control characters
  return input.replace(controlCharRegex, "");
}

// const pattern = /\u001b\[1G|\u001b\[3G/g;
const pattern = /\x1b\[1G|\x1b\[3G/g;

ipc.connectTo("world", function () {
  ipc.of["world"].on("connect", function () {
    console.log(chalk.green("TestDriver:"), "Initialized");

    let text = process.argv[2];

    text = text.split("\n").join(" ");

    const apiKey = process.argv[3];
    let prerunFilePath = process.argv[4] || null;
    const githubActionRepoPath = process.env.GITHUB_ACTION_REPO_PATH || null;
    const testdriveraiVersion = process.env.TESTDRIVERAI_VERSION || "latest";

    if (prerunFilePath && !fs.existsSync(prerunFilePath)) {
      console.error(chalk.red("Prerun file path does not exist"));
      process.exit(1);
    }

    ipc.of["world"].emit(
      "command",
      JSON.stringify([
        text,
        apiKey,
        path.join(cwd, prerunFilePath),
        process.cwd(),
        testdriveraiVersion,
        githubActionRepoPath,
      ])
    );
  });

  ipc.of["world"].on("status", function (data) {
    console.log("status", data.toString());
  });
  ipc.of["world"].on("stdout", function (data) {
    let dataEscaped = JSON.stringify(data);

    // see the outpout
    // console.log(JSON.stringify(removeAnsiControlChars(JSON.parse(dataEscaped))))

    process.stdout.write(removeAnsiControlChars(JSON.parse(dataEscaped)));
  });
  ipc.of["world"].on("stderr", function (data) {
    process.stderr.write(data);
  });
  ipc.of["world"].on("close", function (code) {
    process.exit(code || 0);
  });
  ipc.of["world"].on("error", function (err) {
    console.error(err);
    process.exit(1);
  });
});
