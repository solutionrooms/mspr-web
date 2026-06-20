#!/usr/bin/env python3
"""
mspr data extractor (build-time tool).

Faithfully TRANSCRIBES the SWF's binaryData XML into typed JSON modules the TS game
loader consumes. Design rule (the Prime Directive applies to physics INPUTS too):
preserve raw attribute STRINGS verbatim and do NOT convert numbers here. The TS
loader applies the EXACT conversions the AS3 used (Number(), XmlHelper.GetAttr*,
ObjectParameters, Utils.*FromString) so loaded values are bit-identical to the game.
This script must never lose or reinterpret data.

Sources (extracted/binaryData/ — all 8 blobs are plain XML; see ANALYSIS.md):
  485.bin                          Levels  (8 canonical levels; ignore the triplicate
                                   Ben/Julian merge — the 3 author classes embed THIS file)
  491_..._ObjectsData.bin          materials, physobjs, aicars, objparams, colors, constants
  487_Vars_class_vars.bin          119 tuning variables
  488_..._RoadData.bin             billboards, road surfaces, edges, physical surfaces
  489_..._Achievements.bin         10 achievements
  490_..._ExportedBitmapsData.bin  12 car sprite pivot/offset records
  492_..._TextStrings.bin          68 localised strings (9 languages)
  (486 font BMFont blob is a render asset — skipped.)

Outputs (data/): levels.json, materials.json, physobjs.json, aicars.json,
  objparams.json, colors.json, constants.json, vars.json, roaddata.json,
  achievements.json, caroffsets.json, textstrings.json

Run:  python3 tools/extract_data.py     (or: npm run extract:data)
"""
import json, os
import xml.etree.ElementTree as ET
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BIN  = os.path.join(ROOT, "extracted", "binaryData")
OUT  = os.path.join(ROOT, "data")
os.makedirs(OUT, exist_ok=True)

LEVELS_XML   = "485.bin"
OBJECTS_XML  = "491_ExternalData_class_ObjectsData.bin"
VARS_XML     = "487_Vars_class_vars.bin"
ROADDATA_XML = "488_EditorPackage.RoadEditor.RoadData_class_roadData.bin"
ACH_XML      = "489_AchievementPackage.Achievements_class_embedded_XML.bin"
BMP_XML      = "490_ExternalData_class_ExportedBitmapsData.bin"
TEXT_XML     = "492_TextPackage.TextStrings_class_embedded_XML.bin"

import re
_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)

def parse(path):
    # Editor-authored blobs (Vars, RoadData) embed XML comments containing '--'
    # runs, which strict XML forbids but Flash's E4X parser (XML.ignoreComments)
    # tolerates. Comments are NOT data — strip them so ElementTree accepts the
    # blob. This loses nothing physics/content-relevant.
    with open(os.path.join(BIN, path), "r", encoding="utf-8") as f:
        text = f.read()
    text = _COMMENT.sub("", text)
    return ET.fromstring(text)

def attrs(el):
    """Raw attribute dict, preserving source order & exact string values."""
    return OrderedDict((k, el.attrib[k]) for k in el.attrib)

def kids(el, tag):
    return [attrs(c) for c in el.findall(tag)]

