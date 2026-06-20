import { defineConfig } from "vite";

// Web build for the running game. The renderer is a custom WebGL2 2D compositor
// (NOT OpenFL — see CLAUDE.md "The rendering reality"). The asset pipeline
// (SWF bitmaps → atlas) is owned by the render developer; wire its prebuild here
// once it exists.
export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    target: "es2020",
    outDir: "dist-web",
  },
});
