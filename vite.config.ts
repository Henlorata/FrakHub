import path from "node:path";
import {defineConfig, loadEnv} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {vercelApiDev} from "./tooling/vite-vercel-api.ts";

// https://vite.dev/config/
export default defineConfig(({command, mode}) => {
  if (command === "serve") {
    // The locally served API functions read server-side secrets from process.env,
    // so expose every .env variable to them (not only the VITE_-prefixed ones).
    const env = loadEnv(mode, import.meta.dirname, "");
    for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  }

  return {
    plugins: [react(), tailwindcss(), vercelApiDev()],
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
