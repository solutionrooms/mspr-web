/**
 * Render the level-0 road with the WebGL2 road raster (P3). Builds the RoadSeg[] from
 * real level data, projects at a camera position (camera.y=150 = normal_camera_yoffset),
 * and rasters bg + road + edges. Bundled by esbuild, run in headless Chrome; exposes the
 * 640x480 PNG on window.__pngDataURL for the runner.
 */
import { Compositor } from "../../src/render/index";
import { buildRoadSegs, ROAD_BUILD_DEFAULTS } from "../../src/render/road-build";
import { buildDrawSegs, ROAD_DEFAULTS } from "../../src/render/road-projection";
import { renderRoad, type RoadTextures } from "../../src/render/road-render";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function main() {
  const params = new URLSearchParams(location.search);
  const camZ = +(params.get("z") ?? 1600);
  const camY = +(params.get("y") ?? 150);
  const camX = +(params.get("x") ?? 0);

  const levels = await fetch("/data/levels.json").then((r) => r.json());
  const roaddata = await fetch("/data/roaddata.json").then((r) => r.json());
  const texMeta = await fetch("/assets/road/road-textures.json").then((r) => r.json());
  const lv = levels[0];

  const surfaceIdx = new Map<string, number>(roaddata.roadsurfaces.map((s: any, i: number) => [s.name, i]));
  const edgeIdx = new Map<string, number>(roaddata.edgesegments.map((e: any, i: number) => [e.name, i]));

  const segs = buildRoadSegs(
    lv.road.blocks,
    (n: string) => surfaceIdx.get(n) ?? 0,
    (n: string) => edgeIdx.get(n) ?? 0,
    (n: string) => edgeIdx.has(n),
    ROAD_BUILD_DEFAULTS,
  );
  const dr = buildDrawSegs(segs, { x: camX, y: camY, z: camZ }, ROAD_DEFAULTS, 640, 480);

  const canvas = document.getElementById("gl") as HTMLCanvasElement;
  canvas.width = 640; canvas.height = 480;
  const gl = canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false })!;
  const comp = new Compositor(gl, 640, 480);

  // load textures (roadtex/sidetex REPEAT-tiled on V; bg CLAMP)
  const mkArr = async (name: string, frames: number[], repeat: boolean) => {
    const arr: (WebGLTexture | null)[] = [];
    for (const f of frames) arr[f] = comp.createTexture(await loadImg(`/assets/road/${name}_${f}.png`), false, repeat);
    return arr;
  };
  const tex: RoadTextures = {
    roadtex: await mkArr("roadtex", texMeta.textures.roadtex, true),
    sidetex: await mkArr("sidetex", texMeta.textures.sidetex, true),
    bg: await mkArr("bg", texMeta.textures.bg, false),
    surfaceFrameByIndex: texMeta.surfaceFrameByIndex,
    edgeFrameByIndex: texMeta.edgeFrameByIndex,
  };

  comp.beginFrame([0, 0, 0, 1]);
  renderRoad(comp, dr, tex, {
    bgFrame: 1, parallaxX: 0, bgYPos: 300,
    skyColor: [0.06, 0.5, 1, 1],     // coast sky blue
    groundColor: [0, 0.93, 0.93, 1], // coast sea cyan
    consts: ROAD_DEFAULTS, edges: true,
  });
  comp.endFrame();
  gl.finish();

  (window as any).__pngDataURL = canvas.toDataURL("image/png");
  (window as any).__done = true;
  console.log(`[road-spike] rendered ${dr.count} draw segs @ cam(${camX},${camY},${camZ})`);
}

main().catch((e) => { console.error("[road-spike] ERROR", e); (window as any).__error = String((e as Error)?.stack || e); });
