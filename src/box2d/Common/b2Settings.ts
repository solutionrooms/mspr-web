// Port of Box2D/Common/b2Settings.as (Box2DFlash 2.0.2), verbatim constants.
// These are silent faithfulness killers — copy EXACTLY, never tune (CLAUDE.md).
// This is Box2D 2.0.x: the 2.0.x iteration model (inline Baumgarte) depends on
// b2_contactBaumgarte; restitution is killed below b2_velocityThreshold; etc.

export class b2Settings {
  // b2Settings.as:8
  public static readonly USHRT_MAX: number = 65535;
  // b2Settings.as:10
  public static readonly b2_pi: number = Math.PI;
  // b2Settings.as:12
  public static readonly b2_maxManifoldPoints: number = 2;
  // b2Settings.as:14
  public static readonly b2_maxPolygonVertices: number = 16;
  // b2Settings.as:16
  public static readonly b2_maxProxies: number = 1024;
  // b2Settings.as:18
  public static readonly b2_maxPairs: number = 8 * b2Settings.b2_maxProxies;
  // b2Settings.as:20
  public static readonly b2_linearSlop: number = 0.005;
  // b2Settings.as:22
  public static readonly b2_angularSlop: number = (2 / 180) * b2Settings.b2_pi;
  // b2Settings.as:24
  public static readonly b2_toiSlop: number = 8 * b2Settings.b2_linearSlop;
  // b2Settings.as:26
  public static readonly b2_maxTOIContactsPerIsland: number = 32;
  // b2Settings.as:28
  public static readonly b2_velocityThreshold: number = 1;
  // b2Settings.as:30
  public static readonly b2_maxLinearCorrection: number = 0.2;
  // b2Settings.as:32
  public static readonly b2_maxAngularCorrection: number = (8 / 180) * b2Settings.b2_pi;
  // b2Settings.as:34
  public static readonly b2_maxLinearVelocity: number = 200;
  // b2Settings.as:36
  public static readonly b2_maxLinearVelocitySquared: number =
    b2Settings.b2_maxLinearVelocity * b2Settings.b2_maxLinearVelocity;
  // b2Settings.as:38
  public static readonly b2_maxAngularVelocity: number = 250;
  // b2Settings.as:40
  public static readonly b2_maxAngularVelocitySquared: number =
    b2Settings.b2_maxAngularVelocity * b2Settings.b2_maxAngularVelocity;
  // b2Settings.as:42
  public static readonly b2_contactBaumgarte: number = 0.2;
  // b2Settings.as:44
  public static readonly b2_timeToSleep: number = 0.5;
  // b2Settings.as:46
  public static readonly b2_linearSleepTolerance: number = 0.01;
  // b2Settings.as:48
  public static readonly b2_angularSleepTolerance: number = 2 / 180;

  // b2Settings.as:55-62 — on failure the AS3 dereferences a null b2Vec2, i.e. it
  // crashes. We throw, preserving "assertion failure halts execution".
  public static b2Assert(condition: boolean): void {
    if (!condition) {
      throw new Error("b2Assert failed");
    }
  }
}
