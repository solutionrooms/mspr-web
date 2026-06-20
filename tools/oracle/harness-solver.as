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

   // m4 golden harness — the 2.0.x CONTACT SOLVER, isolated. continuousPhysics OFF (TOI
   // is m7) and doSleep OFF (sleep is m5) so this gates ONLY the discrete sequential-
   // impulse solver. Two scenes:
   //   [M4FIX] a fixedRotation box (invI=0 => never rotates => trig-IMMUNE) given a
   //           horizontal velocity, landing on static ground and sliding with friction.
   //           This is the PURE bit-exact m4 gate.
   //   [M4ROT] the same box free to rotate — used to MEASURE trig exposure (rule 5):
   //           the bit-exact prefix length before cos/sin feedback diverges.
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
            this.scene("M4FIX",true);
            this.scene("M4ROT",false);
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

      private function scene(param1:String, param2:Boolean) : void
      {
         var _loc9_:int = 0;
         // mspr world config (PhysicsBase.as): AABB ±25000, gravity (0,20). doSleep=false
         // (sleep is m5) + SetContinuousPhysics(false) (TOI is m7) isolate the m4 solver.
         var _loc3_:b2AABB = new b2AABB();
         _loc3_.lowerBound.Set(-25000,-25000);
         _loc3_.upperBound.Set(25000,25000);
         var _loc4_:b2World = new b2World(_loc3_,new b2Vec2(0,20),false);
         _loc4_.SetContinuousPhysics(false);

         var _loc5_:b2BodyDef = new b2BodyDef();
         _loc5_.position.Set(0,5);
         var _loc6_:b2Body = _loc4_.CreateBody(_loc5_);
         var _loc7_:b2PolygonDef = new b2PolygonDef();
         _loc7_.SetAsBox(5,0.5);
         _loc7_.friction = 0.5;
         _loc7_.restitution = 0.1;
         _loc6_.CreateShape(_loc7_);

         var _loc8_:b2BodyDef = new b2BodyDef();
         _loc8_.position.Set(0,2);
         _loc8_.fixedRotation = param2;
         var _loc10_:b2Body = _loc4_.CreateBody(_loc8_);
         var _loc11_:b2PolygonDef = new b2PolygonDef();
         _loc11_.SetAsBox(0.5,0.5);
         _loc11_.density = 0.5;
         _loc11_.friction = 0.3;
         _loc11_.restitution = 0.2;
         _loc10_.CreateShape(_loc11_);
         _loc10_.SetMassFromShapes();
         _loc10_.SetLinearVelocity(new b2Vec2(2,0));

         this.emit(param1,0,_loc10_);
         _loc9_ = 1;
         while(_loc9_ <= 150)
         {
            _loc4_.Step(1 / 80,10);
            this.emit(param1,_loc9_,_loc10_);
            _loc9_++;
         }
      }
   }
}
