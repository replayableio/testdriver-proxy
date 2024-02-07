const ipc = require("node-ipc").default;

ipc.config.id = "world";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "ascii";
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
    const { spawn } = require("node:child_process", [], { shell: true });
    let child;
    let text;
    let inputDone = false;
    try {
      const args = JSON.parse(data.toString());
      text = args[0];
      child = spawn(`interpreter`, ["--os", "--api_key", args[1]], {stdio: "inherit"});
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

      if (data.toString().trim() === ">") {
        if (inputDone) {
          child.stdin.end();
          child.stdout.destroy();
          child.stderr.destroy();
          child.kill();
        } else {
          inputDone = true;
          child.stdin.write(`${text}\n`);

          dataToSend += text;
        }
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
