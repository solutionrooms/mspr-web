package
{
   import Box2D.Collision.Shapes.b2CircleDef;
   import Box2D.Collision.Shapes.b2CircleShape;
   import Box2D.Collision.Shapes.b2MassData;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Collision.Shapes.b2PolygonShape;
   import Box2D.Common.Math.b2Vec2;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m2a golden harness — STANDALONE shape construction + ComputeMass (no world, no
   // broadphase). Validates b2CircleShape/b2PolygonShape construction (normals,
   // centroid, OBB, TOI-slop core vertices) and ComputeMass (mass/centre/inertia).
   // All +-*/ and sqrt (no trig) => bit-exact-able. Shapes mirror real FZ3 usage:
   // triangulated polys (3 verts) + circles, plus a 4-vert box to exercise the OBB.
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

      private function dumpPoly(param1:String, param2:b2PolygonShape, param3:Number) : void
      {
         var _loc6_:int = 0;
         var _loc4_:b2MassData = new b2MassData();
         param2.ComputeMass(_loc4_);
         this.emit(param1,0,[_loc4_.mass,_loc4_.center.x,_loc4_.center.y,_loc4_.I]);
         this.emit(param1,1,[param2.m_centroid.x,param2.m_centroid.y]);
         this.emit(param1,2,[param2.m_obb.center.x,param2.m_obb.center.y,
            param2.m_obb.extents.x,param2.m_obb.extents.y,
            param2.m_obb.R.col1.x,param2.m_obb.R.col1.y,
            param2.m_obb.R.col2.x,param2.m_obb.R.col2.y]);
         _loc6_ = 0;
         while(_loc6_ < param2.m_vertexCount)
         {
            this.emit(param1 + "CORE",_loc6_,[param2.m_coreVertices[_loc6_].x,param2.m_coreVertices[_loc6_].y]);
            _loc6_++;
         }
         _loc6_ = 0;
         while(_loc6_ < param2.m_vertexCount)
         {
            this.emit(param1 + "NORM",_loc6_,[param2.m_normals[_loc6_].x,param2.m_normals[_loc6_].y]);
            _loc6_++;
         }
      }

      private function run() : void
      {
         var _loc1_:b2CircleDef = new b2CircleDef();
         _loc1_.radius = 0.6;
         _loc1_.density = 0.3;
         _loc1_.localPosition.Set(0.2,-0.1);
         var _loc2_:b2CircleShape = new b2CircleShape(_loc1_);
         var _loc3_:b2MassData = new b2MassData();
         _loc2_.ComputeMass(_loc3_);
         this.emit("CIRC",0,[_loc3_.mass,_loc3_.center.x,_loc3_.center.y,_loc3_.I]);

         var _loc4_:b2PolygonDef = new b2PolygonDef();
         _loc4_.density = 0.3;
         _loc4_.vertexCount = 3;
         _loc4_.vertices[0].Set(-1,-0.5);
         _loc4_.vertices[1].Set(1,-0.5);
         _loc4_.vertices[2].Set(0.3,0.8);
         this.dumpPoly("TRI",new b2PolygonShape(_loc4_),0);

         var _loc5_:b2PolygonDef = new b2PolygonDef();
         _loc5_.density = 0.5;
         _loc5_.SetAsBox(1.2,0.4);
         this.dumpPoly("BOX",new b2PolygonShape(_loc5_),0);
      }
   }
}
