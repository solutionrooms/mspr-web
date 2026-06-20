package
{
   import Box2D.Collision.b2AABB;
   import Box2D.Collision.b2BroadPhase;
   import Box2D.Collision.b2PairCallback;
   import Box2D.Common.Math.b2Vec2;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m2b golden harness (mspr) — drives the SAP broadphase DIRECTLY (no world, no
   // narrowphase) with a plain b2PairCallback (PairAdded returns null). Exercises
   // CreateProxy, MoveProxy, QueryAABB, DestroyProxy and the pair manager. Dumps the
   // quantized bound arrays (value/proxyId/stabbingCount), proxy & pair counts, and
   // query results after each stage. Everything dumped is an integer => bit-exact.
   //
   // CONFIG-DEPENDENT (unlike shapes/collide): the broadphase quantizes proxy AABBs
   // against the WORLD AABB, so the quantized `value`s depend on it. mspr's world is
   // ±25000 (PhysicsBase.as), NOT FZ3's ±2500 — so this golden genuinely differs from
   // FZ3's and proves the SHARED engine bit-exact at mspr's actual broadphase bound.
   //
   // Injected as the document class `Preloader` (the SWF's true doc class — see
   // harness-freefall.as). Run under Ruffle headless; trace lines scraped to a golden.
   public class Preloader extends MovieClip
   {
      private var _ba:ByteArray;
      private var _bp:b2BroadPhase;

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

      private function emit(param1:String, param2:int, param3:Array) : void
      {
         var _loc4_:String = "[" + param1 + "] " + param2;
         var _loc5_:int = 0;
         while(_loc5_ < param3.length)
         {
            _loc4_ += " " + this.bits(Number(param3[_loc5_]));
            _loc5_++;
         }
         trace(_loc4_);
      }

      private function makeAABB(param1:Number, param2:Number, param3:Number, param4:Number) : b2AABB
      {
         var _loc5_:b2AABB = new b2AABB();
         _loc5_.lowerBound.Set(param1,param2);
         _loc5_.upperBound.Set(param3,param4);
         return _loc5_;
      }

      private function dumpState(param1:String) : void
      {
         var _loc4_:int = 0;
         var _loc2_:int = 2 * this._bp.m_proxyCount;
         _loc4_ = 0;
         while(_loc4_ < _loc2_)
         {
            this.emit(param1 + "0",_loc4_,[this._bp.m_bounds[0][_loc4_].value,
               this._bp.m_bounds[0][_loc4_].proxyId,this._bp.m_bounds[0][_loc4_].stabbingCount]);
            _loc4_++;
         }
         _loc4_ = 0;
         while(_loc4_ < _loc2_)
         {
            this.emit(param1 + "1",_loc4_,[this._bp.m_bounds[1][_loc4_].value,
               this._bp.m_bounds[1][_loc4_].proxyId,this._bp.m_bounds[1][_loc4_].stabbingCount]);
            _loc4_++;
         }
         this.emit(param1 + "C",0,[this._bp.m_proxyCount,this._bp.m_pairManager.m_pairCount]);
      }

      private function run() : void
      {
         var _loc5_:int = 0;
         // mspr world AABB ±25000 (PhysicsBase.as) — the load-bearing difference vs FZ3.
         var _loc1_:b2AABB = new b2AABB();
         _loc1_.lowerBound.Set(-25000,-25000);
         _loc1_.upperBound.Set(25000,25000);
         this._bp = new b2BroadPhase(_loc1_,new b2PairCallback());

         var _loc2_:Array = [];
         _loc2_[0] = this._bp.CreateProxy(this.makeAABB(0,0,2,2),0);
         _loc2_[1] = this._bp.CreateProxy(this.makeAABB(1,1,3,3),1);
         _loc2_[2] = this._bp.CreateProxy(this.makeAABB(10,10,12,12),2);
         _loc2_[3] = this._bp.CreateProxy(this.makeAABB(1.5,1.5,2.5,2.5),3);
         _loc5_ = 0;
         while(_loc5_ < 4)
         {
            this.emit("PROXY",_loc5_,[_loc2_[_loc5_]]);
            _loc5_++;
         }
         this.dumpState("A");

         this._bp.MoveProxy(_loc2_[0],this.makeAABB(20,20,22,22));
         this._bp.Commit();
         this.dumpState("B");

         var _loc3_:Array = new Array(16);
         var _loc4_:int = this._bp.QueryAABB(this.makeAABB(1,1,1.6,1.6),_loc3_,16);
         this.emit("QCNT",0,[_loc4_]);
         _loc5_ = 0;
         while(_loc5_ < _loc4_)
         {
            this.emit("QRY",_loc5_,[Number(_loc3_[_loc5_])]);
            _loc5_++;
         }

         this._bp.DestroyProxy(_loc2_[1]);
         this.dumpState("D");
      }
   }
}
