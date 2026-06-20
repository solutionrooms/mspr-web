// Port of Box2D/Dynamics/b2TimeStep.as (Box2DFlash 2.0.2), verbatim.
export class b2TimeStep {
  public dt!: number;
  public inv_dt!: number;
  public dtRatio!: number;
  public maxIterations!: number;
  public warmStarting!: boolean;
  public positionCorrection!: boolean;
}
