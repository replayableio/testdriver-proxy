const ipc = require("@node-ipc/node-ipc").default;

if (process.argv.length === 2) {
  console.error("Expected at least one argument!");
  process.exit(1);
}

ipc.config.id = "hello";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.silent = true;

ipc.connectTo("world", function () {
  ipc.of.world.on("connect", function () {
        
    let text = process.argv[2];

    text = text.split("\n").join(" ");

    const apiKey = process.argv[3];
    const prerun = process.argv[4];

    ipc.of.world.emit(JSON.stringify([text, apiKey, prerun]));  
  });

  ipc.of.world.on("data", function (data) {
    try {
      data = JSON.parse(data);

      if (data.method == "status") {
        // console.info(data.message);
      }
      if (data.method == "stdout") {
        process.stdout.write(data.message);
      }
      if (data.method == "stderr") {
        process.stderr.write(data.message);
      }

      if (data.method == "close") {
        process.exit(0);
      }
    } catch (e) {
      // console.error(e);
    }
  });
});
