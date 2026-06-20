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

   // m5 golden harness — SLEEP / WAKE, isolated. doSleep ON (the new thing),
   // continuousPhysics OFF (TOI is m7). A fixedRotation box (trig-immune) lands on
   // static ground, slides to rest, and SLEEPS once it's been still ≥ b2_timeToSleep
   // (0.5s = 30 steps). It then stays frozen (the island skips sleeping bodies). At
   // step 110 an ApplyImpulse WAKES it (Apply* wakes; SetLinearVelocity would NOT —
   // the faithful 2.0.x trap) and it moves again. Traces x,y,a,vx,vy,ω + isSleeping(0/1)
   // so the sleep transition is explicit and gateable. The sleep frame zeroes a tiny
   // velocity residual — exactly the bit that must match (SB2 diverged there at step 67).
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
         trace("[M5] " + param1
            + " " + this.bits(param2.GetPosition().x)
            + " " + this.bits(param2.GetPosition().y)
            + " " + this.bits(param2.GetAngle())
            + " " + this.bits(param2.GetLinearVelocity().x)
            + " " + this.bits(param2.GetLinearVelocity().y)
            + " " + this.bits(param2.GetAngularVelocity())
            + " " + this.bits(param2.IsSleeping() ? 1 : 0));
      }

      private function run() : void
      {
         var _loc6_:int = 0;
         // mspr world config (PhysicsBase.as): AABB ±25000, gravity (0,20), doSleep=ON
         // (the m5 thing); continuousPhysics OFF (TOI is m7). Under g20/Step(1/80) the box
         // settles + sleeps EARLIER than FZ3's g6/1/60 — wake at 110 is still well after.
         var _loc1_:b2AABB = new b2AABB();
         _loc1_.lowerBound.Set(-25000,-25000);
         _loc1_.upperBound.Set(25000,25000);
         var _loc2_:b2World = new b2World(_loc1_,new b2Vec2(0,20),true);
         _loc2_.SetContinuousPhysics(false);

         var _loc3_:b2BodyDef = new b2BodyDef();
         _loc3_.position.Set(0,5);
         var _loc4_:b2Body = _loc2_.CreateBody(_loc3_);
         var _loc5_:b2PolygonDef = new b2PolygonDef();
         _loc5_.SetAsBox(5,0.5);
         _loc5_.friction = 0.5;
         _loc5_.restitution = 0.1;
         _loc4_.CreateShape(_loc5_);

         var _loc7_:b2BodyDef = new b2BodyDef();
         _loc7_.position.Set(0,2);
         _loc7_.fixedRotation = true;
         var _loc8_:b2Body = _loc2_.CreateBody(_loc7_);
         var _loc9_:b2PolygonDef = new b2PolygonDef();
         _loc9_.SetAsBox(0.5,0.5);
         _loc9_.density = 0.5;
         _loc9_.friction = 0.3;
         _loc9_.restitution = 0.2;
         _loc8_.CreateShape(_loc9_);
         _loc8_.SetMassFromShapes();
         _loc8_.SetLinearVelocity(new b2Vec2(2,0));

         this.emit(0,_loc8_);
         _loc6_ = 1;
         while(_loc6_ <= 160)
         {
            if(_loc6_ == 110)
            {
               _loc8_.ApplyImpulse(new b2Vec2(2,-3),_loc8_.GetWorldCenter());
            }
            _loc2_.Step(1 / 80,10);
            this.emit(_loc6_,_loc8_);
            _loc6_++;
         }
      }
   }
}
