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
    "Id of server"
  )
  .parse();

if (!["darwin", "win32"].includes(process.platform)) {
  throw new Error("Unsupported platform: " + process.platform);
}

ipc.config.id = program.opts().id || "world";
ipc.config.retry = 1500;
// ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.sync = true;
ipc.config.silent = false;
// ipc.config.logDepth = 0; //default
// ipc.config.logger = () => {};

// log the version from package.json
console.log("testdriver-proxy version", require("./package.json").version);

ipc.serve(function() {
  ipc.server.on("connect", function(socket) {
    ipc.server.emit(socket, "status", "connected");
  });

  ipc.server.on("command", async (data, socket) => {
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! command");
    const { env, cwd, command } = JSON.parse(data.toString());

    setTimeout(() => {
      // give prerun tiem to resolve, launch an app, etc
      // this gives chrome time to launch, so prompts assume prerun has resolved
      spawnInterpreter({ cwd, env, command }, socket);
    }, 5000);
  });
});

const spawnInterpreter = function(
  { cwd, env, command },
  socket
) {
  console.log(env);
  let child;
  try {
    console.log("!!! SPAWNING");

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
      shell: true,
      windowsHide: true,
    });
    child.stdout.setEncoding("utf8");
  } catch (e) {
    console.log("caught", e);
    ipc.server.emit(socket, "stderr", e.toString());
  }

  child.on("error", function(e) {
    console.log("error", e);
    ipc.server.emit(socket, "stderr", e.toString());
  });

  child.stdout.on("data", async (data) => {
    lineBuffer = data.toString();
    ipc.server.emit(socket, "stdout", data.toString());
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

ipc.server.start();

setInterval(function() {
  console.log("server running... " + new Date());
}, 1000 * 20);
