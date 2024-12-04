const fs = require("fs");
const chalk = require("chalk");
const { program } = require("commander");
const ipc = require("@node-ipc/node-ipc").default;

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

// Commander program
program.description("TestDriverAI proxy client");
program
  .argument("[command]", "Command to run")
  .option(
    "-c, --cwd <string>",
    "working directory to run in"
  )
  .option(
    "-i, --id <string>",
    "ID of server to connect to"
  )
  .option(
    "-o, --output-file <string>",
    "Output file to write the output of the command"
  )
  .option(
    "-e, --env <string>",
    "Extra environment variables"
  )
  .parse();

let command = program.args[0];

// Handle Options
const options = program.opts();
const outputFile = options.outputFile || "";
const extraEnv = JSON.parse(options.env || "{}");
const cwd = options.cwd || process.cwd();
const serverId = options.id || "world";


let env = Object.entries(process.env)
  .filter(([key]) => key.startsWith("TESTDRIVERAI_") || key.startsWith("TD_"))
  .reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

// Merge in interpolation data
env = {
  ...env,
  ...extraEnv,
}

const logger = {
  stdout: (data) => {
    process.stdout.write(data);
    if (outputFile) {
      fs.appendFileSync(outputFile, data);
    }
  },
  stderr: (data) => {
    process.stderr.write(data);
    if (outputFile) {
      fs.appendFileSync(outputFile, data);
    }
  },
};

if (!command) {
  logger.stderr(
    "\nError: Command is required\n"
  );
  process.exit(1);
}

ipc.connectTo(serverId, function() {
  ipc.of[serverId].on("connect", function() {
    logger.stdout(`${chalk.green("TestDriver proxy:")} Initialized\n`);

    ipc.of[serverId].emit(
      "command",
      JSON.stringify({ env, cwd, command })
    );
  });

  ipc.of[serverId].on("status", function(data) {
    logger.stdout(`status ${data.toString()}\n`);
  });
  ipc.of[serverId].on("stdout", function(data) {
    const dataEscaped = removeAnsiControlChars(
      JSON.parse(JSON.stringify(data))
    );
    logger.stdout(dataEscaped);
  });
  ipc.of[serverId].on("stderr", function(data) {
    logger.stderr(data);
  });
  ipc.of[serverId].on("close", function(code) {
    process.exit(code || 0);
  });
  ipc.of[serverId].on("error", function(err) {
    logger.stderr(`${err.toString()}\n`);
    process.exit(1);
  });
});
