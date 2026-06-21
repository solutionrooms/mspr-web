package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.utils.ByteArray;
   import flash.utils.Endian;
   import flash.utils.getDefinitionByName;

   // mspr ROAD-GEOMETRY golden harness — injected as the document class `Preloader` via
   // `ffdec -replace`, run under Ruffle headless. Uses the SHARED a0 bootstrap recipe
   // (Game.InitOnce → Levels.currentIndex=0 → road.InitForLevel(2)) which builds a real
   // roadSegs from the embedded level data, then dumps the first 1500 segs (render's road
   // golden — same [RSEG] format as harness-a0-coast.as, so the two goldens are identical).
   //
   // KEY vs the a0 harness: we POLL ENTER_FRAME until the game classes AND the late-defined
   // display symbols are linked before running the (synchronous) bootstrap. The doc class is
   // constructed EARLY (streaming preloader), so a constructor-time bootstrap races the ABC /
   // SymbolClass tags → null refs (GraphicObjects.Add bakes roadtex/sidetex on demand, so they
   // must be defined). Vars.InitOnce is synchronous when load_vars_data==false (Vars.as:34-38),
   // so once everything is linked the whole Game.InitOnce chain runs in one call.
   public class Preloader extends MovieClip
   {
      private static const NUM_SEGS:int = 1500;

      private var _ba:ByteArray;
      private var frames:int = 0;
      private var started:Boolean = false;

      public function Preloader()
      {
         super();
         this._ba = new ByteArray();
         this._ba.endian = Endian.BIG_ENDIAN;
         this.addEventListener(Event.ENTER_FRAME, this.onFrame);
      }

      private function onFrame(e:Event) : void
      {
         this.frames++;
         if(this.started) return;
         if(!this.ready())
         {
            if(this.frames > 1200) { this.removeEventListener(Event.ENTER_FRAME, this.onFrame); trace("[ERR] symbols never linked after " + this.frames); trace("[DONE]"); }
            return;
         }
         this.started = true;
         this.removeEventListener(Event.ENTER_FRAME, this.onFrame);
         this.run();
      }

      private function ready() : Boolean
      {
         return this.has("ExternalData") && this.has("Game") && this.has("Levels") && this.has("EditorPackage.RoadEditor.Road")
            && this.has("roadtex") && this.has("sidetex") && this.has("bg")
            && this.has("objects_misc") && this.has("objects_air") && this.has("objects_rocks") && this.has("objects_veg");
      }
      private function has(name:String) : Boolean
      {
         try { return getDefinitionByName(name) != null; } catch(e:Error) { return false; }
      }
      private function cls(name:String) : * { return getDefinitionByName(name); }

      private function hex8(v:uint) : String
      {
         var s:String = v.toString(16);
         while(s.length < 8) s = "0" + s;
         return s;
      }
      private function bits(v:Number) : String
      {
         this._ba.position = 0;
         this._ba.writeDouble(v);
         this._ba.position = 0;
         return this.hex8(this._ba.readUnsignedInt()) + this.hex8(this._ba.readUnsignedInt());
      }

      private function run() : void
      {
         // ExternalData.Load populates ExternalData.xml / levelsXml from the EMBEDDED blobs
         // (synchronous when loadExternalLevels=false → calls our cb inline). The real boot
         // loads it BEFORE Game.InitOnce (Main.as:96); Game.InitOnce assumes it (InitOnceV →
         // objectDefs.InitFromXml(ExternalData.xml), Game.as:371). Missing this = the NPE.
         try { this.cls("ExternalData").Load(this.afterData); }
         catch(e:Error) { trace("[ERR] load " + e.toString()); trace("[DONE]"); }
      }

      private function afterData(... rest) : void
      {
         var Game:* = this.cls("Game");
         var Levels:* = this.cls("Levels");
         // Game.InitOnce ends with s3d.InitOnce (Stage3D) which throws headless — but road=new
         // Road() (Game.as:375) runs before it, so catch + proceed.
         try { Game.InitOnce(null); } catch(e:Error) { trace("[INITERR] " + e.toString()); }
         try
         {
            var GraphicObjects:* = this.cls("GraphicObjects");
            GraphicObjects.InitOnce();  // dict = new Dictionary() (Game.InitOnce omits it)
            // Pre-seed 16-frame dummy dobjs for the roaddata gfx names: RoadData.InitOnce's
            // CreateRoadBitmaps does GetBitmapData(surface.frame 1-10 / billboard.frame 1-12)
            // with NO range guard, and the on-demand real bake here is frame-incomplete → NPE.
            // Geometry-only golden, so dummy pixels are fine; the DEFS still load (name→index).
            this.seedDummy(GraphicObjects, "roadtex");
            this.seedDummy(GraphicObjects, "sidetex");
            this.seedDummy(GraphicObjects, "objects_misc");
            this.seedDummy(GraphicObjects, "objects_air");
            this.seedDummy(GraphicObjects, "objects_rocks");
            this.seedDummy(GraphicObjects, "objects_veg");
            this.cls("EditorPackage.RoadEditor.RoadData").InitOnce();
            Levels.LoadAll();   // Game.InitOnce doesn't load levels (real boot loads them later)
            Levels.currentIndex = 0;
            Game.road.InitForLevel(2);   // builds roadSegs (2 laps)
            this.dump(Game.road);
         }
         catch(e2:Error) { trace("[ERR] build " + e2.toString()); }
         trace("[DONE]");
      }

      // 16-frame dummy DisplayObj registered in GraphicObjects.dict (internal; our top-level
      // Preloader shares the package). 16 frames covers surface(1-10)/billboard(1-12).
      private function seedDummy(GraphicObjects:*, name:String) : void
      {
         var DisplayObjFrame:Class = this.cls("DisplayObjFrame") as Class;
         var d:* = GraphicObjects.AddDobjEmptyBitmap(name, 8, 8, true);
         var i:int = 0;
         while(i < 15)
         {
            var f:* = new DisplayObjFrame();
            f.bitmapData = d.frames[0].bitmapData;
            f.sourceRect = d.frames[0].sourceRect;
            f.point = d.frames[0].point;
            f.xoffset = 0;
            f.yoffset = 0;
            d.frames.push(f);
            i++;
         }
         GraphicObjects.dict[name] = d;
      }

      private function dump(road:*) : void
      {
         var segs:* = road.roadSegs;
         var total:int = segs.length;
         var lim:int = total < NUM_SEGS ? total : NUM_SEGS;
         var i:int = 0;
         while(i < lim)
         {
            var s:* = segs[i];
            trace("[RSEG] " + i
               + " " + this.bits(s.width)
               + " " + this.bits(s.changeX)
               + " " + this.bits(s.changeY)
               + " " + this.bits(s.surfaceIndex)
               + " " + this.bits(s.colL)
               + " " + this.bits(s.colR)
               + " " + this.bits(s.edgeIndexL)
               + " " + this.bits(s.edgeIndexR));
            i++;
         }
      }
   }
}
