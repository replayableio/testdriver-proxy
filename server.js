const { spawn } = require("node:child_process");
const ipc = require("node-ipc").default;

ipc.config.id = "world";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "utf-8";
ipc.config.silent = true;
ipc.config.logDepth = 0; //default
ipc.config.logger = () => {};

const ci =
  "The next prompts will be a list of instructions. Consider the following notes for each instruction: If opening a browser, prioritize using google chrome in fullscreen unless otherwise instructed. Go as fast as you can. Your working directory is /Users/ec2-user/actions-runner/_work/testdriver/testdriver, check for files and code there first. DO NOT USE `screenshot.show()`. DO NOT USE APPLESCRIPT. It is perfectly fine to use coordinates as long as the coordinates were determined through a search and not a guess.";

function markdownToListArray(markdown) {
  // Normalize line breaks
  const normalizedMarkdown = markdown.replace(/\\n/g, "\n");

  console.log("normalizedMarkdown", normalizedMarkdown);

  // Split into lines, filter out non-list items, and remove the leading number and period
  const listItems = normalizedMarkdown
    .split("\n")
    .filter((line) => line.match(/^\d+\. /))
    .map((item) => {
      item = item.replace(/^\d+\. /, "");
      item = item.replace(/\\r/g, "");
      return item;
    }); // Remove the leading numbers and period

  return listItems;
}

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

  ipc.server.on("data", async (data, socket) => {
    await spawnShell(data, socket);
    spawnInterpreter(data, socket);
  });
});

let i = 0;
const spawnInterpreter = function (data, socket) {
  let child;
  let text;
  let step = 0;
  try {
    const args = JSON.parse(data.toString());
    text = args[0];

    console.log("args1", args[1]);

    child = spawn(
      `interpreter`,
      ["--os", "-ci", `"${ci}"`, "--api_key", args[1]],
      {
        env: { ...process.env }, // FORCE_COLOR: true,  will enable advanced rendering
        shell: true,
        windowsHide: true,
      }
    );
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

    if (stripAnsi(last(dataToSend.split("\n"))) === "> ") {
      console.log("!!!!!! > Detected");

      let data = text.split(" ");
      console.log("text is", text);
      console.log(text);

      list = markdownToListArray(text);

      // list.unshift(
      //   "The next prompts will be a list of instructions. Consider the following notes for each instruction: If opening a browser, prioritize using google chrome in fullscreen unless otherwise instructed. Go as fast as you can. Your working directory is /Users/ec2-user/actions-runner/_work/testdriver/testdriver, check for files and code there first."
      // );

      list.push(
        'Summarize the result of the the previous steps. You do not need to strictly comply with instruction steps for the test to pass. Workarounds are irrelevant to the test passing or failing. Say either "The test failed." or "The test passed.". Then in a new paragraph that is 3 sentences long explain how you came to that conclusion. Save this result into /tmp/oiResult.log'
      );
      console.log("!!!!!! list", list);

      if (!list[i]) {
        child.stdin.end();
        child.stdout.destroy();
        child.stderr.destroy();
        child.kill();
      } else {
        console.log("RUNNING COMMAND ", i);
        let command = list[i];
        child.stdin.write(`${command}\n`);
        dataToSend += command;
        i++;
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
};

const spawnShell = function (data, socket) {
  let child;
  let text;
  let step = 0;

  return new Promise((resolve, reject) => {
    try {
      const args = JSON.parse(data.toString());
      text = args[0];

      console.log(
        "spawning ",
        `source ~/actions-runner/_work/testdriver/testdriver/.testdriver/prerun.sh`
      );

      child = spawn(
        `source`,
        ["~/actions-runner/_work/testdriver/testdriver/.testdriver/prerun.sh"],
        {
          env: { ...process.env }, // FORCE_COLOR: true,  will enable advanced rendering
          shell: true,
          windowsHide: true,
        }
      );

      child.stdout.on("data", function (data) {
        console.log("Child data: " + data);
      });
      child.on("error", function () {
        console.log("Failed to start child.");
      });
      child.on("close", function (code) {});
      child.stdout.on("end", function () {
        // console.log("Finished collecting data chunks.");
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

    child.on("close", function (exitCode) {
      console.log("close", exitCode);
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: "Child process exited with code " + exitCode,
        })
      );
      resolve();
    });

    child.on("error", function (e) {
      console.log("error", e);
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: e.toString(),
        })
      );
      reject();
    });

    child.stdout.on("data", async (data) => {
      console.log(data);
      let dataToSend = data.toString();

      console.log("dataToSend", dataToSend);

      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stdout",
          message: dataToSend,
        })
      );

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
        reject();
      });
    });
  });
};

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
