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
    let text =
      process.argv[2] +
      ', use chrome if you need to use a web browser. Once the process is done, make a file at /tmp/td.log. In this file, say either "The test failed" or "The test passed," then explain how you came to that conclusion and the workarounds you tried.';

    text = text
      .replace("@testdriverai", "")
      .replace(/"/g, '\\"')
      .split("\n")
      .join(" ");

    const apiKey = process.argv[3];
    ipc.of.world.emit(JSON.stringify([text, apiKey, ...process.argv.slice(4)]));
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
