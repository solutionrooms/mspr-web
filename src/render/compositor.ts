/**
 * WebGL2 2D compositor (mspr render) — software-faithful sprite batcher.
 *
 * Reproduces the shipped game's SOFTWARE renderer (Game.Render + DisplayObjFrame
 * blits) on WebGL2. Batcher MECHANICS follow the dead-code Stage3D path s3d.as
 * (interleaved VBO, ortho top-left/Y-down 640x480, texture x vertexColor shader,
 * flush-on-state-change); visual SEMANTICS follow the software DisplayObjFrame /
 * particle paths (the 3 hard things: blend modes, full ColorTransform, anchors).
 *
 *  - Projection: ortho, origin top-left, Y-DOWN, 640x480 (s3d.as:159-165). Baked
 *    in the vertex shader: clip = (px/W*2-1, 1-py/H*2).
 *  - Vertex (interleaved, 48B): [posX,posY f32][u,v f32][mult rgba f32][offset rgba f32].
 *    Per-vertex ColorTransform so batching survives CT changes (s3d only baked
 *    offset-as-tint + dropped the alpha multiplier — RENDER_DEV.md #2; we carry both).
 *  - ColorTransform: out = clamp(texel*mult + offset, 0,1) on STRAIGHT alpha, then
 *    premultiplied for the blend (DisplayObjFrame passes a full ColorTransform).
 *  - Blend: 'normal' = premult over (ONE, 1-SRC_A); 'add' = (ONE, ONE) on premult
 *    (Ruffle ADD = premult src + dst, saturating). DisplayObjFrame's additive path
 *    passes colorTransform=null (DisplayObjFrame.as:346) — callers shouldn't tint adds.
 *    'layer'/'overlay' have no fixed-function equivalent (TODO: shader/FBO read).
 */
import type { AtlasFrame } from "./atlas";
import { computeQuad, type SpritePlacement } from "./sprite-transform";

export type BlendMode = "normal" | "add" | "layer" | "overlay";

export interface ColorTransformLike {
  redMultiplier: number;
  greenMultiplier: number;
  blueMultiplier: number;
  alphaMultiplier: number;
  redOffset: number; // Flash 0..255 range
  greenOffset: number;
  blueOffset: number;
  alphaOffset: number;
}

export interface DrawOpts {
  blend?: BlendMode;
  colorTransform?: ColorTransformLike | null;
}

const IDENTITY_CT: ColorTransformLike = {
  redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1,
  redOffset: 0, greenOffset: 0, blueOffset: 0, alphaOffset: 0,
};

const FLOATS_PER_VERT = 12; // pos2 + uv2 + mult4 + offset4
const VERTS_PER_QUAD = 4;
const MAX_QUADS = 4096;

