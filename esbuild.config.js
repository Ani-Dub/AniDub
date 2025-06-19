// esbuild.config.js
const esbuild = require("esbuild");
const dotenv = require("dotenv");
const fs = require("fs");

const copyFiles = () => {
  const manifest = fs.readFileSync("manifest.json");

  // Replace __ANIDUB_API_URL__ in manifest.json
  const apiUrl = env.ANIDUB_API_URL;

  const updatedManifest = manifest
    .toString()
    .replace(/__ANIDUB_API_URL__/g, apiUrl);

  fs.writeFileSync("dist/manifest.json", updatedManifest);

  fs.cpSync("src/public", "dist/src/public", { recursive: true, force: true });
  fs.cpSync("icons", "dist/icons", { recursive: true, force: true });
};

// Load .env
const env = dotenv.config().parsed || {};

// Map env variables to esbuild `define`
const define = {};
for (const k in env) {
  define[`__${k}__`] = JSON.stringify(env[k]);
}

esbuild
  .build({
    entryPoints: ["src/main.ts", "src/callback.ts"],
    bundle: false,
    outdir: "dist/src",
    define,
    sourcemap: true,
    target: ["chrome111"],
  })
  .catch(() => process.exit(1))
  .then(() => {
    copyFiles();
  });
