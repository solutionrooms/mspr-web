package
{
   import Box2D.Collision.b2AABB;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Common.Math.b2Vec2;
   import Box2D.Dynamics.b2Body;
   import Box2D.Dynamics.b2BodyDef;
   import Box2D.Dynamics.Joints.b2PrismaticJointDef;
   import Box2D.Dynamics.Joints.b2DistanceJointDef;
   import Box2D.Dynamics.b2World;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m6 golden harness — PRISMATIC + DISTANCE joints.
   //   [PRIS] a box on a VERTICAL prismatic (axis (0,1)) from a static anchor, given a
   //          sideways kick: the perp + angular constraints keep it on-axis and unrotated
   //          (angle locked => trig-IMMUNE), sliding down under gravity. PURE bit-exact.
   //   [DIST] a box held at fixed distance from a static anchor (a rope), released to the
   //          side: swings as a pendulum (rotating => trig-exposed) — exact-prefix gate.
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
            this.scenePrismatic();
            this.sceneDistance();
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

      private function emit(param1:String, param2:int, param3:b2Body) : void
      {
         trace("[" + param1 + "] " + param2
            + " " + this.bits(param3.GetPosition().x)
            + " " + this.bits(param3.GetPosition().y)
            + " " + this.bits(param3.GetAngle())
            + " " + this.bits(param3.GetLinearVelocity().x)
            + " " + this.bits(param3.GetLinearVelocity().y)
            + " " + this.bits(param3.GetAngularVelocity()));
      }

      // mspr world config: AABB ±25000, gravity (0,20) (PhysicsBase.as).
      private function makeWorld() : b2World
      {
         var _loc1_:b2AABB = new b2AABB();
         _loc1_.lowerBound.Set(-25000,-25000);
         _loc1_.upperBound.Set(25000,25000);
         var _loc2_:b2World = new b2World(_loc1_,new b2Vec2(0,20),false);
         _loc2_.SetContinuousPhysics(false);
         return _loc2_;
      }

      private function scenePrismatic() : void
      {
         var _loc5_:int = 0;
         var _loc1_:b2World = this.makeWorld();
         var _loc2_:b2BodyDef = new b2BodyDef();
         _loc2_.position.Set(0,1);
         var _loc3_:b2Body = _loc1_.CreateBody(_loc2_);
         var _loc4_:b2PolygonDef = new b2PolygonDef();
         _loc4_.SetAsBox(0.3,0.3);
         _loc4_.density = 1;
         _loc3_.CreateShape(_loc4_);
         _loc3_.SetMassFromShapes();
         _loc3_.SetLinearVelocity(new b2Vec2(2,0));

         var _loc6_:b2PrismaticJointDef = new b2PrismaticJointDef();
         _loc6_.Initialize(_loc1_.GetGroundBody(),_loc3_,new b2Vec2(0,0),new b2Vec2(0,1));
         _loc6_.collideConnected = false;
         _loc1_.CreateJoint(_loc6_);

         this.emit("PRIS",0,_loc3_);
         _loc5_ = 1;
         while(_loc5_ <= 60)
         {
            _loc1_.Step(1 / 80,10);
            this.emit("PRIS",_loc5_,_loc3_);
            _loc5_++;
         }
      }

      private function sceneDistance() : void
      {
         var _loc5_:int = 0;
         var _loc1_:b2World = this.makeWorld();
         var _loc2_:b2BodyDef = new b2BodyDef();
         _loc2_.position.Set(2,0);
         var _loc3_:b2Body = _loc1_.CreateBody(_loc2_);
         var _loc4_:b2PolygonDef = new b2PolygonDef();
         _loc4_.SetAsBox(0.3,0.3);
         _loc4_.density = 1;
         _loc3_.CreateShape(_loc4_);
         _loc3_.SetMassFromShapes();

         var _loc6_:b2DistanceJointDef = new b2DistanceJointDef();
         _loc6_.Initialize(_loc1_.GetGroundBody(),_loc3_,new b2Vec2(0,0),new b2Vec2(2,0));
         _loc6_.collideConnected = false;
         _loc1_.CreateJoint(_loc6_);

         this.emit("DIST",0,_loc3_);
         _loc5_ = 1;
         while(_loc5_ <= 60)
         {
            _loc1_.Step(1 / 80,10);
            this.emit("DIST",_loc5_,_loc3_);
            _loc5_++;
         }
      }
   }
}
