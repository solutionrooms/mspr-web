import { defineConfig } from "vite";

// Web build = the live demo in web/ (currently the bit-exact engine running a
// freefall fountain; will grow into the playable game as the renderer lands).
// base: "./" so assets resolve under the GitHub Pages project path /mspr-web/.
export default defineConfig({
  root: "web",
  base: "./",
  build: {
    target: "es2020",
    outDir: "../dist-web",
    emptyOutDir: true,
  },
});
