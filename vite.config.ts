import path from "node:path";
import {defineConfig, loadEnv, type Plugin} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {vercelApiDev} from "./tooling/vite-vercel-api.ts";

// The build's id. An open tab compares it with /version.json to notice a newer deploy (src/lib/app-version.ts).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || Date.now().toString(36);

const appVersion = (): Plugin => ({
  name: "app-version",
  apply: "build",
  generateBundle() {
    this.emitFile({type: "asset", fileName: "version.json", source: JSON.stringify({build: BUILD_ID})});
  },
});

// https://vite.dev/config/
export default defineConfig(({command, mode}) => {
  if (command === "serve") {
    // The locally served API functions read server-side secrets from process.env,
    // so expose every .env variable to them (not only the VITE_-prefixed ones).
    const env = loadEnv(mode, import.meta.dirname, "");
    for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  }

  return {
    plugins: [react(), tailwindcss(), vercelApiDev(), appVersion()],
    define: {__APP_BUILD__: JSON.stringify(BUILD_ID)},
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
      },
    },
    build: {
      // The only chunk above Vite's 500 kB default is the BlockNote editor (~280 kB gzip),
      // which is lazy-loaded on the case and academy pages only.
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Libraries that rarely change get their own long-lived chunks, so a new
            // deploy only invalidates application code in returning visitors' caches.
            groups: [
              {
                name: "react-vendor",
                test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
                priority: 3,
              },
              {name: "supabase", test: /node_modules[\\/]@supabase[\\/]/, priority: 2},
            ],
          },
        },
      },
    },
  };
});
