import child_process from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

import tsconfig from "./tsconfig.json";

const commitHash = child_process.execSync("git rev-parse --short HEAD").toString();
console.log({ commitHash, EXT: process.env.EXT });

const kitLocalPath = path.resolve(__dirname, "../src");
const useLocalKit = process.env.NODE_ENV !== "production" && existsSync(kitLocalPath);
if (!useLocalKit) {
  // @ts-expect-error: delete paths from tsconfig
  delete tsconfig.compilerOptions.paths;
}

export default defineConfig({
  plugins: [nodePolyfills(), react()],
  base: "/hot-connector/",
  resolve: {
    alias: useLocalKit ? { "@hot-labs/kit": kitLocalPath } : {},
  },
});
