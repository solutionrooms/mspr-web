// Port of Box2D/Collision/b2BroadPhase.as (Box2DFlash 2.0.2), line-by-line.
// Sort-and-sweep (SAP) broadphase with quantized integer bound endpoints. This is
// the version unique to 2.0.2 (b2_maxProxies brute-force pool). Op order preserved.
//
// uint discipline: bound `value`s and proxy ids are uints in [0, 65535]. AS3
// `uint(floatExpr)` truncates-toward-zero then mod 2^32 -> JS `(floatExpr) >>> 0`
// (inputs are non-negative & < 65536 here, so this is a plain floor). `>>` stays a
// SIGNED shift, masks/`| 1`/`& (USHRT_MAX-1)` are reproduced verbatim with their
// ECMAScript precedence (`-`/additive binds tighter than `&`).
import { b2Settings } from "../Common/b2Settings";
import { b2Math } from "../Common/Math/b2Math";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2AABB } from "./b2AABB";
import { b2Bound } from "./b2Bound";
import { b2BoundValues } from "./b2BoundValues";
import { b2Pair } from "./b2Pair";
import { b2PairManager } from "./b2PairManager";
import { b2Proxy } from "./b2Proxy";
import type { b2PairCallback } from "./b2PairCallback";
import type { b2Segment } from "./b2Segment";

export class b2BroadPhase {
  // b2BroadPhase.as:9-13
  public static s_validate: boolean = false;
  public static readonly b2_invalid: number = b2Settings.USHRT_MAX;
  public static readonly b2_nullEdge: number = b2Settings.USHRT_MAX;

  public m_pairManager: b2PairManager;
  public m_proxyPool: b2Proxy[];
  public m_freeProxy!: number;
  public m_bounds: b2Bound[][];
  public m_querySortKeys: number[];
  public m_queryResults: number[];
  public m_queryResultCount!: number;
  public m_worldAABB: b2AABB;
  public m_quantizationFactor: b2Vec2;
  public m_proxyCount!: number;
  public m_timeStamp!: number;

  // b2BroadPhase.as:37-96
  constructor(worldAABB: b2AABB, callback: b2PairCallback) {
    this.m_pairManager = new b2PairManager();
    this.m_proxyPool = new Array(b2Settings.b2_maxPairs);
    this.m_bounds = new Array(2 * b2Settings.b2_maxProxies) as unknown as b2Bound[][];
    this.m_querySortKeys = new Array(b2Settings.b2_maxProxies);
    this.m_queryResults = new Array(b2Settings.b2_maxProxies);
    this.m_quantizationFactor = new b2Vec2();
    this.m_pairManager.Initialize(this, callback);
    this.m_worldAABB = worldAABB;
    this.m_proxyCount = 0;
    let i = 0;
    while (i < b2Settings.b2_maxProxies) {
      this.m_queryResults[i] = 0;
      this.m_querySortKeys[i] = 0;
      i++;
    }
    this.m_bounds = new Array(2);
    i = 0;
    while (i < 2) {
      this.m_bounds[i] = new Array(2 * b2Settings.b2_maxProxies);
      let j = 0;
      while (j < 2 * b2Settings.b2_maxProxies) {
        this.m_bounds[i][j] = new b2Bound();
        j++;
      }
      i++;
    }
    const dX: number = worldAABB.upperBound.x - worldAABB.lowerBound.x;
    const dY: number = worldAABB.upperBound.y - worldAABB.lowerBound.y;
    this.m_quantizationFactor.x = b2Settings.USHRT_MAX / dX;
    this.m_quantizationFactor.y = b2Settings.USHRT_MAX / dY;
    i = 0;
    while (i < b2Settings.b2_maxProxies - 1) {
      const proxy: b2Proxy = new b2Proxy();
      this.m_proxyPool[i] = proxy;
      proxy.SetNext(i + 1);
      proxy.timeStamp = 0;
      proxy.overlapCount = b2BroadPhase.b2_invalid;
      proxy.userData = null;
      i++;
    }
    const last: b2Proxy = new b2Proxy();
    this.m_proxyPool[b2Settings.b2_maxProxies - 1] = last;
    last.SetNext(b2Pair.b2_nullProxy);
    last.timeStamp = 0;
    last.overlapCount = b2BroadPhase.b2_invalid;
    last.userData = null;
    this.m_freeProxy = 0;
    this.m_timeStamp = 1;
    this.m_queryResultCount = 0;
  }

