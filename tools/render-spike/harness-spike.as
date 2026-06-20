package
{
   import flash.display.Bitmap;
   import flash.display.BitmapData;
   import flash.display.BlendMode;
   import flash.display.MovieClip;
   import flash.display.StageAlign;
   import flash.display.StageScaleMode;
   import flash.events.Event;
   import flash.geom.ColorTransform;
   import flash.geom.Matrix;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.utils.getDefinitionByName;

   // mspr RENDER-PARITY harness — injected as the document class `Preloader` via
   // `ffdec -replace` into a copy of mspaintracer.swf, run under Ruffle headless.
   // FULLY SYNCHRONOUS (ffdec's bundled AS3 compiler rejects closures/JSON): it
   // rasterises the shipped `Cars` / `fx_nitro` symbol clips (raster
   // DefineBitsLossless art — the SAME pixels the offline atlas packs), alpha-crops
   // them like build-atlas.mjs (getColorBoundsRect), and composites the SHARED
   // spike scene with the EXACT DisplayObjFrame matrices + ColorTransform + blend
   // modes (DisplayObjFrame.as:306-348, Preparing.as:153). The WebGL2 compositor
   // renders the SAME scene from the SAME atlas; a pixel diff isolates compositor
   // math (anchor/ortho, rot+scale+xflip, full ColorTransform, additive blend).
   //
   // SCENE BELOW MUST MATCH tools/render-spike/scene.json.
   public class Preloader extends MovieClip
   {
      private var frames:int = 0;

      public function Preloader()
      {
         super();
         if(stage)
         {
            stage.scaleMode = StageScaleMode.NO_SCALE;
            stage.align = StageAlign.TOP_LEFT;
         }
         // We replaced the *document* class, which is constructed EARLY (the shipped
         // Preloader streams while later frames define art). `Cars`/`fx_nitro` are
         // linked by a SymbolClass tag near the end of the timeline, so poll on
         // ENTER_FRAME (letting the main timeline advance) until they resolve.
         this.addEventListener(Event.ENTER_FRAME, this.onEnterFrame);
      }

      private function onEnterFrame(e:Event) : void
      {
         this.frames++;
         if(!this.defined("Cars") || !this.defined("fx_nitro"))
         {
            if(this.frames > 600) { this.removeEventListener(Event.ENTER_FRAME, this.onEnterFrame); trace("[ERR] symbols never defined after " + this.frames + " frames"); }
            return;
         }
         this.removeEventListener(Event.ENTER_FRAME, this.onEnterFrame);
         try { this.render(); trace("[READY]"); }
         catch(err:Error) { trace("[ERR] " + err.toString()); }
      }

      private function defined(name:String) : Boolean
      {
         try { return getDefinitionByName(name) != null; }
         catch(e:Error) { return false; }
      }

      // Instantiate a SWF symbol clip by its SymbolClass linkage name (the ffdec-
      // replaced ABC has no compile-time binding, so resolve at runtime).
      private function makeClip(name:String) : MovieClip
      {
         var cls:Class = getDefinitionByName(name) as Class;
         return new cls() as MovieClip;
      }

      // Rasterise a symbol clip frame (0-based) to a tight alpha-cropped BitmapData,
      // content at (0,0) — identical to build-atlas.mjs's FFDec-render + alpha-crop.
      private function bakeClip(clip:MovieClip, frame0:int) : BitmapData
      {
         clip.gotoAndStop(frame0 + 1);
         var r:Rectangle = clip.getBounds(clip);
         // render on a canvas sized to the clip bounds, registration (0,0) -> (-r.x,-r.y)
         var w:int = Math.ceil(r.x + r.width) + 2;
         var h:int = Math.ceil(r.y + r.height) + 2;
         var full:BitmapData = new BitmapData(Math.max(w, 1), Math.max(h, 1), true, 0);
         full.draw(clip);
         // alpha-crop (mask alpha channel, find non-transparent) -> tight box at (0,0)
         var box:Rectangle = full.getColorBoundsRect(0xFF000000, 0x00000000, false);
         if(box.width < 1 || box.height < 1) box = new Rectangle(0, 0, 1, 1);
         var crop:BitmapData = new BitmapData(int(box.width), int(box.height), true, 0);
         crop.copyPixels(full, box, new Point(0, 0));
         return crop;
      }

      // DisplayObjFrame.RenderAtRotScaled (DisplayObjFrame.as:306). xoff=-pivotX,
      // yoff=-pivotY (Preparing.as:153). p maps to (x,y): screen = s*R*(p-pivot)+(x,y).
      private function matNormal(xoff:Number, yoff:Number, x:Number, y:Number, scale:Number, dir:Number) : Matrix
      {
         var m:Matrix = new Matrix();
         m.translate(xoff, yoff);
         m.rotate(dir);
         m.translate(-xoff, -yoff);
         m.scale(scale, scale);
         m.translate(x + xoff * scale, y + yoff * scale);
         return m;
      }

      // DisplayObjFrame.RenderAtRotScaled_Xflip (DisplayObjFrame.as:320).
      private function matXflip(xoff:Number, yoff:Number, x:Number, y:Number, scale:Number, dir:Number) : Matrix
      {
         var m:Matrix = new Matrix();
         m.translate(xoff, yoff);
         m.rotate(dir);
         m.translate(-xoff, -yoff);
         m.scale(scale, scale);
         m.translate(xoff * scale, yoff * scale);
         m.scale(-1, 1);
         m.translate(x, y);
         return m;
      }

      private function render() : void
      {
         // --- shared scene (keep in sync with scene.json) ---
         // opaque bg [54,62,78] = 0x363E4E (transparent=false forces alpha 0xFF)
         var canvas:BitmapData = new BitmapData(640, 480, false, 0xFF363E4E);

         // sprite 1: Cars frame 0 — rot 20deg, scale 1.6, xflip, ColorTransform, normal blend
         var car:BitmapData = this.bakeClip(this.makeClip("Cars"), 0);
         var cPivotX:Number = 106;        // caroffsets frame 0
         var cPivotY:Number = 116;
         var cm:Matrix = this.matXflip(-cPivotX, -cPivotY, 330, 250, 1.6, 20 * Math.PI / 180);
         var cct:ColorTransform = new ColorTransform(1.2, 0.8, 0.8, 1.0, 30, 0, 0, 0);
         canvas.draw(car, cm, cct, BlendMode.NORMAL, null, false);

         // sprite 2: fx_nitro frame 2 — scale 1.5, additive blend, no ColorTransform,
         //           pivot = content centre (matches atlas "center" strategy)
         var nitro:BitmapData = this.bakeClip(this.makeClip("fx_nitro"), 2);
         var nPivotX:Number = nitro.width / 2;
         var nPivotY:Number = nitro.height / 2;
         var nm:Matrix = this.matNormal(-nPivotX, -nPivotY, 210, 250, 1.5, 0);
         canvas.draw(nitro, nm, null, BlendMode.ADD, null, false);

         // sprite 3: additive control on a LOSSLESS source — Cars frame 3, additive.
         // Isolates additive-blend math from the nitro's JPEG-decode divergence.
         var ctrl:BitmapData = this.bakeClip(this.makeClip("Cars"), 3);
         var ctrlPivotX:Number = 96;   // caroffsets frame 3
         var ctrlPivotY:Number = 135;
         var ctrlM:Matrix = this.matNormal(-ctrlPivotX, -ctrlPivotY, 110, 110, 0.55, 0);
         canvas.draw(ctrl, ctrlM, null, BlendMode.ADD, null, false);

         this.addChild(new Bitmap(canvas, "auto", false));
      }
   }
}
