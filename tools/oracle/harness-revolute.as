package
{
   import Box2D.Collision.b2AABB;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Common.Math.b2Vec2;
   import Box2D.Dynamics.b2Body;
   import Box2D.Dynamics.b2BodyDef;
   import Box2D.Dynamics.Joints.b2RevoluteJointDef;
   import Box2D.Dynamics.b2World;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m6 golden harness — REVOLUTE joint. A horizontal bar pinned at its left end to the
   // static groundBody by a revolute joint, released and swinging down under gravity (a
   // pendulum). The bar ROTATES, so this is trig-exposed (b2Mat22.Set each step) — the TS
   // gate measures the bit-exact prefix then a bounded tolerance (rule 5). Traces the
   // pendulum body's x,y,a,vx,vy,ω each step.
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

      private function emit(param1:int, param2:b2Body) : void
      {
         trace("[REV] " + param1
            + " " + this.bits(param2.GetPosition().x)
            + " " + this.bits(param2.GetPosition().y)
            + " " + this.bits(param2.GetAngle())
            + " " + this.bits(param2.GetLinearVelocity().x)
            + " " + this.bits(param2.GetLinearVelocity().y)
            + " " + this.bits(param2.GetAngularVelocity()));
      }

      private function run() : void
      {
         var _loc6_:int = 0;
         // mspr world config: AABB ±25000, gravity (0,20) (PhysicsBase.as).
         var _loc1_:b2AABB = new b2AABB();
         _loc1_.lowerBound.Set(-25000,-25000);
         _loc1_.upperBound.Set(25000,25000);
         var _loc2_:b2World = new b2World(_loc1_,new b2Vec2(0,20),false);

         var _loc3_:b2BodyDef = new b2BodyDef();
         _loc3_.position.Set(1,0);
         var _loc4_:b2Body = _loc2_.CreateBody(_loc3_);
         var _loc5_:b2PolygonDef = new b2PolygonDef();
         _loc5_.SetAsBox(1,0.2);
         _loc5_.density = 1;
         _loc5_.friction = 0.3;
         _loc5_.restitution = 0;
         _loc4_.CreateShape(_loc5_);
         _loc4_.SetMassFromShapes();

         var _loc7_:b2RevoluteJointDef = new b2RevoluteJointDef();
         _loc7_.Initialize(_loc2_.GetGroundBody(),_loc4_,new b2Vec2(0,0));
         _loc7_.collideConnected = false;
         _loc2_.CreateJoint(_loc7_);

         this.emit(0,_loc4_);
         _loc6_ = 1;
         while(_loc6_ <= 60)
         {
            _loc2_.Step(1 / 80,10);
            this.emit(_loc6_,_loc4_);
            _loc6_++;
         }
      }
   }
}
