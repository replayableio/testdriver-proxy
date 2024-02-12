const ipc = require("node-ipc").default;

ipc.config.id = "world";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.silent = true;
ipc.config.logDepth = 0; //default
ipc.config.logger = () => {};

ipc.serve(function () {
  ipc.server.on("connect", function (socket) {
    ipc.server.emit(
      socket,
      JSON.stringify({
        method: "status",
        message: "connected",
      })
    );
  });

  ipc.server.on("data", function (data, socket) {
    const { spawn } = require("node:child_process");
    let child;
    let text;
    let step = 0;
    try {
      const args = JSON.parse(data.toString());
      text = args[0];

      console.log("api key is", args[1]);

      child = spawn(`interpreter`, ["--os", "--api_key", args[1]], {
        env: { ...process.env, FORCE_COLOR: true },
        shell: true,
        windowsHide: true,
      });
    } catch (e) {
      console.log("caught", e);
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: e.toString(),
        })
      );
    }

    child.on("error", function (e) {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: e.toString(),
        })
      );
    });

    child.stdout.on("data", async (data) => {
      let dataToSend = data.toString();

      const line = stripAnsi(last(dataToSend.split("\n")));

      if (line === "> ") {
        if (step === 0) {
          inputDone = true;
          child.stdin.write(`${text}\n`);

          dataToSend += text;
        } else if (step === 1) {
          child.stdin.write(
            '1. summarize the result of the above process. Say either "The test failed" or "The test passed", then explain how you came to that conclusion and the workarounds you tried. 2. Write the test result into /tmp/oiResult.log\n'
          );
        } else {
          child.stdin.end();
          child.stdout.destroy();
          child.stderr.destroy();
          child.kill();
        }

        step += 1;
      }

      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stdout",
          message: dataToSend,
        })
      );
    });

    child.stderr.on("data", (data) => {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: data.toString(),
        })
      );
    });

    child.on("close", (code) => {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "close",
          message: `child process exited with code ${code}`,
        })
      );
    });
  });
});

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
