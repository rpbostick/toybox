// A minimal WebDriver BiDi client for headless Firefox: launch with a profile, send commands,
// run page functions. Node's built-in WebSocket is the transport, so no driver package is needed.
import { spawn } from "node:child_process";

export async function launchFirefox({ profile, port }) {
  const child = spawn("firefox", ["--headless", "--no-remote", "--profile", profile, `--remote-debugging-port=${port}`, "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] });
  const url = await new Promise((resolve, reject) => {
    let seen = "";
    const timer = setTimeout(() => reject(new Error(`Firefox did not start BiDi within 30 s:\n${seen}`)), 30000);
    child.stderr.on("data", chunk => {
      seen += chunk;
      const match = /WebDriver BiDi listening on (ws:\/\/\S+)/.exec(seen);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", code => reject(new Error(`Firefox exited with ${code} before BiDi started:\n${seen}`)));
  });
  const ws = new WebSocket(`${url}/session`);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`could not connect to ${url}/session`));
  });
  const session = new Session(ws, child);
  await session.send("session.new", { capabilities: { alwaysMatch: { unhandledPromptBehavior: { default: "accept" } } } });
  const tree = await session.send("browsingContext.getTree", {});
  session.context = tree.contexts[0].context;
  return session;
}

class Session {
  constructor(ws, child) {
    this.ws = ws;
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.onmessage = message => {
      const data = JSON.parse(message.data);
      if (data.type === "event") {
        this.events.push(data);
        return;
      }
      const waiting = this.pending.get(data.id);
      if (!waiting) return;
      this.pending.delete(data.id);
      if (data.type === "error") waiting.reject(new Error(`${waiting.method}: ${data.error}: ${data.message}`));
      else waiting.resolve(data.result);
    };
  }

  send(method, params) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  // Runs fn(...args) in the page and returns its JSON-serialisable result.
  run(fn, ...args) {
    return this.call(fn, args, false);
  }

  // The same, as if during a click: APIs that need a user action (the clipboard) are allowed.
  runActivated(fn, ...args) {
    return this.call(fn, args, true);
  }

  async call(fn, args, userActivation) {
    const result = await this.send("script.callFunction", {
      functionDeclaration: `async json => JSON.stringify((await (${fn.toString()})(...JSON.parse(json))) ?? null)`,
      arguments: [{ type: "string", value: JSON.stringify(args) }],
      target: { context: this.context },
      awaitPromise: true,
      userActivation
    });
    if (result.type === "exception") throw new Error(`page threw: ${result.exceptionDetails.text}`);
    return JSON.parse(result.result.value);
  }

  async element(selector) {
    return this.node(`document.querySelector(${JSON.stringify(selector)})`);
  }

  // A reference to the node a page expression returns (one inside a shadow root, say), for
  // commands such as a screenshot clipped to it.
  async node(expression) {
    const result = await this.send("script.evaluate", {
      expression,
      target: { context: this.context }, awaitPromise: false, resultOwnership: "root"
    });
    if (result.type !== "success" || result.result.type !== "node") throw new Error(`no element from ${expression}`);
    return { sharedId: result.result.sharedId };
  }

  async close() {
    try {
      await this.send("browser.close", {});
    } catch {
      // The browser closes the socket as it exits.
    }
    await new Promise(resolve => this.child.exitCode !== null ? resolve() : this.child.on("exit", resolve));
  }
}