  // b2BroadPhase.as:98-122
  public static BinarySearch(bounds: b2Bound[], count: number, value: number): number {
    let low: number = 0;
    let high: number = count - 1;
    while (low <= high) {
      const mid: number = ((low + high) / 2) | 0;
      const bound: b2Bound = bounds[mid];
      if (bound.value > value) {
        high = mid - 1;
      } else {
        if (bound.value >= value) {
          return mid >>> 0;
        }
        low = mid + 1;
      }
    }
    return low >>> 0;
  }

  // b2BroadPhase.as:124-141
  public InRange(aabb: b2AABB): boolean {
    let dX: number = aabb.lowerBound.x;
    let dY: number = aabb.lowerBound.y;
    dX -= this.m_worldAABB.upperBound.x;
    dY -= this.m_worldAABB.upperBound.y;
    let d2X: number = this.m_worldAABB.lowerBound.x;
    let d2Y: number = this.m_worldAABB.lowerBound.y;
    d2X -= aabb.upperBound.x;
    d2Y -= aabb.upperBound.y;
    dX = b2Math.b2Max(dX, d2X);
    dY = b2Math.b2Max(dY, d2Y);
    return b2Math.b2Max(dX, dY) < 0;
  }

  // b2BroadPhase.as:143-151
  public GetProxy(proxyId: number): b2Proxy | null {
    const proxy: b2Proxy = this.m_proxyPool[proxyId];
    if (proxyId === b2Pair.b2_nullProxy || proxy.IsValid() === false) {
      return null;
    }
    return proxy;
  }