def write(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    n = len(obj) if isinstance(obj, (list, dict)) else "?"
    print(f"  wrote {name:20s} ({os.path.getsize(p):>8d} bytes, {n} records)")

# ---------- 485.bin: levels (track = ordered <block> list + checkpoints) ----------
def extract_levels():
    root = parse(LEVELS_XML)
    levels = []
    for lv in root.findall("level"):
        rec = attrs(lv)  # id, name, displayname, category, desc, bg
        hr = lv.find("heatrush")
        rec["heatrush"] = attrs(hr) if hr is not None else None   # gold/silver/bronze times
        road = lv.find("road")
        if road is not None:
            rec["road"] = OrderedDict(
                randseed=road.attrib.get("randseed"),
                blocks=kids(road, "block"),  # btype,id,z,dist,active,params (params = "k=v,k=v")
                objs=kids(road, "obj"),       # checkpoints: columnid,id,type,x,z,rot,scale,params
            )
        else:
            rec["road"] = None
        rec["joints"] = kids(lv.find("joints"), "joint") if lv.find("joints") is not None else []
        mp = lv.find("map")
        if mp is not None:
            mrec = attrs(mp)
            mrec["mapdata"] = [md.attrib.get("a", "") for md in mp.findall("mapdata")]
            rec["map"] = mrec
        else:
            rec["map"] = None
        levels.append(rec)
    write("levels.json", levels)

# ---------- 491.bin: ObjectsData (multi-section) ----------
def extract_objects():
    root = parse(OBJECTS_XML)

    constants = OrderedDict()
    cs = root.find("constants")
    if cs is not None:
        for c in cs.findall("constant"):
            constants[c.attrib.get("name")] = c.attrib.get("value")  # raw string
    write("constants.json", constants)

    materials = OrderedDict()
    for m in root.findall("material"):
        a = attrs(m)
        materials[a["name"]] = OrderedDict(
            density=a.get("density"), friction=a.get("friction"), restitution=a.get("restitution"))
    write("materials.json", materials)

    write("objparams.json", kids(root, "objparam"))   # name,type,default (editor param schema)
    write("colors.json", [a.get("col") for a in kids(root, "color")])  # 40 hex strings

    physobjs = []
    for po in root.findall("physobj"):
        rec = attrs(po)  # name, hasphysics, inlibrary, initfunction
        rec["graphics"]   = kids(po, "graphic")    # zoffset,rot,pos,frame,scale,clip
        rec["collisions"] = kids(po, "collision")  # type, points (raw)
        rec["bodies"]     = kids(po, "body")       # (if present)
        physobjs.append(rec)
    write("physobjs.json", physobjs)

    polymats = []
    for pm in root.findall("polymat"):
        polymats.append(attrs(pm))  # name,clip,frame,fixed,inittype,col,initfunction,material
    write("polymats.json", polymats)

    aicars = []
    for ac in root.findall("aicar"):
        rec = attrs(ac)  # name, mc, scale, speed ("min,max")
        rec["colors"] = [c.get("col") for c in kids(ac, "color")]  # palette indices
        aicars.append(rec)
    groups = []
    for g in root.findall("aicargroup"):
        groups.append(OrderedDict(name=g.attrib.get("name"),
                                  cars=[c.get("type") for c in kids(g, "car")]))
    write("aicars.json", OrderedDict(cars=aicars, groups=groups))

# ---------- 487.bin: Vars (flat tuning table) ----------
def extract_vars():
    root = parse(VARS_XML)
    write("vars.json", kids(root, "variable"))  # name, type, value (value may be CSV for type=array)

# ---------- 488.bin: RoadData (billboards / surfaces / edges / physical surfaces) ----------
def section(root, container, child):
    el = root.find(container)
    if el is None:
        # some are flat (direct children of <data>)
        return [_with_children(c) for c in root.findall(child)]
    return [_with_children(c) for c in el.findall(child)]

def _with_children(el):
    rec = attrs(el)
    # capture any nested element children generically (e.g. <collision>, <pattern>, <bb>)
    for c in el:
        rec.setdefault("_children", []).append(OrderedDict(tag=c.tag, **attrs(c)))
    return rec

def extract_roaddata():
    root = parse(ROADDATA_XML)
    out = OrderedDict(
        billboards      = [_with_children(b) for b in root.findall("billboard")],
        billboardgroups = [_with_children(b) for b in root.findall("billboardgroup")],
        roadsurfaces    = section(root, "roadsurfaces", "roadsurface"),
        edgesegments    = section(root, "edgesegments", "edgesegment"),
        physicalsurfaces= section(root, "physicalsurfaces", "physicalsurface"),
        objectcolumns   = [_with_children(c) for c in root.findall("objectcolumn")],
        posmarkers      = kids(root, "posmarker"),
    )
    write("roaddata.json", out)

# ---------- 489.bin: Achievements ----------
def extract_achievements():
    root = parse(ACH_XML)
    out = []
    for a in root.findall("achievement"):
        rec = attrs(a)  # specificlevel,name,desc,tounlock,idnetid,specifics
        rec["tests"] = kids(a, "test")   # func, params
        rec["pass"]  = kids(a, "pass")   # func, params
        out.append(rec)
    write("achievements.json", out)

# ---------- 490.bin: ExportedBitmapsData (car sprite pivots/offsets) ----------
def extract_caroffsets():
    root = parse(BMP_XML)
    write("caroffsets.json", kids(root, "item"))  # mcname,mcframe,xoff,width,xoffxf,yoff,markers

# ---------- 492.bin: TextStrings (i18n) ----------
def extract_textstrings():
    root = parse(TEXT_XML)
    write("textstrings.json", kids(root, "textstring"))  # name + one attr per language

if __name__ == "__main__":
    print("Extracting mspr data → data/*.json")
    extract_levels()
    extract_objects()
    extract_vars()
    extract_roaddata()
    extract_achievements()
    extract_caroffsets()
    extract_textstrings()
    print("Done.")
