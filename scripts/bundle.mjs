import { mkdir } from "node:fs/promises";
import * as esbuild from "esbuild";

await mkdir("api", { recursive: true });

await esbuild.build({
  entryPoints: ["src/check.ts"],
  outfile: "api/check.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
});
