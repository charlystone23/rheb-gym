const { spawn } = require("child_process");

const children = [];
let shuttingDown = false;

function run(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    shutdown(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    if (shuttingDown) return;
    shuttingDown = true;
    shutdown(1);
  });

  children.push(child);
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("backend", "npm", ["--prefix", "backend", "run", "dev"], process.cwd());
run("frontend", "npm", ["--prefix", "frontend/vite-project", "run", "dev", "--", "--host", "0.0.0.0"], process.cwd());