const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aMult;
layout(location=3) in vec4 aOffset;
uniform vec2 uViewport;
out vec2 vUV;
out vec4 vMult;
out vec4 vOffset;
void main() {
  // ortho: top-left origin, y-down -> clip space (s3d.as:159-165)
  vec2 clip = vec2(aPos.x / uViewport.x * 2.0 - 1.0,
                   1.0 - aPos.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUV = aUV;
  vMult = aMult;
  vOffset = aOffset;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vMult;
in vec4 vOffset;
uniform sampler2D uTex;
out vec4 fragColor;
void main() {
  vec4 texel = texture(uTex, vUV);          // straight RGBA
  vec4 c = clamp(texel * vMult + vOffset, 0.0, 1.0); // full ColorTransform
  fragColor = vec4(c.rgb * c.a, c.a);       // premultiplied for the blend
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("shader compile: " + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class Compositor {
  readonly gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private ibo: WebGLBuffer;
  private uViewport: WebGLUniformLocation;
  private verts: Float32Array;
  private quadCount = 0;
  private curTex: WebGLTexture | null = null;
  private curBlend: BlendMode = "normal";
  readonly width: number;
  readonly height: number;

  constructor(gl: WebGL2RenderingContext, width = 640, height = 480) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.verts = new Float32Array(MAX_QUADS * VERTS_PER_QUAD * FLOATS_PER_VERT);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("program link: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    this.uViewport = gl.getUniformLocation(prog, "uViewport")!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.verts.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);

    // static index buffer: quad winding [0,1,2, 1,3,2] (s3d.as / MakeVertexBuffer)
    const idx = new Uint16Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4;
      const o = q * 6;
      idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
      idx[o + 3] = v + 1; idx[o + 4] = v + 3; idx[o + 5] = v + 2;
    }
    this.ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  /** Upload an image as a STRAIGHT-alpha texture. NEAREST by default (cars render
   *  smoothing=false, GameObj.as:910); CLAMP by default — `repeat` enables REPEAT wrap
   *  for the road surface/edge textures that tile on V (WebGL2 allows NPOT REPEAT, but
   *  roadtex/sidetex are 256² POT anyway). */
  createTexture(src: TexImageSource, smooth = false, repeat = false): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const filter = smooth ? gl.LINEAR : gl.NEAREST;
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return tex;
  }

  beginFrame(clear: [number, number, number, number] = [0, 0, 0, 0]): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uViewport, this.width, this.height);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    this.quadCount = 0;
    this.curTex = null;
  }

  /** Queue one sprite. Flushes first if the texture or blend mode changes. */
  drawSprite(tex: WebGLTexture, frame: AtlasFrame, placement: Omit<SpritePlacement, "w" | "h">, opts: DrawOpts = {}): void {
    const q = computeQuad({ ...placement, w: frame.w, h: frame.h });
    // corners [TL,TR,BL,BR] paired with [u0v0, u1v0, u0v1, u1v1]
    this.drawQuad(
      tex,
      [q.x0, q.y0, q.x1, q.y1, q.x2, q.y2, q.x3, q.y3],
      [frame.u0, frame.v0, frame.u1, frame.v0, frame.u0, frame.v1, frame.u1, frame.v1],
      opts,
    );
  }

  /**
   * Queue an arbitrary textured quad — explicit screen-space corners + UVs, in the
   * winding [TL, TR, BL, BR] (matches the static index buffer [0,1,2, 1,3,2]). Used by
   * the road raster (trapezoid road/edge strips with REPEAT-tiled V). Flushes on
   * texture/blend change. `pos`/`uv` are 8-length [x0,y0, x1,y1, x2,y2, x3,y3].
   */
  drawQuad(tex: WebGLTexture, pos: ArrayLike<number>, uv: ArrayLike<number>, opts: DrawOpts = {}): void {
    const blend = opts.blend ?? "normal";
    if (this.quadCount > 0 && (tex !== this.curTex || blend !== this.curBlend || this.quadCount >= MAX_QUADS)) {
      this.flush();
    }
    this.curTex = tex;
    this.curBlend = blend;

    const ct = opts.colorTransform ?? IDENTITY_CT;
    const mr = ct.redMultiplier, mg = ct.greenMultiplier, mb = ct.blueMultiplier, ma = ct.alphaMultiplier;
    const or = ct.redOffset / 255, og = ct.greenOffset / 255, ob = ct.blueOffset / 255, oa = ct.alphaOffset / 255;

    const base = this.quadCount * VERTS_PER_QUAD * FLOATS_PER_VERT;
    const v = this.verts;
    for (let i = 0; i < 4; i++) {
      const o = base + i * FLOATS_PER_VERT;
      v[o] = pos[i * 2]; v[o + 1] = pos[i * 2 + 1]; v[o + 2] = uv[i * 2]; v[o + 3] = uv[i * 2 + 1];
      v[o + 4] = mr; v[o + 5] = mg; v[o + 6] = mb; v[o + 7] = ma;
      v[o + 8] = or; v[o + 9] = og; v[o + 10] = ob; v[o + 11] = oa;
    }
    this.quadCount++;
  }

  /** Queue a flat-colour quad (sky/ground bands). Uses a 1×1 white texel × vertex
   *  colour: pass the colour as the ColorTransform offset with a zero multiplier. */
  drawSolidQuad(pos: ArrayLike<number>, rgba: [number, number, number, number]): void {
    if (!this.whiteTex) this.whiteTex = this.makeWhiteTex();
    this.drawQuad(this.whiteTex, pos, [0, 0, 1, 0, 0, 1, 1, 1], {
      blend: "normal",
      colorTransform: {
        redMultiplier: 0, greenMultiplier: 0, blueMultiplier: 0, alphaMultiplier: 0,
        redOffset: rgba[0] * 255, greenOffset: rgba[1] * 255, blueOffset: rgba[2] * 255, alphaOffset: rgba[3] * 255,
      },
    });
  }

  private whiteTex: WebGLTexture | null = null;
  private makeWhiteTex(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return tex;
  }

  private applyBlend(): void {
    const gl = this.gl;
    switch (this.curBlend) {
      case "add":
        gl.blendFunc(gl.ONE, gl.ONE); // premult additive (Ruffle ADD)
        break;
      case "normal":
      case "layer":   // TODO: real layer/overlay need shader/FBO read
      case "overlay":
      default:
        gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }
  }

  flush(): void {
    if (this.quadCount === 0) return;
    const gl = this.gl;
    const floats = this.quadCount * VERTS_PER_QUAD * FLOATS_PER_VERT;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.verts.subarray(0, floats));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.curTex);
    this.applyBlend();
    gl.drawElements(gl.TRIANGLES, this.quadCount * 6, gl.UNSIGNED_SHORT, 0);
    this.quadCount = 0;
  }

  endFrame(): void {
    this.flush();
    this.gl.bindVertexArray(null);
  }
}
