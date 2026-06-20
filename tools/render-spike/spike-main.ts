/**
 * Render the shared spike scene (scene.json) with the WebGL2 compositor.
 * Bundled by esbuild and run in headless Chrome (run-webgl.mjs). Exposes the
 * rendered 640x480 PNG as a data URL on window.__pngDataURL for the runner.
 */
import { Compositor, type ColorTransformLike, type BlendMode } from "../../src/render/index";
import { loadAtlas, getFrame } from "../../src/render/atlas";

interface SceneSprite {
  clip: string; frame: number; x: number; y: number; scale: number;
  dirDeg: number; xflip: boolean; blend: BlendMode;
  ct: { rm: number; gm: number; bm: number; am: number; ro: number; go: number; bo: number; ao: number } | null;
}
interface Scene {
  stage: { w: number; h: number };
  bg: [number, number, number];
  sprites: SceneSprite[];
}

function toCT(c: NonNullable<SceneSprite["ct"]>): ColorTransformLike {
  return {
    redMultiplier: c.rm, greenMultiplier: c.gm, blueMultiplier: c.bm, alphaMultiplier: c.am,
    redOffset: c.ro, greenOffset: c.go, blueOffset: c.bo, alphaOffset: c.ao,
  };
}

async function main() {
  const scene: Scene = await fetch("/scene.json").then((r) => r.json());
  const { atlas, image } = await loadAtlas("/assets");

  const canvas = document.getElementById("gl") as HTMLCanvasElement;
  canvas.width = scene.stage.w;
  canvas.height = scene.stage.h;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
  })!;

  const comp = new Compositor(gl, scene.stage.w, scene.stage.h);
  const tex = comp.createTexture(image, /*smooth=*/ false);

  const bg: [number, number, number, number] = [scene.bg[0] / 255, scene.bg[1] / 255, scene.bg[2] / 255, 1];
  comp.beginFrame(bg);
  for (const s of scene.sprites) {
    const f = getFrame(atlas, s.clip, s.frame);
    comp.drawSprite(
      tex, f,
      {
        x: s.x, y: s.y, scale: s.scale, dir: (s.dirDeg * Math.PI) / 180,
        pivotX: f.pivotX, pivotY: f.pivotY, xflip: s.xflip,
      },
      { blend: s.blend, colorTransform: s.ct ? toCT(s.ct) : null },
    );
  }
  comp.endFrame();
  gl.finish();

  (window as unknown as { __pngDataURL: string }).__pngDataURL = canvas.toDataURL("image/png");
  (window as unknown as { __done: boolean }).__done = true;
  console.log("[spike] rendered " + scene.sprites.length + " sprites");
}

main().catch((e) => {
  console.error("[spike] ERROR", e);
  (window as unknown as { __error: string }).__error = String(e && (e as Error).stack || e);
});
