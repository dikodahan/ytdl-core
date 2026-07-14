/**
 * Isolated worker for EJS n/sig solving.
 * Player JS throws must not kill the main process / web UI.
 */
const { parentPort, workerData } = require("worker_threads");
const vm = require("vm");

function main() {
  const { lib, core, player, requests } = workerData;
  const data = {
    type: "player",
    player,
    requests,
    output_preprocessed: false,
  };

  const logs = [];
  const sandbox = {
    console: {
      log: (...args) => logs.push(args.map(String).join(" ")),
      warn: () => {},
      error: () => {},
      info: () => {},
      debug: () => {},
    },
    JSON,
  };

  try {
    const ctx = vm.createContext(sandbox);
    const stdin = `${lib}
Object.assign(globalThis, lib);
${core}
(function () {
  try {
    console.log(JSON.stringify(jsc(${JSON.stringify(data)})));
  } catch (err) {
    console.log(JSON.stringify({
      type: 'error',
      error: (err && err.message) ? (err.message + '\\n' + (err.stack || '')) : String(err)
    }));
  }
})();
`;
    vm.runInContext(stdin, ctx, { timeout: 55_000 });
    const raw = logs[logs.length - 1];
    if (!raw) {
      parentPort.postMessage({ error: "EJS solver produced no output" });
      return;
    }
    parentPort.postMessage({ result: JSON.parse(raw) });
  } catch (err) {
    parentPort.postMessage({ error: err && err.message ? err.message : String(err) });
  }
}

main();
