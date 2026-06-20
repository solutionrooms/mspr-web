// The payload attached to each b2Body.userData, linking a physics body back to its
// GameObj so the per-frame writeback (GameObjects.updateGOsFromPhysics) can find it.
// Cite: PhysObj_BodyUserData.as { type, bodyName, gameObjectIndex, id } + Clone().
export class PhysObjBodyUserData {
  type = "";
  bodyName = "";
  gameObjectIndex = -1;
  id = 0;

  clone(): PhysObjBodyUserData {
    const c = new PhysObjBodyUserData();
    c.type = this.type;
    c.bodyName = this.bodyName;
    c.gameObjectIndex = this.gameObjectIndex;
    c.id = this.id;
    return c;
  }
}
