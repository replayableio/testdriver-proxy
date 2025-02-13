const { spawn } = require("node:child_process");
const ipc = require("@node-ipc/node-ipc").default;
const fs = require("fs");
const chalk = require("chalk");
const os = require("node:os");
const path = require("path");

const { program } = require("commander");

// Commander program
program.description("TestDriverAI proxy server");
program
  .option(
    "-i, --id <string>",
    "Id of server",
    "world"
  )
  .option(
    "-v, --verbose",
    "Verbose If True"
  )
  .parse();

if (!["darwin", "win32"].includes(process.platform)) {
  throw new Error("Unsupported platform: " + process.platform);
}

ipc.config.id = program.opts().id;
ipc.config.retry = 1500;
ipc.config.encoding = "utf-8";
ipc.config.sync = true;
ipc.config.silent = !program.opts().verbose;

// log the version from package.json
console.log("testdriver-proxy version", require("./package.json").version);

let currentProcess = null;

ipc.serve(function() {
  console.log(chalk`{green Started Server}`);
  ipc.server.on("connect", function(socket) {
    ipc.server.emit(socket, "status", "connected");
  });

  ipc.server.on("command", async (data, socket) => {
    const { env, cwd, command, delay } = JSON.parse(data.toString());
    console.log(chalk`
{yellow Command Received}
{cyan command:} ${command}
{cyan CWD}: ${cwd}
{cyan ENV}: ${JSON.stringify(env)}
`);

    // Kill Current Process
    if (currentProcess) {
      console.log(chalk`{red Process already exists, killing...}`);
      try {
        currentProcess.kill();
      } catch (e) {
        console.log(chalk`{red Error killing process: ${e}}`);
      }
    }

    setTimeout(() => {
      // give prerun tiem to resolve, launch an app, etc
      // this gives chrome time to launch, so prompts assume prerun has resolved
      spawnInterpreter({ cwd, env, command }, socket);
    }, delay ?? 5000);
  });

  ipc.server.on("input", async (data, socket) => {
    console.log(chalk`{yellow Input Received}: ${data}`);
    if (!currentProcess) {
      console.log(chalk`{red Ignoring input, no process running}`);
      return;
    }
    currentProcess.stdin.write(data.toString());
  });

  ipc.server.on("kill", async (data, socket) => {
    console.log(chalk`{yellow Kill Signal Received}`);
    if (!currentProcess) {
      console.log(chalk`{red Ignoring kill, no process running}`);
      return;
    }
    currentProcess.kill('SIGTERM');
  });
});

const spawnInterpreter = function(
  { cwd, env, command },
  socket
) {
  let child;
  try {
    console.log(chalk`{cyan Spawning Process...}`);

    child = spawn(command, {
      env: {
        TD_SPEAK: false,
        TD_ANALYTICS: true,
        TD_MINIMIZE: false,
        ...process.env,
        ...env,
        FORCE_COLOR: true,
      },
      cwd,
      shell: "powershell.exe",
      windowsHide: true,
    });
    currentProcess = child;
    child.stdout.setEncoding("utf8");
  } catch (e) {
    console.log(chalk`{red Spawing Error:}\n${e}`);
    ipc.server.emit(socket, "stderr", e.toString());
  }

  child.on("error", function(e) {
    console.log(chalk`{red Process Error:}\n${e}`);
    ipc.server.emit(socket, "stderr", e.toString());
    currentProcess = null;
  });

  child.stdout.on("data", async (data) => {
    lineBuffer = data.toString();
    ipc.server.emit(socket, "stdout", data.toString());
  });

  child.stderr.on("data", (data) => {
    ipc.server.emit(socket, "stderr", data.toString());
  });

  child.on("close", (code) => {
    console.log(chalk `{yellow Process closed with code:} ${code}`);
    if (typeof code !== "number") {
      code = 0;
    }

    ipc.server.emit(socket, "close", code);
    currentProcess = null;
  });
};

ipc.server.start();

setInterval(function() {
  console.log(chalk`{grey Server running... ${new Date()}}`);
}, 1000 * 20);
