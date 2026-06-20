// Port of Box2D/Collision/b2ContactID.as (Box2DFlash 2.0.2), line-by-line.
// `key` is a uint packing the four feature bytes; its setter decomposes the key into
// Features (and Features' setters recompose it). `_key` kept in uint range via `>>>0`.
import { Features } from "./Features";

export class b2ContactID {
  public features: Features = new Features();
  public _key: number = 0;

  // b2ContactID.as:11-15
  constructor() {
    this.features._m_id = this;
  }

  // b2ContactID.as:17-20
  public Set(id: b2ContactID): void {
    this.key = id._key;
  }

  // b2ContactID.as:22-27
  public Copy(): b2ContactID {
    const id: b2ContactID = new b2ContactID();
    id.key = this.key;
    return id;
  }

  // b2ContactID.as:29-32
  public get key(): number {
    return this._key;
  }

  // b2ContactID.as:34-41
  public set key(value: number) {
    this._key = value >>> 0;
    this.features._referenceEdge = this._key & 0xff;
    this.features._incidentEdge = ((this._key & 0xff00) >> 8) & 0xff;
    this.features._incidentVertex = ((this._key & 0xff0000) >> 16) & 0xff;
    this.features._flip = ((this._key & 0xff000000) >> 24) & 0xff;
  }
}