  // b2BroadPhase.as:153-284
  public CreateProxy(aabb: b2AABB, userData: unknown): number {
    const proxyId: number = this.m_freeProxy;
    const proxy: b2Proxy = this.m_proxyPool[proxyId];
    this.m_freeProxy = proxy.GetNext();
    proxy.overlapCount = 0;
    proxy.userData = userData;
    const boundCount: number = 2 * this.m_proxyCount;
    const lowerValues: number[] = new Array();
    const upperValues: number[] = new Array();
    this.ComputeBounds(lowerValues, upperValues, aabb);
    let axis = 0;
    while (axis < 2) {
      const bounds: b2Bound[] = this.m_bounds[axis];
      const lowerOut: number[] = [0];
      const upperOut: number[] = [0];
      this.Query(lowerOut, upperOut, lowerValues[axis], upperValues[axis], bounds, boundCount, axis);
      let lowerIndex: number = lowerOut[0] >>> 0;
      let upperIndex: number = upperOut[0] >>> 0;

      let tailCopy: b2Bound[] = new Array();
      let tailCount: number = boundCount - upperIndex;
      let k = 0;
      while (k < tailCount) {
        tailCopy[k] = new b2Bound();
        const dst: b2Bound = tailCopy[k];
        const src: b2Bound = bounds[upperIndex + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }
      tailCount = tailCopy.length;
      let destStart: number = upperIndex + 2;
      k = 0;
      while (k < tailCount) {
        const src: b2Bound = tailCopy[k];
        const dst: b2Bound = bounds[destStart + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }

      let midCopy: b2Bound[] = new Array();
      let midCount: number = upperIndex - lowerIndex;
      k = 0;
      while (k < midCount) {
        midCopy[k] = new b2Bound();
        const dst: b2Bound = midCopy[k];
        const src: b2Bound = bounds[lowerIndex + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }
      midCount = midCopy.length;
      destStart = lowerIndex + 1;
      k = 0;
      while (k < midCount) {
        const src: b2Bound = midCopy[k];
        const dst: b2Bound = bounds[destStart + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }

      upperIndex++;
      let lowerBound: b2Bound = bounds[lowerIndex];
      let upperBound: b2Bound = bounds[upperIndex];
      lowerBound.value = lowerValues[axis];
      lowerBound.proxyId = proxyId;
      upperBound.value = upperValues[axis];
      upperBound.proxyId = proxyId;
      let nbound: b2Bound = bounds[lowerIndex - 1];
      lowerBound.stabbingCount = lowerIndex === 0 ? 0 : nbound.stabbingCount;
      nbound = bounds[upperIndex - 1];
      upperBound.stabbingCount = nbound.stabbingCount;
      let index: number = lowerIndex;
      while (index < upperIndex) {
        nbound = bounds[index];
        ++nbound.stabbingCount;
        index++;
      }
      index = lowerIndex;
      while (index < boundCount + 2) {
        lowerBound = bounds[index];
        const proxyN: b2Proxy = this.m_proxyPool[lowerBound.proxyId];
        if (lowerBound.IsLower()) {
          proxyN.lowerBounds[axis] = index;
        } else {
          proxyN.upperBounds[axis] = index;
        }
        index++;
      }
      axis++;
    }
    ++this.m_proxyCount;
    let r = 0;
    while (r < this.m_queryResultCount) {
      this.m_pairManager.AddBufferedPair(proxyId, this.m_queryResults[r]);
      r++;
    }
    this.m_pairManager.Commit();
    this.m_queryResultCount = 0;
    this.IncrementTimeStamp();
    return proxyId;
  }

  // b2BroadPhase.as:286-409
  public DestroyProxy(proxyId: number): void {
    const proxy: b2Proxy = this.m_proxyPool[proxyId];
    const boundCount: number = 2 * this.m_proxyCount;
    let axis = 0;
    while (axis < 2) {
      const bounds: b2Bound[] = this.m_bounds[axis];
      const lowerIndex: number = proxy.lowerBounds[axis] >>> 0;
      const upperIndex: number = proxy.upperBounds[axis] >>> 0;
      let bound: b2Bound = bounds[lowerIndex];
      const lowerValue: number = bound.value;
      bound = bounds[upperIndex];
      const upperValue: number = bound.value;

      let copy1: b2Bound[] = new Array();
      let count1: number = upperIndex - lowerIndex - 1;
      let k = 0;
      while (k < count1) {
        copy1[k] = new b2Bound();
        const dst: b2Bound = copy1[k];
        const src: b2Bound = bounds[lowerIndex + 1 + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }
      count1 = copy1.length;
      let destStart: number = lowerIndex;
      k = 0;
      while (k < count1) {
        const src: b2Bound = copy1[k];
        const dst: b2Bound = bounds[destStart + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }

      let copy2: b2Bound[] = new Array();
      let count2: number = boundCount - upperIndex - 1;
      k = 0;
      while (k < count2) {
        copy2[k] = new b2Bound();
        const dst: b2Bound = copy2[k];
        const src: b2Bound = bounds[upperIndex + 1 + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }
      count2 = copy2.length;
      destStart = upperIndex - 1;
      k = 0;
      while (k < count2) {
        const src: b2Bound = copy2[k];
        const dst: b2Bound = bounds[destStart + k];
        dst.value = src.value;
        dst.proxyId = src.proxyId;
        dst.stabbingCount = src.stabbingCount;
        k++;
      }

      let n: number = boundCount - 2;
      let updateIndex: number = lowerIndex;
      while (updateIndex < n) {
        bound = bounds[updateIndex];
        const proxyN: b2Proxy = this.m_proxyPool[bound.proxyId];
        if (bound.IsLower()) {
          proxyN.lowerBounds[axis] = updateIndex;
        } else {
          proxyN.upperBounds[axis] = updateIndex;
        }
        updateIndex++;
      }
      n = upperIndex - 1;
      let stabIndex: number = lowerIndex;
      while (stabIndex < n) {
        bound = bounds[stabIndex];
        --bound.stabbingCount;
        stabIndex++;
      }
      this.Query([0], [0], lowerValue, upperValue, bounds, boundCount - 2, axis);
      axis++;
    }
    let r = 0;
    while (r < this.m_queryResultCount) {
      this.m_pairManager.RemoveBufferedPair(proxyId, this.m_queryResults[r]);
      r++;
    }
    this.m_pairManager.Commit();
    this.m_queryResultCount = 0;
    this.IncrementTimeStamp();
    proxy.userData = null;
    proxy.overlapCount = b2BroadPhase.b2_invalid;
    proxy.lowerBounds[0] = b2BroadPhase.b2_invalid;
    proxy.lowerBounds[1] = b2BroadPhase.b2_invalid;
    proxy.upperBounds[0] = b2BroadPhase.b2_invalid;
    proxy.upperBounds[1] = b2BroadPhase.b2_invalid;
    proxy.SetNext(this.m_freeProxy);
    this.m_freeProxy = proxyId;
    --this.m_proxyCount;
  }

  // b2BroadPhase.as:411-621
  public MoveProxy(proxyId: number, aabb: b2AABB): void {
    if (proxyId === b2Pair.b2_nullProxy || b2Settings.b2_maxProxies <= proxyId) {
      return;
    }
    if (aabb.IsValid() === false) {
      return;
    }
    const boundCount: number = 2 * this.m_proxyCount;
    const proxy: b2Proxy = this.m_proxyPool[proxyId];
    const newValues: b2BoundValues = new b2BoundValues();
    this.ComputeBounds(newValues.lowerValues, newValues.upperValues, aabb);
    const oldValues: b2BoundValues = new b2BoundValues();
    let axis = 0;
    while (axis < 2) {
      let bound: b2Bound = this.m_bounds[axis][proxy.lowerBounds[axis]];
      oldValues.lowerValues[axis] = bound.value;
      bound = this.m_bounds[axis][proxy.upperBounds[axis]];
      oldValues.upperValues[axis] = bound.value;
      axis++;
    }
    axis = 0;
    while (axis < 2) {
      const bounds: b2Bound[] = this.m_bounds[axis];
      const lowerIndex: number = proxy.lowerBounds[axis] >>> 0;
      const upperIndex: number = proxy.upperBounds[axis] >>> 0;
      const lowerValue: number = newValues.lowerValues[axis] >>> 0;
      const upperValue: number = newValues.upperValues[axis] >>> 0;

      let boundLower: b2Bound = bounds[lowerIndex];
      const deltaLower: number = lowerValue - boundLower.value;
      boundLower.value = lowerValue;
      let boundUpper: b2Bound = bounds[upperIndex];
      const deltaUpper: number = upperValue - boundUpper.value;
      boundUpper.value = upperValue;

      // lower bound moves left
      if (deltaLower < 0) {
        let index: number = lowerIndex;
        while (index > 0 && lowerValue < (bounds[index - 1] as b2Bound).value) {
          const bnd: b2Bound = bounds[index];
          const prev: b2Bound = bounds[index - 1];
          const prevProxyId: number = prev.proxyId;
          const prevProxy: b2Proxy = this.m_proxyPool[prev.proxyId];
          ++prev.stabbingCount;
          if (prev.IsUpper() === true) {
            if (this.TestOverlap(newValues, prevProxy)) {
              this.m_pairManager.AddBufferedPair(proxyId, prevProxyId);
            }
            prevProxy.upperBounds[axis] = (prevProxy.upperBounds[axis] | 0) + 1;
            ++bnd.stabbingCount;
          } else {
            prevProxy.lowerBounds[axis] = (prevProxy.lowerBounds[axis] | 0) + 1;
            --bnd.stabbingCount;
          }
          proxy.lowerBounds[axis] = (proxy.lowerBounds[axis] | 0) - 1;
          bnd.Swap(prev);
          index--;
        }
      }
      // upper bound moves right
      if (deltaUpper > 0) {
        let index: number = upperIndex;
        while (index < boundCount - 1 && (bounds[index + 1] as b2Bound).value <= upperValue) {
          const bnd: b2Bound = bounds[index];
          const next: b2Bound = bounds[index + 1];
          const nextProxyId: number = next.proxyId;
          const nextProxy: b2Proxy = this.m_proxyPool[nextProxyId];
          ++next.stabbingCount;
          if (next.IsLower() === true) {
            if (this.TestOverlap(newValues, nextProxy)) {
              this.m_pairManager.AddBufferedPair(proxyId, nextProxyId);
            }
            nextProxy.lowerBounds[axis] = (nextProxy.lowerBounds[axis] | 0) - 1;
            ++bnd.stabbingCount;
          } else {
            nextProxy.upperBounds[axis] = (nextProxy.upperBounds[axis] | 0) - 1;
            --bnd.stabbingCount;
          }
          proxy.upperBounds[axis] = (proxy.upperBounds[axis] | 0) + 1;
          bnd.Swap(next);
          index++;
        }
      }
      // lower bound moves right
      if (deltaLower > 0) {
        let index: number = lowerIndex;
        while (index < boundCount - 1 && (bounds[index + 1] as b2Bound).value <= lowerValue) {
          const bnd: b2Bound = bounds[index];
          const next: b2Bound = bounds[index + 1];
          const nextProxyId: number = next.proxyId;
          const nextProxy: b2Proxy = this.m_proxyPool[nextProxyId];
          --next.stabbingCount;
          if (next.IsUpper()) {
            if (this.TestOverlap(oldValues, nextProxy)) {
              this.m_pairManager.RemoveBufferedPair(proxyId, nextProxyId);
            }
            nextProxy.upperBounds[axis] = (nextProxy.upperBounds[axis] | 0) - 1;
            --bnd.stabbingCount;
          } else {
            nextProxy.lowerBounds[axis] = (nextProxy.lowerBounds[axis] | 0) - 1;
            ++bnd.stabbingCount;
          }
          proxy.lowerBounds[axis] = (proxy.lowerBounds[axis] | 0) + 1;
          bnd.Swap(next);
          index++;
        }
      }
      // upper bound moves left
      if (deltaUpper < 0) {
        let index: number = upperIndex;
        while (index > 0 && upperValue < (bounds[index - 1] as b2Bound).value) {
          const bnd: b2Bound = bounds[index];
          const prev: b2Bound = bounds[index - 1];
          const prevProxyId: number = prev.proxyId;
          const prevProxy: b2Proxy = this.m_proxyPool[prevProxyId];
          --prev.stabbingCount;
          if (prev.IsLower() === true) {
            if (this.TestOverlap(oldValues, prevProxy)) {
              this.m_pairManager.RemoveBufferedPair(proxyId, prevProxyId);
            }
            prevProxy.lowerBounds[axis] = (prevProxy.lowerBounds[axis] | 0) + 1;
            --bnd.stabbingCount;
          } else {
            prevProxy.upperBounds[axis] = (prevProxy.upperBounds[axis] | 0) + 1;
            ++bnd.stabbingCount;
          }
          proxy.upperBounds[axis] = (proxy.upperBounds[axis] | 0) - 1;
          bnd.Swap(prev);
          index--;
        }
      }
      axis++;
    }
  }

  // b2BroadPhase.as:623-626
  public Commit(): void {
    this.m_pairManager.Commit();
  }

  // b2BroadPhase.as:628-652
  public QueryAABB(aabb: b2AABB, userData: unknown[], maxCount: number): number {
    const lowerValues: number[] = new Array();
    const upperValues: number[] = new Array();
    this.ComputeBounds(lowerValues, upperValues, aabb);
    const lowerOut: number[] = [0];
    const upperOut: number[] = [0];
    this.Query(lowerOut, upperOut, lowerValues[0], upperValues[0], this.m_bounds[0], 2 * this.m_proxyCount, 0);
    this.Query(lowerOut, upperOut, lowerValues[1], upperValues[1], this.m_bounds[1], 2 * this.m_proxyCount, 1);
    let count: number = 0;
    let i: number = 0;
    while (i < this.m_queryResultCount && count < maxCount) {
      const proxy: b2Proxy = this.m_proxyPool[this.m_queryResults[i]];
      userData[i] = proxy.userData;
      i++;
      count++;
    }
    this.m_queryResultCount = 0;
    this.IncrementTimeStamp();
    return count;
  }

  // b2BroadPhase.as:654-687
  public Validate(): void {
    let axis = 0;
    while (axis < 2) {
      const bounds: b2Bound[] = this.m_bounds[axis];
      const boundCount: number = 2 * this.m_proxyCount;
      let stabbingCount: number = 0;
      let i: number = 0;
      while (i < boundCount) {
        const bound: b2Bound = bounds[i];
        if (bound.IsLower() === true) {
          stabbingCount++;
        } else {
          stabbingCount--;
        }
        i++;
      }
      axis++;
    }
  }

  // b2BroadPhase.as:689-939
  public QuerySegment(
    segment: b2Segment,
    userData: unknown[],
    maxCount: number,
    sortKey: ((userData: unknown) => number) | null,
  ): number {
    const maxLambda: number = 1;
    const dxQ: number = (segment.p2.x - segment.p1.x) * this.m_quantizationFactor.x;
    const dyQ: number = (segment.p2.y - segment.p1.y) * this.m_quantizationFactor.y;
    const sx: number = dxQ < -Number.MIN_VALUE ? -1 : dxQ > Number.MIN_VALUE ? 1 : 0;
    const sy: number = dyQ < -Number.MIN_VALUE ? -1 : dyQ > Number.MIN_VALUE ? 1 : 0;
    const p1x: number = this.m_quantizationFactor.x * (segment.p1.x - this.m_worldAABB.lowerBound.x);
    const p1y: number = this.m_quantizationFactor.y * (segment.p1.y - this.m_worldAABB.lowerBound.y);
    const startValues: number[] = new Array();
    const startValues2: number[] = new Array();
    startValues[0] = (p1x >>> 0) & (b2Settings.USHRT_MAX - 1);
    startValues[1] = (p1y >>> 0) & (b2Settings.USHRT_MAX - 1);
    startValues2[0] = startValues[0] + 1;
    startValues2[1] = startValues[1] + 1;
    const lowerOut: number[] = [0];
    const upperOut: number[] = [0];
    let xIndex: number;
    let yIndex: number;
    this.Query(lowerOut, upperOut, startValues[0], startValues2[0], this.m_bounds[0], 2 * this.m_proxyCount, 0);
    if (sx >= 0) {
      xIndex = upperOut[0] - 1;
    } else {
      xIndex = lowerOut[0];
    }
    this.Query(lowerOut, upperOut, startValues[1], startValues2[1], this.m_bounds[1], 2 * this.m_proxyCount, 1);
    if (sy >= 0) {
      yIndex = upperOut[0] - 1;
    } else {
      yIndex = lowerOut[0];
    }
    if (sortKey != null) {
      let q: number = 0;
      while (q < this.m_queryResultCount) {
        this.m_querySortKeys[q] = sortKey(this.m_proxyPool[this.m_queryResults[q]].userData);
        q++;
      }
      q = 0;
      while (q < this.m_queryResultCount - 1) {
        const a: number = this.m_querySortKeys[q];
        const b: number = this.m_querySortKeys[q + 1];
        if (a < 0 ? b >= 0 : a > b && b >= 0) {
          this.m_querySortKeys[q + 1] = a;
          this.m_querySortKeys[q] = b;
          const tmp: number = this.m_queryResults[q + 1] >>> 0;
          this.m_queryResults[q + 1] = this.m_queryResults[q];
          this.m_queryResults[q] = tmp;
          if (--q === -1) {
            q = 1;
          }
        } else {
          q++;
        }
      }
      while (this.m_queryResultCount > 0 && this.m_querySortKeys[this.m_queryResultCount - 1] < 0) {
        --this.m_queryResultCount;
      }
    }
    let proceed: boolean = true;
    if (xIndex < 0 || xIndex >= this.m_proxyCount * 2) {
      proceed = false;
    }
    if (yIndex < 0 || yIndex >= this.m_proxyCount * 2) {
      proceed = false;
    }
    let xProgress: number = NaN;
    let yProgress: number = NaN;
    if (proceed) {
      if (sx !== 0) {
        if (sx > 0) {
          if (++xIndex === this.m_proxyCount * 2) {
            proceed = false;
          }
        } else if (--xIndex < 0) {
          proceed = false;
        }
        xProgress = (this.m_bounds[0][xIndex].value - p1x) / dxQ;
      }
      if (sy !== 0) {
        if (sy > 0) {
          if (++yIndex === this.m_proxyCount * 2) {
            proceed = false;
          }
        } else if (--yIndex < 0) {
          proceed = false;
        }
        yProgress = (this.m_bounds[1][yIndex].value - p1y) / dyQ;
      }
    }
    while (proceed) {
      if (sy === 0 || (sx !== 0 && xProgress < yProgress)) {
        if (xProgress > maxLambda) {
          break;
        }
        if (sx > 0 ? this.m_bounds[0][xIndex].IsLower() : this.m_bounds[0][xIndex].IsUpper()) {
          const proxyId: number = this.m_bounds[0][xIndex].proxyId >>> 0;
          const proxy: b2Proxy = this.m_proxyPool[proxyId];
          if (sy >= 0) {
            if (proxy.lowerBounds[1] <= yIndex - 1 && proxy.upperBounds[1] >= yIndex) {
              if (sortKey != null) {
                this.AddProxyResult(proxyId, proxy, maxCount, sortKey);
              } else {
                this.m_queryResults[this.m_queryResultCount] = proxyId;
                ++this.m_queryResultCount;
              }
            }
          } else if (proxy.lowerBounds[1] <= yIndex && proxy.upperBounds[1] >= yIndex + 1) {
            if (sortKey != null) {
              this.AddProxyResult(proxyId, proxy, maxCount, sortKey);
            } else {
              this.m_queryResults[this.m_queryResultCount] = proxyId;
              ++this.m_queryResultCount;
            }
          }
        }
        if (
          sortKey != null &&
          this.m_queryResultCount === maxCount &&
          this.m_queryResultCount > 0 &&
          xProgress > this.m_querySortKeys[this.m_queryResultCount - 1]
        ) {
          break;
        }
        if (sx > 0) {
          if (++xIndex === this.m_proxyCount * 2) {
            break;
          }
        } else if (--xIndex < 0) {
          break;
        }
        xProgress = (this.m_bounds[0][xIndex].value - p1x) / dxQ;
      } else {
        if (yProgress > maxLambda) {
          break;
        }
        if (sy > 0 ? this.m_bounds[1][yIndex].IsLower() : this.m_bounds[1][yIndex].IsUpper()) {
          const proxyId: number = this.m_bounds[1][yIndex].proxyId >>> 0;
          const proxy: b2Proxy = this.m_proxyPool[proxyId];
          if (sx >= 0) {
            if (proxy.lowerBounds[0] <= xIndex - 1 && proxy.upperBounds[0] >= xIndex) {
              if (sortKey != null) {
                this.AddProxyResult(proxyId, proxy, maxCount, sortKey);
              } else {
                this.m_queryResults[this.m_queryResultCount] = proxyId;
                ++this.m_queryResultCount;
              }
            }
          } else if (proxy.lowerBounds[0] <= xIndex && proxy.upperBounds[0] >= xIndex + 1) {
            if (sortKey != null) {
              this.AddProxyResult(proxyId, proxy, maxCount, sortKey);
            } else {
              this.m_queryResults[this.m_queryResultCount] = proxyId;
              ++this.m_queryResultCount;
            }
          }
        }
        if (
          sortKey != null &&
          this.m_queryResultCount === maxCount &&
          this.m_queryResultCount > 0 &&
          yProgress > this.m_querySortKeys[this.m_queryResultCount - 1]
        ) {
          break;
        }
        if (sy > 0) {
          if (++yIndex === this.m_proxyCount * 2) {
            break;
          }
        } else if (--yIndex < 0) {
          break;
        }
        yProgress = (this.m_bounds[1][yIndex].value - p1y) / dyQ;
      }
    }
    let count: number = 0;
    let i: number = 0;
    while (i < this.m_queryResultCount && count < maxCount) {
      const proxy: b2Proxy = this.m_proxyPool[this.m_queryResults[i]];
      userData[i] = proxy.userData;
      i++;
      count++;
    }
    this.m_queryResultCount = 0;
    this.IncrementTimeStamp();
    return count;
  }

  // b2BroadPhase.as:941-959
  private ComputeBounds(lowerValues: number[], upperValues: number[], aabb: b2AABB): void {
    let minVertexX: number = aabb.lowerBound.x;
    let minVertexY: number = aabb.lowerBound.y;
    minVertexX = b2Math.b2Min(minVertexX, this.m_worldAABB.upperBound.x);
    minVertexY = b2Math.b2Min(minVertexY, this.m_worldAABB.upperBound.y);
    minVertexX = b2Math.b2Max(minVertexX, this.m_worldAABB.lowerBound.x);
    minVertexY = b2Math.b2Max(minVertexY, this.m_worldAABB.lowerBound.y);
    let maxVertexX: number = aabb.upperBound.x;
    let maxVertexY: number = aabb.upperBound.y;
    maxVertexX = b2Math.b2Min(maxVertexX, this.m_worldAABB.upperBound.x);
    maxVertexY = b2Math.b2Min(maxVertexY, this.m_worldAABB.upperBound.y);
    maxVertexX = b2Math.b2Max(maxVertexX, this.m_worldAABB.lowerBound.x);
    maxVertexY = b2Math.b2Max(maxVertexY, this.m_worldAABB.lowerBound.y);
    lowerValues[0] = ((this.m_quantizationFactor.x * (minVertexX - this.m_worldAABB.lowerBound.x)) >>> 0) & (b2Settings.USHRT_MAX - 1);
    upperValues[0] = (((this.m_quantizationFactor.x * (maxVertexX - this.m_worldAABB.lowerBound.x)) >>> 0) & 0xffff) | 1;
    lowerValues[1] = ((this.m_quantizationFactor.y * (minVertexY - this.m_worldAABB.lowerBound.y)) >>> 0) & (b2Settings.USHRT_MAX - 1);
    upperValues[1] = (((this.m_quantizationFactor.y * (maxVertexY - this.m_worldAABB.lowerBound.y)) >>> 0) & 0xffff) | 1;
  }

  // b2BroadPhase.as:987-1008
  public TestOverlap(values: b2BoundValues, proxy: b2Proxy): boolean {
    let axis = 0;
    while (axis < 2) {
      const bounds: b2Bound[] = this.m_bounds[axis];
      let bound: b2Bound = bounds[proxy.upperBounds[axis]];
      if (values.lowerValues[axis] > bound.value) {
        return false;
      }
      bound = bounds[proxy.lowerBounds[axis]];
      if (values.upperValues[axis] < bound.value) {
        return false;
      }
      axis++;
    }
    return true;
  }

  // b2BroadPhase.as:1010-1050
  private Query(
    lowerQueryOut: number[],
    upperQueryOut: number[],
    lowerValue: number,
    upperValue: number,
    bounds: b2Bound[],
    boundCount: number,
    axis: number,
  ): void {
    const lowerQuery: number = b2BroadPhase.BinarySearch(bounds, boundCount, lowerValue);
    const upperQuery: number = b2BroadPhase.BinarySearch(bounds, boundCount, upperValue);
    let i: number = lowerQuery;
    while (i < upperQuery) {
      const bound: b2Bound = bounds[i];
      if (bound.IsLower()) {
        this.IncrementOverlapCount(bound.proxyId);
      }
      i++;
    }
    if (lowerQuery > 0) {
      let index: number = lowerQuery - 1;
      let bound: b2Bound = bounds[index];
      let count: number = bound.stabbingCount;
      while (count) {
        bound = bounds[index];
        if (bound.IsLower()) {
          const proxy: b2Proxy = this.m_proxyPool[bound.proxyId];
          if (lowerQuery <= proxy.upperBounds[axis]) {
            this.IncrementOverlapCount(bound.proxyId);
            count--;
          }
        }
        index--;
      }
    }
    lowerQueryOut[0] = lowerQuery;
    upperQueryOut[0] = upperQuery;
  }

  // b2BroadPhase.as:1052-1066
  private IncrementOverlapCount(proxyId: number): void {
    const proxy: b2Proxy = this.m_proxyPool[proxyId];
    if (proxy.timeStamp < this.m_timeStamp) {
      proxy.timeStamp = this.m_timeStamp;
      proxy.overlapCount = 1;
    } else {
      proxy.overlapCount = 2;
      this.m_queryResults[this.m_queryResultCount] = proxyId;
      ++this.m_queryResultCount;
    }
  }

  // b2BroadPhase.as:1068-1085
  private IncrementTimeStamp(): void {
    if (this.m_timeStamp === b2Settings.USHRT_MAX) {
      let i: number = 0;
      while (i < b2Settings.b2_maxProxies) {
        (this.m_proxyPool[i] as b2Proxy).timeStamp = 0;
        i++;
      }
      this.m_timeStamp = 1;
    } else {
      ++this.m_timeStamp;
    }
  }

  // b2BroadPhase.as:1087-1118
  private AddProxyResult(
    proxyId: number,
    proxy: b2Proxy,
    maxCount: number,
    sortKey: (userData: unknown) => number,
  ): void {
    const key: number = sortKey(proxy.userData);
    if (key < 0) {
      return;
    }
    let i: number = 0;
    while (i < this.m_queryResultCount && this.m_querySortKeys[i] < key) {
      i++;
    }
    let tempKey: number = key;
    let tempId: number = proxyId;
    this.m_queryResultCount += 1;
    if (this.m_queryResultCount > maxCount) {
      this.m_queryResultCount = maxCount;
    }
    while (i < this.m_queryResultCount) {
      const swapKey: number = this.m_querySortKeys[i];
      const swapId: number = this.m_queryResults[i] >>> 0;
      this.m_querySortKeys[i] = tempKey;
      this.m_queryResults[i] = tempId;
      tempKey = swapKey;
      tempId = swapId;
      i++;
    }
  }
}
