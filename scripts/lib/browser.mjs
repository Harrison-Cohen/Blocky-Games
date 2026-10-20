// Drives a real Chrome from Node with no packages: the installed Chrome, started
// headless with a remote debugging port, spoken to over the DevTools protocol
// with Node's own fetch and WebSocket. It exists so the game can be LOOKED AT --
// screenshots of the real WebGL render, the page console, and JavaScript run in
// the page -- by a script, with nobody at the screen.
//
//   const b = await launch({ url: 'http://localhost:5173', width: 1440, height: 900 });
//   await b.eval('game.onFly()');           // run JavaScript in the page
//   await b.shot('/tmp/out.png');           // write a screenshot
//   console.log(b.console);                 // everything the page logged
//   await b.close();
//
// Needs the dev server running (npm run dev) and Google Chrome installed.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXED = { ShiftLeft: 16, ShiftRight: 16, Space: 32, Escape: 27, Enter: 13, Tab: 9, Backquote: 192,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Comma: 188, Period: 190, Slash: 191 };
function virtualKey(code) {
  if (FIXED[code]) return FIXED[code];
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  return 0;
}

export async function launch({ url, width = 1440, height = 900, port = 9333, args = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'chrome-shot-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', ...args, 'about:blank',
  ], { stdio: 'ignore' });

  // Wait for the debugging port, then open a page.
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill(); throw new Error('Chrome did not start'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push(`EXCEPTION: ${d.exception?.description || d.text} (${d.url || ''}:${d.lineNumber})`);
    } else if (m.method === 'Log.entryAdded') {
      logs.push(`${m.params.entry.level}: ${m.params.entry.text} ${m.params.entry.url || ''}`);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (url) {
    await send('Page.navigate', { url });
    await sleep(1500);
  }

  return {
    console: logs,
    send,
    async eval(expression, { timeout = 60000 } = {}) {
      const r = await Promise.race([
        send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
        sleep(timeout).then(() => { throw new Error('eval timed out'); }),
      ]);
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      }
      return r.result.value;
    },
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.data, 'base64'));
      return path;
    },
    // type is 'keyDown' or 'keyUp'; code is a KeyboardEvent.code ('KeyW',
    // 'ArrowUp', 'ShiftLeft', 'Space'). Chrome ignores a key with no virtual key
    // code, so one is worked out.
    async key(type, code, key = code) {
      await send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: virtualKey(code) });
    },
    sleep,
    async close() {
      try { ws.close(); } catch { /* gone */ }
      proc.kill('SIGKILL');
      await sleep(300);
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* fine */ }
    },
  };
}
