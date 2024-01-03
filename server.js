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
    const { spawn } = require("node:child_process");
    let child;
    try {
      child = spawn(data.toString());
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

    child.stdout.on("data", (data) => {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stdout",
          message: data.toString(),
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
