#!/usr/bin/env node

if (process.argv.length === 2) {
  console.error("Expected at least one argument!");
  process.exit(1);
}

if (process.argv[2] === "start-server") {
  console.log("starting server");
  require("./server.js");
} else {
  require("./client.js");
}
