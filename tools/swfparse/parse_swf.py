import struct, zlib, sys
from collections import Counter

data = open("mspaintracer.swf","rb").read()
sig = data[:3]
ver = data[3]
flen = struct.unpack("<I", data[4:8])[0]
print(f"Signature: {sig.decode('latin1')}  (CWS=zlib, FWS=raw, ZWS=lzma)")
print(f"SWF version: {ver}")
print(f"Declared length: {flen} (file on disk: {len(data)})")

if sig == b"CWS":
    body = zlib.decompress(data[8:])
elif sig == b"FWS":
    body = data[8:]
else:
    print("Unsupported compression"); sys.exit(1)
print(f"Decompressed body: {len(body)} bytes")

# Parse RECT (frame size) -- skip nbits
def read_rect(b, pos):
    first = b[pos]
    nbits = first >> 3
    total_bits = 5 + nbits*4
    nbytes = (total_bits + 7)//8
    return pos + nbytes
pos = read_rect(body, 0)
frame_rate = struct.unpack("<H", body[pos:pos+2])[0] / 256.0
frame_count = struct.unpack("<H", body[pos+2:pos+4])[0]
pos += 4
print(f"Frame rate: {frame_rate}  Frame count: {frame_count}")
print("="*60)

TAGNAMES = {
0:"End",1:"ShowFrame",2:"DefineShape",4:"PlaceObject",5:"RemoveObject",
6:"DefineBits",7:"DefineButton",8:"JPEGTables",9:"SetBackgroundColor",
10:"DefineFont",11:"DefineText",12:"DoAction",13:"DefineFontInfo",
14:"DefineSound",15:"StartSound",17:"DefineButtonSound",18:"SoundStreamHead",
19:"SoundStreamBlock",20:"DefineBitsLossless",21:"DefineBitsJPEG2",
22:"DefineShape2",23:"DefineButtonCxform",24:"Protect",26:"PlaceObject2",
28:"RemoveObject2",32:"DefineShape3",33:"DefineText2",34:"DefineButton2",
35:"DefineBitsJPEG3",36:"DefineBitsLossless2",37:"DefineEditText",
39:"DefineSprite",43:"FrameLabel",45:"SoundStreamHead2",46:"DefineMorphShape",
48:"DefineFont2",56:"ExportAssets",57:"ImportAssets",58:"EnableDebugger",
59:"DoInitAction",60:"DefineVideoStream",61:"VideoFrame",62:"DefineFontInfo2",
64:"EnableDebugger2",65:"ScriptLimits",66:"SetTabIndex",69:"FileAttributes",
70:"PlaceObject3",71:"ImportAssets2",73:"DefineFontAlignZones",
74:"CSMTextSettings",75:"DefineFont3",76:"SymbolClass",77:"Metadata",
78:"DefineScalingGrid",82:"DoABC",83:"DefineShape4",84:"DefineMorphShape2",
86:"DefineSceneAndFrameLabelData",87:"DefineBinaryData",88:"DefineFontName",
89:"StartSound2",90:"DefineBitsJPEG4",91:"DefineFont4",
}

tags = []
def read_string(b,p):
    e=p
    while b[e]!=0: e+=1
    return b[p:e].decode('latin1'), e+1

exports=[]; symbolclasses=[]; sprite_actions=0; do_actions=0; do_init=0; do_abc=0
while pos < len(body):
    code_len = struct.unpack("<H", body[pos:pos+2])[0]
    pos += 2
    tag_code = code_len >> 6
    tag_len = code_len & 0x3f
    if tag_len == 0x3f:
        tag_len = struct.unpack("<I", body[pos:pos+4])[0]
        pos += 4
    tag_start = pos
    name = TAGNAMES.get(tag_code, f"Unknown({tag_code})")
    tags.append((tag_code,name,tag_len))
    payload = body[tag_start:tag_start+tag_len]
    if tag_code == 56:  # ExportAssets
        cnt = struct.unpack("<H", payload[:2])[0]; p=2
        for _ in range(cnt):
            cid = struct.unpack("<H", payload[p:p+2])[0]; p+=2
            s,p = read_string(payload,p); exports.append((cid,s))
    elif tag_code == 76:  # SymbolClass
        cnt = struct.unpack("<H", payload[:2])[0]; p=2
        for _ in range(cnt):
            cid = struct.unpack("<H", payload[p:p+2])[0]; p+=2
            s,p = read_string(payload,p); symbolclasses.append((cid,s))
    elif tag_code == 12: do_actions+=1
    elif tag_code == 59: do_init+=1
    elif tag_code == 82: do_abc+=1
    if tag_code == 0: break
    pos = tag_start + tag_len

print("TAG INVENTORY (count by type):")
c = Counter(t[1] for t in tags)
for name,n in sorted(c.items(), key=lambda x:-x[1]):
    print(f"  {n:5d}  {name}")
print("="*60)
print(f"AS3 DoABC tags: {do_abc}   AS2 DoAction: {do_actions}   DoInitAction: {do_init}")
print(f"=> Language: {'ActionScript 3' if do_abc else 'ActionScript 2 (or AS1)'}")
print("="*60)
print(f"ExportAssets ({len(exports)}):")
for cid,s in exports[:60]: print(f"  [{cid}] {s}")
print(f"SymbolClass ({len(symbolclasses)}):")
for cid,s in symbolclasses[:60]: print(f"  [{cid}] {s}")
