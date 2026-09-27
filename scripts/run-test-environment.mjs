import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testEnvironmentPath = resolve(repositoryRoot, '.env.test.local');
const configurationMessage =
  'Test database configuration error: .env.test.local must contain a DATABASE_URL whose database name ends in _test.\n';

function failConfiguration() {
  process.stderr.write(configurationMessage);
  process.exit(1);
}

async function loadTestDatabaseUrl() {
  let contents;

  try {
    contents = await readFile(testEnvironmentPath, 'utf8');
  } catch {
    failConfiguration();
  }

  const databaseUrl = parseEnv(contents).DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl === '') {
    failConfiguration();
  }

  try {
    const url = new URL(databaseUrl);
    const databaseName = decodeURIComponent(url.pathname).replace(/^\/+/, '');

    if (
      (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
      databaseName.includes('/') ||
      !databaseName.endsWith('_test')
    ) {
      failConfiguration();
    }
  } catch {
    failConfiguration();
  }

  return databaseUrl;
}

const [command, ...argumentsForCommand] = process.argv.slice(2);
if (command === undefined || command.trim() === '') {
  process.stderr.write('A command is required after run-test-environment.mjs.\n');
  process.exit(1);
}

const databaseUrl = await loadTestDatabaseUrl();
const windowsCommand = process.platform === 'win32' && (command === 'pnpm' || command === 'turbo');
const executable = command === 'node' ? process.execPath : windowsCommand ? process.env.ComSpec ?? 'cmd.exe' : command;
const quoteWindowsCommandArgument = (argument) => /^[A-Za-z0-9_./:@=+-]+$/.test(argument)
  ? argument
  : `"${argument.replaceAll('"', '""')}"`;
const childArguments = windowsCommand
  ? ['/d', '/s', '/c', `${command}.cmd ${argumentsForCommand.map(quoteWindowsCommandArgument).join(' ')}`]
  : argumentsForCommand;
const child = spawn(executable, childArguments, {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'inherit',
});

child.once('error', () => {
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
