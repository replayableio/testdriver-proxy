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
  .argument("[instructions]", "Instructions to run")
  .argument("[prerun]", "Prerun script to run before the instructions")
  .option("-i, --instructions-file <string>", "File with instructions to run")
  .option("-r, --prerun-file <string>", "File with prerun script to run")
  .option(
    "-o, --output-file <string>",
    "Output file to write the output of the command"
  )
  .parse();

const options = program.opts();
const args = program.args;
const outputFile = options.outputFile || "";

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

let instructions = args[0] || "";
let prerun = args[1] || "";

if (!instructions) {
  if (!options.instructionsFile) {
    logger.stderr(
      "\nError: Instructions or an instructions file is required\n"
    );
    process.exit(1);
  }
  if (!fs.existsSync(options.instructionsFile)) {
    logger.stderr(
      `Error: Instructions file "${options.instructionsFile}" not found\n`
    );
    process.exit(1);
  }
  try {
    instructions = fs.readFileSync(options.instructionsFile, "utf-8");
  } catch (err) {
    logger.stderr(
      `Error reading instructions file "${options.instructionsFile}"\n`
    );
    process.exit(1);
  }
}

if (!prerun && options.prerunFile) {
  if (!fs.existsSync(options.prerunFile)) {
    logger.stderr(`Error: Prerun file "${options.prerunFile}" not found\n`);
    process.exit(1);
  }
  try {
    prerun = fs.readFileSync(options.prerunFile, "utf-8");
  } catch (err) {
    logger.stderr(`Error reading prerun file "${options.prerunFile}"\n`);
    process.exit(1);
  }
}

// instructions = instructions.split("\n").join(" ");
const cwd = process.cwd();
const env = Object.entries(process.env)
  .filter(([key]) => key.startsWith("TESTDRIVERAI_"))
  .reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

ipc.connectTo("world", function () {
  ipc.of["world"].on("connect", function () {
    logger.stdout(`${chalk.green("TestDriver:")} Initialized\n`);

    ipc.of["world"].emit(
      "command",
      JSON.stringify({ env, cwd, prerun, instructions })
    );
  });

  ipc.of["world"].on("status", function (data) {
    logger.stdout(`status ${data.toString()}\n`);
  });
  ipc.of["world"].on("stdout", function (data) {
    const dataEscaped = removeAnsiControlChars(
      JSON.parse(JSON.stringify(data))
    );
    logger.stdout(dataEscaped);
  });
  ipc.of["world"].on("stderr", function (data) {
    logger.stderr(data);
  });
  ipc.of["world"].on("close", function (code) {
    process.exit(code || 0);
  });
  ipc.of["world"].on("error", function (err) {
    logger.stderr(`${err.toString()}\n`);
    process.exit(1);
  });
});
