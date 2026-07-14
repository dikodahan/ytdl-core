#!/usr/bin/env node
"use strict";

const path = require("path");
const serverPath = path.join(__dirname, "..", "lib", "web", "server.js");

try {
  require(serverPath).startWebServer({
    host: process.env.YTDL_WEB_HOST || "127.0.0.1",
    port: Number(process.env.YTDL_WEB_PORT || 8787),
  });
} catch (err) {
  if (err.code === "MODULE_NOT_FOUND") {
    console.error("Built server not found. Run `pnpm run build` first.");
  }
  throw err;
}
