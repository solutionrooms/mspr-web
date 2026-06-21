package
{
   import EditorPackage.RoadEditor.Road;
   import EditorPackage.RoadEditor.RoadSeg;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // a0 golden harness (mspr ARCADE engine) — the COAST / knocked-out integrator, the
   // "freefall" of the real (non-Box2D) car physics. Injected as the document class
   // `Preloader` into mspaintracer.swf (the shipped bytecode), run under Ruffle headless.
   //
   // Bootstrap is the real shipped path (game's validated recipe, no stubs):
   //   Game.InitOnce → Vars/GameVars/objectDefs/levels (embedded XML, synchronous) +
   //   road=new Road(); road.InitOnce()  (Game.as:375-376, BEFORE the Stage3D s3d.InitOnce
   //   at 378 — so even if s3d dislikes headless and throws, `Game.road` already exists;
   //   we catch + proceed). Then road.InitForLevel(2) builds roadSegs (REQUIRED, because
   //   the coast branch's Player_SetBackgroundPos → Game.road.GetRoadChangeX indexes
   //   roadSegs[int(zpos)] unconditionally — Road.as:347-358).
   //
   // Then spawn the real player (RaceEventDay.as:739-741 path), force the coast state
   // (isKnockedOut=true → UpdatePlayer falls to GameObj.as:2059-2069), seed zvel=5
   // (GameVars.rollingStartZvel), and tick UpdatePlayer tracing the full arcade car state
   // (xpos,ypos,zpos,xvel,yvel,zvel,dir,turboVel) hex16 per tick → a0-coast.json.
   //
   // SHARED BOOTSTRAP: also dumps [RSEG] road geometry (render's road golden) right after
   // InitForLevel(2) — one boot, two goldens, zero drift (game's call). All fields via
   // bits() (incl. the int/uint ones) so capture-lines.mjs keeps them (it filters to hex16).
   public class Preloader extends MovieClip
   {
      private var _ba:ByteArray;

      public function Preloader()
      {
         super();
         this._ba = new ByteArray();
         this._ba.endian = Endian.BIG_ENDIAN;
         try
         {
            this.run();
         }
         catch(e:Error)
         {
            trace("[ERR] " + e.toString());
         }
         trace("[DONE]");
      }

      private function hex8(param1:uint) : String
      {
         var _loc2_:String = param1.toString(16);
         while(_loc2_.length < 8)
         {
            _loc2_ = "0" + _loc2_;
         }
         return _loc2_;
      }

      private function bits(param1:Number) : String
      {
         this._ba.position = 0;
         this._ba.writeDouble(param1);
         this._ba.position = 0;
         var _loc2_:uint = this._ba.readUnsignedInt();
         var _loc3_:uint = this._ba.readUnsignedInt();
         return this.hex8(_loc2_) + this.hex8(_loc3_);
      }

      // Continuation passed to ExternalData.Load; the embedded (sync) path invokes it
      // inline after populating xml/levelsXml — we drive Game.InitOnce ourselves after.
      private function noop() : void
      {
      }

      private function emitA0(param1:int, param2:GameObj) : void
      {
         trace("[A0] " + param1
            + " " + this.bits(param2.xpos)
            + " " + this.bits(param2.ypos)
            + " " + this.bits(param2.zpos)
            + " " + this.bits(param2.xvel)
            + " " + this.bits(param2.yvel)
            + " " + this.bits(param2.zvel)
            + " " + this.bits(param2.dir)
            + " " + this.bits(param2.turboVel));
      }

      private function run() : void
      {
         var _loc1_:int = 0;
         var _loc2_:RoadSeg = null;
         var _loc3_:int = 0;

         // --- HEADLESS data+road bootstrap (UI-free subset of Game.InitOnce/InitOnceV).
         //     The full Game.InitOnce can't run headless: HudController.InitOnce → `ingame_hud`
         //     #1065 (Game.as:345) and s3d.InitOnce (Stage3D, 378) both throw BEFORE the road
         //     build at 375. So we replicate ONLY the data+road inits the coast path needs,
         //     in InitOnceV order (Game.as:352-376), skipping all UI/audio/Stage3D. Game.road
         //     and Game.objectDefs are public static (settable). Embedded-data SYNC paths
         //     forced (load_vars_data / loadExternalLevels = false). ---
         Game.load_vars_data = false;             // embedded vars (sync) — Vars.as:31
         ExternalData.loadExternalLevels = false; // embedded levels (sync) — ExternalData.as:54
         GameObjects.InitOnce(Defs.maxGameObjects);            // Main.as:93 — AddObj pool
         trace("[BOOT] 1 gameObjects ok");
         ExternalData.Load(this.noop);                         // Main.as:96 → xml + levelsXml
         trace("[BOOT] 2 extdata xml=" + (ExternalData.xml == null ? "NULL" : "ok") + " levelsXml=" + (ExternalData.levelsXml == null ? "NULL" : "ok"));
         Vars.InitOnce(this.noop);                             // Game.as:349 — GetVarAsNumber data
         trace("[BOOT] 3 vars ok");
         GameVars.InitOnce();                                  // Game.as:372
         trace("[BOOT] 4 gamevars ok");
         Game.objectDefs = new PhysObjs();                     // Game.as:369-370
         Game.objectDefs.InitFromXml(ExternalData.xml);
         trace("[BOOT] 5 objectDefs ok");
         Game.road = new Road();                               // Game.as:375-376
         Game.road.InitOnce();
         trace("[BOOT] 6 road.InitOnce ok");
         Levels.LoadAll();                                     // Game.as:427 (InitGame1)
         trace("[BOOT] 7 LoadAll ok, listLen=" + (Levels.list == null ? -1 : Levels.list.length));
         Levels.currentIndex = 0;
         Game.road.InitForLevel(2);                            // builds roadSegs (Road.as:81)
         trace("[BOOT] 8 roadSegs.length=" + Game.road.roadSegs.length);

         // --- [RSEG] road geometry dump (render's golden; shipped RoadSeg field names) ---
         _loc3_ = Game.road.roadSegs.length;
         if(_loc3_ > 1500)
         {
            _loc3_ = 1500;
         }
         _loc1_ = 0;
         while(_loc1_ < _loc3_)
         {
            _loc2_ = Game.road.roadSegs[_loc1_];
            trace("[RSEG] " + _loc1_
               + " " + this.bits(_loc2_.width)
               + " " + this.bits(_loc2_.changeX)
               + " " + this.bits(_loc2_.changeY)
               + " " + this.bits(_loc2_.surfaceIndex)
               + " " + this.bits(_loc2_.colL)
               + " " + this.bits(_loc2_.colR)
               + " " + this.bits(_loc2_.edgeIndexL)
               + " " + this.bits(_loc2_.edgeIndexR));
            _loc1_++;
         }

         // --- spawn the real player + force the coast state ---
         GameVars.goPlayer = GameObjects.AddObj(0,0,0);
         GameVars.goPlayer.InitPlayer();
         GameVars.ClearRollingStart();
         GameVars.goPlayer.isKnockedOut = true;
         GameVars.goPlayer.zvel = 5;

         // --- a0 coast: tick UpdatePlayer, trace arcade state until zvel clamps to 0 ---
         this.emitA0(0,GameVars.goPlayer);
         _loc1_ = 1;
         while(_loc1_ <= 60)
         {
            GameVars.goPlayer.UpdatePlayer();
            this.emitA0(_loc1_,GameVars.goPlayer);
            _loc1_++;
         }
      }
   }
}
