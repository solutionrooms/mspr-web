// Port of Box2D/Collision/Shapes/b2FilterData.as (Box2DFlash 2.0.2), verbatim.
export class b2FilterData {
  public categoryBits: number = 1;
  public maskBits: number = 65535;
  public groupIndex: number = 0;

  // b2FilterData.as:17-24
  public Copy(): b2FilterData {
    const f: b2FilterData = new b2FilterData();
    f.categoryBits = this.categoryBits;
    f.maskBits = this.maskBits;
    f.groupIndex = this.groupIndex;
    return f;
  }
}
