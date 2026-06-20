// AS3-faithful scalar conversions for the data loaders.
//
// The raw attribute STRINGS in data/*.json are kept verbatim by tools/extract_data.py
// (raw-string discipline — see contracts/game-data.ts). These functions reproduce the
// EXACT conversions the original AS3 used, so loaded values are bit-identical to the
// shipped game. Cite the AS3 source above each.

/** XmlHelper.GetAttrString(v, def=""): present → String(v), absent → def. */
export function str(v: string | undefined | null, def = ""): string {
  return v === undefined || v === null ? def : String(v);
}

/** XmlHelper.GetAttrNumber(v, def=0): present → Number(v), absent → def.
 *  AS3 Number() === JS Number(): ""→0, "1.5"→1.5, non-numeric→NaN. */
export function num(v: string | undefined | null, def = 0): number {
  return v === undefined || v === null ? def : Number(v);
}

/** XmlHelper.GetAttrInt(v, def=0): present → int(v), absent → def.
 *  AS3 int() = ToInt32(ToNumber(v)): truncates toward zero, NaN→0. int("1.9")=1,
 *  int("abc")=0, int("")=0. (int32 wrap is irrelevant for this data's magnitudes.) */
export function int(v: string | undefined | null, def = 0): number {
  if (v === undefined || v === null) return def;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : Math.trunc(n);
}

/** XmlHelper.GetAttrBoolean(v, def=false): present → (v === "true"), absent → def.
 *  Note: ONLY the literal string "true" is truthy here (the AS3 compares to "true"). */
export function bool(v: string | undefined | null, def = false): boolean {
  if (v === undefined || v === null) return def;
  return v === "true";
}

/**
 * Utils.GetParams: parse a `params="k=v,k=v"` CSV into a map.
 * Split on ",", then each piece on "=". A bare key (no "=") → boolean `true`
 * (a flag); otherwise key → value string. Empty/absent → empty map.
 * (AS3 takes split("=")[1] as the value, so a value containing "=" keeps only its
 *  first segment — matched here, though this data has none.)
 */
export function parseParams(params: string | null | undefined): Map<string, string | true> {
  const out = new Map<string, string | true>();
  if (params == null || params === "") return out;
  for (const piece of params.split(",")) {
    const kv = piece.split("=");
    if (kv.length === 1) out.set(kv[0], true);
    else out.set(kv[0], kv[1]);
  }
  return out;
}

/** Read a numeric value off a parsed param map (a flag/`true` or missing → def). */
export function paramNum(p: Map<string, string | true>, key: string, def = 0): number {
  const v = p.get(key);
  return typeof v === "string" ? Number(v) : def;
}

/** Read a string value off a parsed param map (a flag/`true` or missing → def). */
export function paramStr(p: Map<string, string | true>, key: string, def = ""): string {
  const v = p.get(key);
  return typeof v === "string" ? v : def;
}
