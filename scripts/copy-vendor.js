const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src", "extractor", "youtube", "jsc", "vendor");
const dest = path.join(__dirname, "..", "lib", "extractor", "youtube", "jsc", "vendor");

fs.mkdirSync(dest, { recursive: true });
for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

// Copy plain JS worker (not compiled by tsc)
const workerSrc = path.join(__dirname, "..", "src", "extractor", "youtube", "jsc", "ejs-worker.js");
const workerDest = path.join(__dirname, "..", "lib", "extractor", "youtube", "jsc", "ejs-worker.js");
fs.copyFileSync(workerSrc, workerDest);

console.log(`Copied EJS vendor scripts → ${dest}`);
