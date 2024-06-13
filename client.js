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

ipc.connectTo("world", function () {
  ipc.of['world'].on("connect", function () {

    console.log('connect')
        
    let text = process.argv[2];

    text = text.split("\n").join(" ");

    const apiKey = process.argv[3];
    const prerun = process.argv[4];

    ipc.of['world'].emit('command', JSON.stringify([text, apiKey, prerun]));  
  });

  ipc.of['world'].on("status", function (data) {
    console.log('status', data.toString())
  });
  ipc.of['world'].on("stdout", function (data) {
    // console.log('stdout', data.toString())
    process.stdout.write(data);
  });
  ipc.of['world'].on("stderr", function (data) {
    process.stderr.write(data);
  });
  ipc.of['world'].on("close", function (code) {
    process.exit(code || 0);
  });
  ipc.of['world'].on("error", function (err) {
    console.error(err);
    process.exit(1);
  });
});
