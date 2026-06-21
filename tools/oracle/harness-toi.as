package
{
   import Box2D.Collision.b2AABB;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Common.Math.b2Vec2;
   import Box2D.Dynamics.b2Body;
   import Box2D.Dynamics.b2BodyDef;
   import Box2D.Dynamics.b2World;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m7 golden harness — CCD/TOI. continuousPhysics ON (the whole point). A FAST bullet
   // (~6 units/step) that WITHOUT TOI would tunnel clean through a thin static wall in a
   // single 1/60 step is instead caught at the wall by b2World.SolveTOI → b2TimeOfImpact.
   //   [M7FIX] fixedRotation bullet, head-on (invI=0 ⇒ angle stays 0 ⇒ GetXForm uses
   //           cos0/sin0 ⇒ trig-IMMUNE): the PURE bit-exact gate for the full TOI stack
   //           (b2Distance GJK, conservative advancement, SolveTOI scan+island, sub-step).
   //   [M7ROT] free bullet hitting OFF-centre (catches a corner ⇒ rotates ⇒ the TOI
   //           sub-step trig surface): MEASURE the bit-exact prefix (rule 5).
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
            this.scene("M7FIX",true,0);
            this.scene("M7ROT",false,0.18);
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

      // param2 = fixedRotation, param3 = vertical offset of the bullet (off-centre hit)
      private function scene(param1:String, param2:Boolean, param3:Number) : void
      {
         var _loc7_:int = 0;
         // mspr world AABB ±25000 (PhysicsBase.as). gravity (0,0) is a SCENE choice (isolate
         // TOI — no gravity drop), kept from FZ3; mspr's deltas that matter here are the AABB
         // (broadphase) and Step(1/80,10) (TOI sub-step solve).
         var _loc4_:b2AABB = new b2AABB();
         _loc4_.lowerBound.Set(-25000,-25000);
         _loc4_.upperBound.Set(25000,25000);
         var _loc5_:b2World = new b2World(_loc4_,new b2Vec2(0,0),false);

         var _loc6_:b2BodyDef = new b2BodyDef();
         _loc6_.position.Set(4,0);
         var _loc8_:b2Body = _loc5_.CreateBody(_loc6_);
         var _loc9_:b2PolygonDef = new b2PolygonDef();
         _loc9_.SetAsBox(0.15,4);
         _loc9_.friction = 0.3;
         _loc9_.restitution = 0;
         _loc8_.CreateShape(_loc9_);

         var _loc10_:b2BodyDef = new b2BodyDef();
         _loc10_.position.Set(0,param3);
         _loc10_.fixedRotation = param2;
         var _loc11_:b2Body = _loc5_.CreateBody(_loc10_);
         var _loc12_:b2PolygonDef = new b2PolygonDef();
         _loc12_.SetAsBox(0.2,0.2);
         _loc12_.density = 1;
         _loc12_.friction = 0.3;
         _loc12_.restitution = 0;
         _loc11_.CreateShape(_loc12_);
         _loc11_.SetMassFromShapes();
         _loc11_.SetBullet(true);
         _loc11_.SetLinearVelocity(new b2Vec2(360,0));

         this.emit(param1,0,_loc11_);
         _loc7_ = 1;
         while(_loc7_ <= 30)
         {
            _loc5_.Step(1 / 80,10);
            this.emit(param1,_loc7_,_loc11_);
            _loc7_++;
         }
      }
   }
}
