// Port of Box2D/Collision/b2PairManager.as (Box2DFlash 2.0.2), line-by-line.
// Hash table of proxy-pairs + a deferred add/remove buffer flushed in Commit().
//
// uint discipline: AS3 holds the hash key in a `uint` local, so EVERY assignment
// re-coerces mod 2^32. We mirror that with `>>> 0` after each step. `>>` stays a
// SIGNED shift (matches ECMAScript/AS3). Masks/shifts are reproduced verbatim.
import { b2Settings } from "../Common/b2Settings";
import { b2Pair } from "./b2Pair";
import { b2BufferedPair } from "./b2BufferedPair";
import type { b2Proxy } from "./b2Proxy";
import type { b2BroadPhase } from "./b2BroadPhase";
import type { b2PairCallback } from "./b2PairCallback";

export class b2PairManager {
  public m_broadPhase!: b2BroadPhase;
  public m_callback!: b2PairCallback;
  public m_pairs: b2Pair[];
  public m_freePair: number = 0; // AS3 uint default 0 (the free-list head; ctor relies on it)
  public m_pairCount: number = 0;
  public m_pairBuffer: b2BufferedPair[];
  public m_pairBufferCount: number = 0;
  public m_hashTable: number[];

  // b2PairManager.as:25-63
  constructor() {
    this.m_hashTable = new Array(b2Pair.b2_tableCapacity);
    let i = 0;
    while (i < b2Pair.b2_tableCapacity) {
      this.m_hashTable[i] = b2Pair.b2_nullPair;
      i++;
    }
    this.m_pairs = new Array(b2Settings.b2_maxPairs);
    i = 0;
    while (i < b2Settings.b2_maxPairs) {
      this.m_pairs[i] = new b2Pair();
      i++;
    }
    this.m_pairBuffer = new Array(b2Settings.b2_maxPairs);
    i = 0;
    while (i < b2Settings.b2_maxPairs) {
      this.m_pairBuffer[i] = new b2BufferedPair();
      i++;
    }
    i = 0;
    while (i < b2Settings.b2_maxPairs) {
      this.m_pairs[i].proxyId1 = b2Pair.b2_nullProxy;
      this.m_pairs[i].proxyId2 = b2Pair.b2_nullProxy;
      this.m_pairs[i].userData = null;
      this.m_pairs[i].status = 0;
      this.m_pairs[i].next = i + 1;
      i++;
    }
    this.m_pairs[b2Settings.b2_maxPairs - 1].next = b2Pair.b2_nullPair;
    this.m_pairCount = 0;
    this.m_pairBufferCount = 0;
  }

  // b2PairManager.as:65-74 — Thomas Wang integer hash. uint-coerce each step.
  public static Hash(proxyId1: number, proxyId2: number): number {
    let key = ((((proxyId2 << 16) & 0xffff0000) | proxyId1) >>> 0);
    key = (~key + ((key << 15) & 0xffff8000)) >>> 0;
    key = (key ^ ((key >> 12) & 0x000fffff)) >>> 0;
    key = (key + ((key << 2) & 0xfffffffc)) >>> 0;
    key = (key ^ ((key >> 4) & 0x0fffffff)) >>> 0;
    key = (key * 2057) >>> 0;
    key = (key ^ ((key >> 16) & 0x0000ffff)) >>> 0;
    return key;
  }

  // b2PairManager.as:76-79
  public static Equals(pair: b2Pair, proxyId1: number, proxyId2: number): boolean {
    return pair.proxyId1 === proxyId1 && pair.proxyId2 === proxyId2;
  }

  // b2PairManager.as:81-84
  public static EqualsPair(pair1: b2BufferedPair, pair2: b2BufferedPair): boolean {
    return pair1.proxyId1 === pair2.proxyId1 && pair1.proxyId2 === pair2.proxyId2;
  }

  // b2PairManager.as:86-90
  public Initialize(broadPhase: b2BroadPhase, callback: b2PairCallback): void {
    this.m_broadPhase = broadPhase;
    this.m_callback = callback;
  }

  // b2PairManager.as:92-109
  public AddBufferedPair(id1: number, id2: number): void {
    const pair: b2Pair = this.AddPair(id1, id2);
    if (pair.IsBuffered() === false) {
      pair.SetBuffered();
      const bp: b2BufferedPair = this.m_pairBuffer[this.m_pairBufferCount];
      bp.proxyId1 = pair.proxyId1;
      bp.proxyId2 = pair.proxyId2;
      ++this.m_pairBufferCount;
    }
    pair.ClearRemoved();
    // b2BroadPhase.s_validate is false (ValidateBuffer is a no-op) — omitted.
  }

  // b2PairManager.as:111-132
  public RemoveBufferedPair(id1: number, id2: number): void {
    const pair: b2Pair | null = this.Find(id1, id2);
    if (pair == null) {
      return;
    }
    if (pair.IsBuffered() === false) {
      pair.SetBuffered();
      const bp: b2BufferedPair = this.m_pairBuffer[this.m_pairBufferCount];
      bp.proxyId1 = pair.proxyId1;
      bp.proxyId2 = pair.proxyId2;
      ++this.m_pairBufferCount;
    }
    pair.SetRemoved();
  }

