package
{
   import Box2D.Collision.b2AABB;
   import Box2D.Collision.b2Manifold;
   import Box2D.Collision.b2ManifoldPoint;
   import Box2D.Collision.Shapes.b2CircleDef;
   import Box2D.Collision.Shapes.b2PolygonDef;
   import Box2D.Common.Math.b2Vec2;
   import Box2D.Dynamics.b2Body;
   import Box2D.Dynamics.b2BodyDef;
   import Box2D.Dynamics.Contacts.b2Contact;
   import Box2D.Dynamics.b2World;
   import flash.display.MovieClip;
   import flash.utils.ByteArray;
   import flash.utils.Endian;

   // m3b golden harness — the CONTACT LIFECYCLE through a real world (no solver/Step).
   // Each scene: a STATIC ground shape + a DYNAMIC shape positioned to overlap. The
   // faithful game flow (CreateBody mass0 -> CreateShape -> SetMassFromShapes flips
   // static->dynamic -> RefilterProxy re-fires PairAdded as a REAL contact) is exercised.
   // Then m_contactManager.Collide() evaluates the contact (Update->Evaluate->b2Collide*).
   // Axis-aligned (angle 0) => trig-free => bit-exact. Dumps friction/restitution/
   // manifoldCount + the manifold (pointCount, normal, per-point sep/localPoints/id.key).
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

      // mspr world config (PhysicsBase.as): AABB ±25000, gravity (0,20). The broadphase
      // quantizes against this AABB, so contact-pair detection runs at mspr's bound (vs
      // FZ3's ±2500). No Step here, so gravity is inert — set for faithfulness.
      private function makeWorld() : b2World
      {
         var _loc1_:b2AABB = new b2AABB();
         _loc1_.lowerBound.Set(-25000,-25000);
         _loc1_.upperBound.Set(25000,25000);
         return new b2World(_loc1_,new b2Vec2(0,20),true);
      }

      private function dumpContact(param1:String, param2:b2World) : void
      {
         var _loc6_:b2ManifoldPoint = null;
         var _loc3_:b2Contact = param2.m_contactList;
         this.emit(param1,0,[param2.m_contactCount,_loc3_.m_friction,_loc3_.m_restitution,_loc3_.m_manifoldCount]);
         var _loc4_:b2Manifold = _loc3_.GetManifolds()[0];
         this.emit(param1 + "N",0,[_loc4_.pointCount,_loc4_.normal.x,_loc4_.normal.y]);
         var _loc5_:int = 0;
         while(_loc5_ < _loc4_.pointCount)
         {
            _loc6_ = _loc4_.points[_loc5_];
            this.emit(param1 + "P",_loc5_,[_loc6_.separation,
               _loc6_.localPoint1.x,_loc6_.localPoint1.y,
               _loc6_.localPoint2.x,_loc6_.localPoint2.y,
               _loc6_.id._key]);
            _loc5_++;
         }
      }

      // ground static box at (gx,gy), dynamic box at (dx,dy)
      private function scenePolyPoly() : void
      {
         var _loc1_:b2World = this.makeWorld();
         var _loc2_:b2BodyDef = new b2BodyDef();
         _loc2_.position.Set(0,2);
         var _loc3_:b2Body = _loc1_.CreateBody(_loc2_);
         var _loc4_:b2PolygonDef = new b2PolygonDef();
         _loc4_.SetAsBox(3,0.5);
         _loc4_.friction = 0.5;
         _loc4_.restitution = 0.1;
         _loc3_.CreateShape(_loc4_);

         var _loc5_:b2BodyDef = new b2BodyDef();
         _loc5_.position.Set(0.3,1.2);
         var _loc6_:b2Body = _loc1_.CreateBody(_loc5_);
         var _loc7_:b2PolygonDef = new b2PolygonDef();
         _loc7_.SetAsBox(0.5,0.5);
         _loc7_.density = 0.5;
         _loc7_.friction = 0.3;
         _loc7_.restitution = 0.2;
         _loc6_.CreateShape(_loc7_);
         _loc6_.SetMassFromShapes();

         _loc1_.m_contactManager.Collide();
         this.dumpContact("PP",_loc1_);
      }

      private function scenePolyCircle() : void
      {
         var _loc1_:b2World = this.makeWorld();
         var _loc2_:b2BodyDef = new b2BodyDef();
         _loc2_.position.Set(0,2);
         var _loc3_:b2Body = _loc1_.CreateBody(_loc2_);
         var _loc4_:b2PolygonDef = new b2PolygonDef();
         _loc4_.SetAsBox(3,0.5);
         _loc4_.friction = 0.4;
         _loc4_.restitution = 0.3;
         _loc3_.CreateShape(_loc4_);

         var _loc5_:b2BodyDef = new b2BodyDef();
         _loc5_.position.Set(0.2,1.2);
         var _loc6_:b2Body = _loc1_.CreateBody(_loc5_);
         var _loc7_:b2CircleDef = new b2CircleDef();
         _loc7_.radius = 0.5;
         _loc7_.density = 0.5;
         _loc7_.friction = 0.6;
         _loc7_.restitution = 0.1;
         _loc6_.CreateShape(_loc7_);
         _loc6_.SetMassFromShapes();

         _loc1_.m_contactManager.Collide();
         this.dumpContact("PC",_loc1_);
      }

      private function sceneCircleCircle() : void
      {
         var _loc1_:b2World = this.makeWorld();
         var _loc2_:b2BodyDef = new b2BodyDef();
         _loc2_.position.Set(0,2);
         var _loc3_:b2Body = _loc1_.CreateBody(_loc2_);
         var _loc4_:b2CircleDef = new b2CircleDef();
         _loc4_.radius = 0.7;
         _loc4_.friction = 0.5;
         _loc4_.restitution = 0.4;
         _loc3_.CreateShape(_loc4_);

         var _loc5_:b2BodyDef = new b2BodyDef();
         _loc5_.position.Set(0.9,1.6);
         var _loc6_:b2Body = _loc1_.CreateBody(_loc5_);
         var _loc7_:b2CircleDef = new b2CircleDef();
         _loc7_.radius = 0.6;
         _loc7_.density = 0.5;
         _loc7_.friction = 0.5;
         _loc7_.restitution = 0.6;
         _loc6_.CreateShape(_loc7_);
         _loc6_.SetMassFromShapes();

         _loc1_.m_contactManager.Collide();
         this.dumpContact("CC",_loc1_);
      }

      private function run() : void
      {
         this.scenePolyPoly();
         this.scenePolyCircle();
         this.sceneCircleCircle();
      }
   }
}
