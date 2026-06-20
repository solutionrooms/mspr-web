package
{
   import Box2D.Collision.b2Collision;
   import Box2D.Collision.b2Manifold;
   import Box2D.Collision.b2ManifoldPoint;
   import Box2D.Collision.Shapes.b2CircleDef;
   import Box2D.Collision.Shapes.b2CircleShape;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Collision.Shapes.b2PolygonShape;
   import Box2D.Common.Math.b2XForm;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m3a golden harness — STANDALONE narrowphase (no world). Calls b2Collision.b2Collide*
   // on overlapping shape pairs with AXIS-ALIGNED (angle 0 => R=identity, cos0/sin0 exact)
   // transforms, so the manifold math is trig-free and bit-exact. Dumps each manifold:
   // pointCount + normal, then per-point separation/localPoint1/localPoint2/id.key.
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

      private function xform(param1:Number, param2:Number) : b2XForm
      {
         var _loc3_:b2XForm = new b2XForm();
         _loc3_.position.Set(param1,param2);
         _loc3_.R.Set(0);
         return _loc3_;
      }

      private function dumpManifold(param1:String, param2:b2Manifold) : void
      {
         var _loc4_:b2ManifoldPoint = null;
         var _loc3_:int = 0;
         this.emit(param1,0,[param2.pointCount,param2.normal.x,param2.normal.y]);
         _loc3_ = 0;
         while(_loc3_ < param2.pointCount)
         {
            _loc4_ = param2.points[_loc3_];
            this.emit(param1 + "P",_loc3_,[_loc4_.separation,
               _loc4_.localPoint1.x,_loc4_.localPoint1.y,
               _loc4_.localPoint2.x,_loc4_.localPoint2.y,
               _loc4_.id._key]);
            _loc3_++;
         }
      }

      private function run() : void
      {
         var _loc1_:b2CircleDef = new b2CircleDef();
         _loc1_.radius = 0.6;
         var _loc2_:b2CircleShape = new b2CircleShape(_loc1_);
         var _loc3_:b2CircleDef = new b2CircleDef();
         _loc3_.radius = 0.5;
         var _loc4_:b2CircleShape = new b2CircleShape(_loc3_);
         var _loc5_:b2Manifold = new b2Manifold();
         b2Collision.b2CollideCircles(_loc5_,_loc2_,this.xform(0,0),_loc4_,this.xform(0.8,0.2));
         this.dumpManifold("MFC",_loc5_);

         var _loc6_:b2PolygonDef = new b2PolygonDef();
         _loc6_.SetAsBox(1,0.5);
         var _loc7_:b2PolygonShape = new b2PolygonShape(_loc6_);
         var _loc8_:b2CircleDef = new b2CircleDef();
         _loc8_.radius = 0.4;
         var _loc9_:b2CircleShape = new b2CircleShape(_loc8_);
         var _loc10_:b2Manifold = new b2Manifold();
         b2Collision.b2CollidePolygonAndCircle(_loc10_,_loc7_,this.xform(0,0),_loc9_,this.xform(0.9,0));
         this.dumpManifold("MFPC",_loc10_);

         var _loc11_:b2PolygonDef = new b2PolygonDef();
         _loc11_.SetAsBox(1,1);
         var _loc12_:b2PolygonShape = new b2PolygonShape(_loc11_);
         var _loc13_:b2PolygonDef = new b2PolygonDef();
         _loc13_.SetAsBox(1,1);
         var _loc14_:b2PolygonShape = new b2PolygonShape(_loc13_);
         var _loc15_:b2Manifold = new b2Manifold();
         b2Collision.b2CollidePolygons(_loc15_,_loc12_,this.xform(0,0),_loc14_,this.xform(1.5,0.3));
         this.dumpManifold("MFPP",_loc15_);
      }
   }
}
