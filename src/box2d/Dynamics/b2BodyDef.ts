// Port of Box2D/Dynamics/b2BodyDef.as (Box2DFlash 2.0.2), verbatim.
import { b2MassData } from "../Collision/Shapes/b2MassData";
import { b2Vec2 } from "../Common/Math/b2Vec2";

export class b2BodyDef {
  public massData: b2MassData = new b2MassData();
  public userData: unknown;
  public position: b2Vec2 = new b2Vec2();
  public angle!: number;
  public linearDamping!: number;
  public angularDamping!: number;
  public allowSleep!: boolean;
  public isSleeping!: boolean;
  public fixedRotation!: boolean;
  public isBullet!: boolean;

  // b2BodyDef.as:29-44
  constructor() {
    this.massData.center.SetZero();
    this.massData.mass = 0;
    this.massData.I = 0;
    this.userData = null;
    this.position.Set(0, 0);
    this.angle = 0;
    this.linearDamping = 0;
    this.angularDamping = 0;
    this.allowSleep = true;
    this.isSleeping = false;
    this.fixedRotation = false;
    this.isBullet = false;
  }
}
