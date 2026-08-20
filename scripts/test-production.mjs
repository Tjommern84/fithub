import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.TEST_PORT ?? '3100';
const baseUrl = `http://127.0.0.1:${port}`;
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Produksjonsserveren stoppet med kode ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/robots.txt`);
      if (response.ok) return;
    } catch {
      // Serveren starter fortsatt.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Produksjonsserveren ble ikke klar innen ${timeoutMs / 1_000} sekunder`);
}

const server = spawn(
  process.execPath,
  [nextBin, 'start', '--hostname', '127.0.0.1', '--port', port],
  {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);

server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

let exitCode = 1;

try {
  await waitForServer(server);

  const smoke = spawn(process.execPath, [join(root, 'scripts', 'smoke-test.mjs')], {
    cwd: root,
    env: { ...process.env, SMOKE_BASE_URL: baseUrl },
    stdio: 'inherit',
    windowsHide: true,
  });

  const result = await waitForExit(smoke);
  exitCode = result.code ?? 1;
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([
      waitForExit(server),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}

process.exitCode = exitCode;