  // b2PairManager.as:134-181
  public Commit(): void {
    let removeCount: number = 0;
    const proxies: b2Proxy[] = this.m_broadPhase.m_proxyPool as b2Proxy[];
    let i = 0;
    while (i < this.m_pairBufferCount) {
      let bp: b2BufferedPair = this.m_pairBuffer[i];
      const pair: b2Pair = this.Find(bp.proxyId1, bp.proxyId2)!;
      pair.ClearBuffered();
      const proxy1: b2Proxy = proxies[pair.proxyId1];
      const proxy2: b2Proxy = proxies[pair.proxyId2];
      if (pair.IsRemoved()) {
        if (pair.IsFinal() === true) {
          this.m_callback.PairRemoved(proxy1.userData, proxy2.userData, pair.userData);
        }
        bp = this.m_pairBuffer[removeCount];
        bp.proxyId1 = pair.proxyId1;
        bp.proxyId2 = pair.proxyId2;
        removeCount++;
      } else if (pair.IsFinal() === false) {
        pair.userData = this.m_callback.PairAdded(proxy1.userData, proxy2.userData);
        pair.SetFinal();
      }
      i++;
    }
    i = 0;
    while (i < removeCount) {
      const bp: b2BufferedPair = this.m_pairBuffer[i];
      this.RemovePair(bp.proxyId1, bp.proxyId2);
      i++;
    }
    this.m_pairBufferCount = 0;
  }

  // b2PairManager.as:183-209
  private AddPair(id1: number, id2: number): b2Pair {
    let proxyId1: number = id1;
    let proxyId2: number = id2;
    if (proxyId1 > proxyId2) {
      const tmp: number = proxyId1;
      proxyId1 = proxyId2;
      proxyId2 = tmp;
    }
    const hash: number = (b2PairManager.Hash(proxyId1, proxyId2) & b2Pair.b2_tableMask) >>> 0;
    let pair: b2Pair | null = this.FindHash(proxyId1, proxyId2, hash);
    if (pair != null) {
      return pair;
    }
    const pairIndex: number = this.m_freePair;
    pair = this.m_pairs[pairIndex];
    this.m_freePair = pair.next;
    pair.proxyId1 = proxyId1;
    pair.proxyId2 = proxyId2;
    pair.status = 0;
    pair.userData = null;
    pair.next = this.m_hashTable[hash];
    this.m_hashTable[hash] = pairIndex;
    ++this.m_pairCount;
    return pair;
  }

  // b2PairManager.as:211-255
  private RemovePair(id1: number, id2: number): unknown {
    let proxyId1: number = id1;
    let proxyId2: number = id2;
    if (proxyId1 > proxyId2) {
      const tmp: number = proxyId1;
      proxyId1 = proxyId2;
      proxyId2 = tmp;
    }
    const hash: number = (b2PairManager.Hash(proxyId1, proxyId2) & b2Pair.b2_tableMask) >>> 0;
    let index: number = this.m_hashTable[hash] >>> 0;
    let node: b2Pair | null = null;
    while (index !== b2Pair.b2_nullPair) {
      if (b2PairManager.Equals(this.m_pairs[index], proxyId1, proxyId2)) {
        const removeIndex: number = index;
        let pair: b2Pair = this.m_pairs[index];
        if (node) {
          node.next = pair.next;
        } else {
          this.m_hashTable[hash] = pair.next;
        }
        pair = this.m_pairs[removeIndex];
        const userData: unknown = pair.userData;
        pair.next = this.m_freePair;
        pair.proxyId1 = b2Pair.b2_nullProxy;
        pair.proxyId2 = b2Pair.b2_nullProxy;
        pair.userData = null;
        pair.status = 0;
        this.m_freePair = removeIndex;
        --this.m_pairCount;
        return userData;
      }
      node = this.m_pairs[index];
      index = node.next;
    }
    return null;
  }

  // b2PairManager.as:257-268
  private Find(id1: number, id2: number): b2Pair | null {
    let proxyId1: number = id1;
    let proxyId2: number = id2;
    if (proxyId1 > proxyId2) {
      const tmp: number = proxyId1;
      proxyId1 = proxyId2;
      proxyId2 = tmp;
    }
    const hash: number = (b2PairManager.Hash(proxyId1, proxyId2) & b2Pair.b2_tableMask) >>> 0;
    return this.FindHash(proxyId1, proxyId2, hash);
  }

  // b2PairManager.as:270-285
  private FindHash(proxyId1: number, proxyId2: number, hash: number): b2Pair | null {
    let index: number = this.m_hashTable[hash] >>> 0;
    let pair: b2Pair = this.m_pairs[index];
    while (index !== b2Pair.b2_nullPair && b2PairManager.Equals(pair, proxyId1, proxyId2) === false) {
      index = pair.next;
      pair = this.m_pairs[index];
    }
    if (index === b2Pair.b2_nullPair) {
      return null;
    }
    return pair;
  }
}
