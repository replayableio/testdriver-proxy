const ipc = require("@node-ipc/node-ipc").default;

if (process.argv.length === 2) {
  console.error("Expected at least one argument!");
  process.exit(1);
}

ipc.config.id = "hello";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "ascii";
ipc.config.silent = true;

ipc.connectTo("world", function () {
  ipc.of.world.on("connect", function () {
    ipc.of.world.emit(process.argv.slice(2).join(" "));
  });

  ipc.of.world.on("data", function (data) {
    try {
      data = JSON.parse(data);

      if (data.method == "status") {
        // console.info(data.message);
      }
      if (data.method == "stdout") {
        console.log(data.message);
      }
      if (data.method == "stderr") {
        console.error(data.message);
      }

      if (data.method == "close") {
        process.exit(0);
      }
    } catch (e) {
      // console.error(e);
    }
  });
});
