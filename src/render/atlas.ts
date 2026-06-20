/**
 * Atlas types + browser loader (mspr render).
 *
 * The atlas is produced offline by tools/atlas/build-atlas.mjs from the shipped
 * SWF (FFDec sprite render -> alpha-crop -> shelf-pack). It is keyed by the SWF
 * clip/linkage name (physobjs[].graphics[].clip, roaddata billboard .mc,
 * caroffsets[].mcname) and carries, per 0-based frame, the page UV rect and the
 * bitmap-local pivot (the point that lands on the RenderObj (x,y)).
 */

export interface AtlasFrame {
  frame: number;
  x: number; y: number; w: number; h: number; // page px rect
  u0: number; v0: number; u1: number; v1: number; // normalised UVs
  pivotX: number; pivotY: number; // bitmap-local pivot (px)
}

export interface Atlas {
  meta: {
    page: string;
    pageW: number;
    pageH: number;
    gutter: number;
    [k: string]: unknown;
  };
  clips: Record<string, AtlasFrame[]>;
}

export function getFrame(atlas: Atlas, clip: string, frame: number): AtlasFrame {
  const frames = atlas.clips[clip];
  if (!frames) throw new Error(`atlas: unknown clip "${clip}"`);
  const f = frames[frame];
  if (!f) throw new Error(`atlas: clip "${clip}" has no frame ${frame} (0..${frames.length - 1})`);
  return f;
}

/** Load atlas.json + atlas.png (browser). `baseUrl` is the dir holding both. */
export async function loadAtlas(baseUrl: string): Promise<{ atlas: Atlas; image: HTMLImageElement }> {
  const atlas: Atlas = await fetch(`${baseUrl}/atlas.json`).then((r) => r.json());
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `${baseUrl}/${atlas.meta.page}`;
  });
  return { atlas, image };
}
