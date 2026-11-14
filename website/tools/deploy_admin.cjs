#!/usr/bin/env node
// Compatibility bridge for Firebase Hosting's existing Next.js adapter.
// Select Webpack and exclude local dev/build caches; never touch the developer's .next/dev.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'school-dash');
const cli = process.argv[2] || process.env.FIREBASE_CLI_ENTRY;
if (!cli || !fs.existsSync(cli)) {
  console.error('Usage: node tools/deploy_admin.cjs /absolute/path/to/firebase-tools/lib/bin/firebase.js');
  process.exit(2);
}
const resolveCli = createRequire(path.resolve(cli));
const spawn = resolveCli('cross-spawn');
const originalSpawn = spawn.spawn;
spawn.spawn = (command, args, options) => originalSpawn(command,
  String(command).endsWith('/next') && args?.[0] === 'build' && path.resolve(options?.cwd || '') === app
    ? [...args, '--webpack'] : args, options);
const nextUtils = require(path.resolve(path.dirname(cli), '../frameworks/next/utils.js'));
if (typeof nextUtils.getProductionDistDirFiles !== 'function') throw new Error('This Firebase CLI adapter changed. Review the deployment bridge before using it.');
const originalFiles = nextUtils.getProductionDistDirFiles;
nextUtils.getProductionDistDirFiles = async (source, distDir) => {
  const files = await originalFiles(source, distDir);
  return path.resolve(source) === app ? files.filter(file => !/^(dev|cache)(\/|$)/.test(file)) : files;
};
// Remove only copied caches left by an interrupted packaging attempt.
const project = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects.default;
if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project || '')) throw new Error('Choose a valid Firebase project ID in .firebaserc.');
const generated = path.join(root, '.firebase', project, 'functions', '.next');
if (fs.existsSync(generated) && fs.realpathSync(generated) !== generated) throw new Error('Refusing to clean caches through a linked deployment directory.');
for (const name of ['dev', 'cache']) fs.rmSync(path.join(generated, name), { recursive: true, force: true });
process.chdir(root);
process.env.FUNCTIONS_DISCOVERY_TIMEOUT ||= '60';
process.argv = [process.execPath, path.resolve(cli), 'deploy', '--only', 'hosting:admin', '--project', project, '--non-interactive'];
require(path.resolve(cli));
