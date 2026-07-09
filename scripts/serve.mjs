import { spawn } from 'child_process';

const START_CMD = 'npx';
const START_ARGS = ['next', 'start', '--port', '3000'];

function start() {
  console.log(`[${new Date().toISOString()}] Starting server...`);
  const child = spawn(START_CMD, START_ARGS, {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=384' }
  });

  child.on('exit', (code) => {
    console.log(`[${new Date().toISOString()}] Server exited (code ${code}). Restarting in 2s...`);
    setTimeout(start, 2000);
  });

  child.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    setTimeout(start, 2000);
  });
}

start();