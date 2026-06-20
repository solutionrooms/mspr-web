// Partial port of Box2D/Dynamics/Contacts/b2ContactSolver.as (Box2DFlash 2.0.2).
//
// The freefall goldens (m0/m1) build the island solver with ZERO contacts. The
// empty path is ported EXACTLY here:
//   - constructor: copies the step, counts constraints (sum of m_manifoldCount).
//     With 0 contacts the count is 0 and m_constraints stays empty.
//   - the four solve methods iterate m_constraintCount times — no-ops when 0.
//   - SolvePositionConstraints returns `minSeparation >= -1.5*b2_linearSlop`, which
//     for an empty solver is `0 >= -1.5*0.005` == true (b2ContactSolver.as:404,469).
//
// The constraint-building constructor body and the four solve-loop bodies are the
// sequential-impulse solver — ported line-by-line at m4 (solver milestone). Until
// then, reaching them with a non-empty contact set is an explicit `notPorted`.
import { b2TimeStep } from "../b2TimeStep";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Contact } from "./b2Contact";
import { notPorted } from "../../_internal/notPorted";

export class b2ContactSolver {
  public m_step: b2TimeStep;
  public m_allocator: unknown;
  public m_constraints: unknown[];
  public m_constraintCount: number;

  // b2ContactSolver.as:19-176 (empty path exact; build loop deferred to m4)
  constructor(step: b2TimeStep, constraints: b2Contact[], constraintCount: number, allocator: unknown) {
    this.m_step = new b2TimeStep();
    this.m_constraints = [];
    this.m_step.dt = step.dt;
    this.m_step.inv_dt = step.inv_dt;
    this.m_step.maxIterations = step.maxIterations;
    this.m_allocator = allocator;
    this.m_constraintCount = 0;
    // b2ContactSolver.as:71-77
    for (let i = 0; i < constraintCount; i++) {
      const contact: b2Contact = constraints[i];
      this.m_constraintCount += contact.m_manifoldCount;
    }
    if (this.m_constraintCount > 0) {
      notPorted("b2ContactSolver constraint build (m4: solver)");
    }
  }

  // b2ContactSolver.as:179-249
  public InitVelocityConstraints(_step: b2TimeStep): void {
    if (this.m_constraintCount > 0) {
      notPorted("b2ContactSolver.InitVelocityConstraints (m4: solver)");
    }
  }

  // b2ContactSolver.as:251-341
  public SolveVelocityConstraints(): void {
    if (this.m_constraintCount > 0) {
      notPorted("b2ContactSolver.SolveVelocityConstraints (m4: solver)");
    }
  }

  // b2ContactSolver.as:342-365
  public FinalizeVelocityConstraints(): void {
    if (this.m_constraintCount > 0) {
      notPorted("b2ContactSolver.FinalizeVelocityConstraints (m4: solver)");
    }
  }

  // b2ContactSolver.as:367-470
  public SolvePositionConstraints(_baumgarte: number): boolean {
    if (this.m_constraintCount > 0) {
      return notPorted("b2ContactSolver.SolvePositionConstraints (m4: solver)");
    }
    // minSeparation starts at 0 (b2ContactSolver.as:404); empty loop leaves it 0.
    const minSeparation: number = 0;
    return minSeparation >= -1.5 * b2Settings.b2_linearSlop;
  }
}
