import puppeteer from "puppeteer";
const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setContent('<canvas id="c" width="64" height="64"></canvas>');
const info = await page.evaluate(() => {
  const gl = document.getElementById("c").getContext("webgl2");
  if (!gl) return { webgl2:false };
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    webgl2:true,
    version: gl.getParameter(gl.VERSION),
    glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "n/a",
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
});
console.log(JSON.stringify(info,null,2));
await browser.close();
