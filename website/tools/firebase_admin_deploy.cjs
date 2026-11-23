#!/usr/bin/env node
// Deployment compatibility for Next 16.4 and firebase-tools 15.37.0.
// Run from website with the pinned Firebase CLI on PATH (see docs/CERTIFICATES.md).
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

function prepare(firebaseBin) {
  const cliRoot = path.resolve(path.dirname(fs.realpathSync(firebaseBin)), "../..");
  const req = createRequire(path.join(cliRoot, "package.json"));
  if (req("./package.json").version !== "15.37.0") {
    throw new Error("Use firebase-tools@15.37.0 for this tested deployment wrapper.");
  }
  const crossSpawn = req("cross-spawn"), spawn = crossSpawn.spawn;
  crossSpawn.spawn = function (command, args, options) {
    if (/(?:^|\/)next(?:\.cmd)?$/.test(command) && args?.[0] === "build" && !args.includes("--webpack")) {
      args = [...args, "--webpack"];
    }
    return spawn.call(this, command, args, options);
  };

  // The adapter's stream parser can produce nested arrays of dependency names.
  const esbuildPath = require.resolve("esbuild", { paths: [process.cwd(), cliRoot] });
  const esbuild = require(esbuildPath);
  require.cache[esbuildPath].exports = { ...esbuild, build(options) {
    if (Array.isArray(options.external)) {
      options = { ...options, external: [...new Set(options.external.flat(Infinity).filter((name) => typeof name === "string"))] };
    }
    return esbuild.build(options);
  } };
  const nextUtils = req("./lib/frameworks/next/utils");
  nextUtils.findEsbuildPath = () => esbuildPath;
  const files = nextUtils.getProductionDistDirFiles;
  nextUtils.getProductionDistDirFiles = async (...args) => (await files(...args))
    .filter((file) => !/^(?:dev|cache|diagnostics|types)(?:[\\/]|$)/.test(file));
  const adapter = req("./lib/frameworks/next/index"), codegen = adapter.ɵcodegenFunctionsDirectory;
  adapter.ɵcodegenFunctionsDirectory = async (...args) => {
    const result = await codegen(...args);
    result.packageJson.engines = { ...result.packageJson.engines, node: "22" };
    return result;
  };
}

if (require.main === module) {
  try {
    const firebaseBin = (process.env.PATH || "").split(path.delimiter).map((dir) => path.join(dir, "firebase"))
      .find((file) => fs.existsSync(file));
    if (!firebaseBin) throw new Error("Run with npx --yes --package firebase-tools@15.37.0 -- node tools/firebase_admin_deploy.cjs …");
    prepare(firebaseBin);
    process.argv[1] = fs.realpathSync(firebaseBin);
    require(process.argv[1]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
