// Port of Box2D/Collision/Features.as (Box2DFlash 2.0.2), line-by-line.
// The four collision-feature bytes are a VIEW over the owning b2ContactID's uint key:
// each setter writes its byte back into `_m_id._key`. uint key kept in range via `>>>0`.
import type { b2ContactID } from "./b2ContactID";

export class Features {
  // AS3 int fields default to 0.
  public _referenceEdge: number = 0;
  public _incidentEdge: number = 0;
  public _incidentVertex: number = 0;
  public _flip: number = 0;
  public _m_id!: b2ContactID;

  // Features.as:17-25
  public set referenceEdge(value: number) {
    this._referenceEdge = value;
    this._m_id._key = ((this._m_id._key & 0xffffff00) | (this._referenceEdge & 0xff)) >>> 0;
  }
  public get referenceEdge(): number {
    return this._referenceEdge;
  }

  // Features.as:27-35
  public set incidentEdge(value: number) {
    this._incidentEdge = value;
    this._m_id._key = ((this._m_id._key & 0xffff00ff) | ((this._incidentEdge << 8) & 0xff00)) >>> 0;
  }
  public get incidentEdge(): number {
    return this._incidentEdge;
  }

  // Features.as:37-45
  public set incidentVertex(value: number) {
    this._incidentVertex = value;
    this._m_id._key = ((this._m_id._key & 0xff00ffff) | ((this._incidentVertex << 16) & 0xff0000)) >>> 0;
  }
  public get incidentVertex(): number {
    return this._incidentVertex;
  }

  // Features.as:47-55
  public set flip(value: number) {
    this._flip = value;
    this._m_id._key = ((this._m_id._key & 0xffffff) | ((this._flip << 24) & 0xff000000)) >>> 0;
  }
  public get flip(): number {
    return this._flip;
  }
}
