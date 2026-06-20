import struct, zlib
from collections import defaultdict

data = open("mspaintracer.swf","rb").read()
body = zlib.decompress(data[8:])

# re-walk tags to grab DoABC (82) and DefineBinaryData (87)
def read_rect(b,pos):
    nbits=b[pos]>>3; total=5+nbits*4; return pos+(total+7)//8
pos=read_rect(body,0)+4
abcs=[]; bindata=[]
while pos<len(body):
    cl=struct.unpack("<H",body[pos:pos+2])[0]; pos+=2
    code=cl>>6; ln=cl&0x3f
    if ln==0x3f: ln=struct.unpack("<I",body[pos:pos+4])[0]; pos+=4
    payload=body[pos:pos+ln]
    if code==82: abcs.append(payload)
    elif code==87: bindata.append(payload)
    if code==0: break
    pos+=ln

print(f"DoABC tags: {len(abcs)}  sizes: {[len(a) for a in abcs]}")

class R:
    def __init__(s,b): s.b=b; s.p=0
    def u8(s): v=s.b[s.p]; s.p+=1; return v
    def u30(s):
        r=0; sh=0
        while True:
            x=s.b[s.p]; s.p+=1; r|=(x&0x7f)<<sh
            if not (x&0x80): break
            sh+=7
        return r
    u32=u30
    def s32(s): return s.u30()
    def d64(s): v=struct.unpack("<d",s.b[s.p:s.p+8])[0]; s.p+=8; return v
    def strn(s): n=s.u30(); v=s.b[s.p:s.p+n].decode('utf-8','replace'); s.p+=n; return v

KINDS={0:'Slot',1:'Method',2:'Getter',3:'Setter',4:'Class',5:'Function',6:'Const'}

def parse_abc(buf):
    r=R(buf)
    minor=struct.unpack("<H",buf[0:2])[0]; major=struct.unpack("<H",buf[2:4])[0]; r.p=4
    # ints
    n=r.u30(); ints=[0]+[r.s32() for _ in range(n-1)] if n else [0]
    n=r.u30(); uints=[0]+[r.u32() for _ in range(n-1)] if n else [0]
    n=r.u30(); dbls=[0]+[r.d64() for _ in range(n-1)] if n else [0]
    n=r.u30(); strs=[""]+[r.strn() for _ in range(n-1)] if n else [""]
    # namespaces
    n=r.u30(); ns=[(0,0)]
    for _ in range(1,n): k=r.u8(); nm=r.u30(); ns.append((k,nm))
    # ns sets
    n=r.u30(); nss=[[]]
    for _ in range(1,n):
        c=r.u30(); nss.append([r.u30() for _ in range(c)])
    # multinames
    n=r.u30(); mn=[None]
    for _ in range(1,n):
        kind=r.u8()
        if kind in (0x07,0x0D): nsi=r.u30(); nmi=r.u30(); mn.append(('Q',nsi,nmi))
        elif kind in (0x0F,0x10): nmi=r.u30(); mn.append(('RTQ',nmi))
        elif kind in (0x11,0x12): mn.append(('RTQL',))
        elif kind in (0x09,0x0E): nmi=r.u30(); nsset=r.u30(); mn.append(('M',nmi,nsset))
        elif kind in (0x1B,0x1C): nsset=r.u30(); mn.append(('ML',nsset))
        elif kind==0x1D:
            nm0=r.u30(); c=r.u30(); params=[r.u30() for _ in range(c)]; mn.append(('TYPE',nm0,params))
        else: mn.append(('?',kind))
    def ns_name(i):
        if i==0 or i>=len(ns): return ""
        return strs[ns[i][1]] if ns[i][1]<len(strs) else ""
    def mn_name(i):
        if i==0 or i is None or i>=len(mn) or mn[i] is None: return "*"
        t=mn[i]
        if t[0]=='Q':
            nm=strs[t[2]] if t[2]<len(strs) else ""
            pkg=ns_name(t[1])
            return (pkg+"::" if pkg else "")+nm
        if t[0]=='M': return strs[t[1]] if t[1]<len(strs) else "*"
        if t[0]=='TYPE':
            base=mn_name(t[1]); ps=".<"+",".join(mn_name(p) for p in t[2])+">"
            return base+ps
        return "*"
    # methods
    method_count=r.u30()
    methods=[]
    for _ in range(method_count):
        pc=r.u30(); rt=r.u30(); ptypes=[r.u30() for _ in range(pc)]
        nmi=r.u30(); flags=r.u8()
        if flags&0x08:
            oc=r.u30()
            for _ in range(oc): r.u30(); r.u8()
        if flags&0x80:
            for _ in range(pc): r.u30()
        methods.append((strs[nmi] if nmi<len(strs) else "", rt))
    # metadata
    mc=r.u30()
    for _ in range(mc):
        r.u30(); ic=r.u30()
        for _ in range(ic): r.u30(); r.u30()
    def parse_traits():
        tc=r.u30(); out=[]
        for _ in range(tc):
            tname=r.u30(); tk=r.u8(); kind=tk&0x0f; attrs=tk>>4
            if kind in (0,6): r.u30(); r.u30(); vi=r.u30(); 
            if kind in (0,6):
                if vi!=0: r.u8()
                data=None
            if kind in (1,2,3): r.u30(); midx=r.u30(); data=('m',midx)
            elif kind==4: r.u30(); r.u30(); data=None
            elif kind==5: r.u30(); r.u30(); data=None
            elif kind in (0,6): data=None
            if attrs&0x04:
                mdc=r.u30()
                for _ in range(mdc): r.u30()
            out.append((mn_name(tname), KINDS.get(kind,'?')))
        return out
    # classes
    class_count=r.u30()
    instances=[]
    for _ in range(class_count):
        name=r.u30(); supr=r.u30(); flags=r.u8()
        if flags&0x08: r.u30()
        ic=r.u30(); ifaces=[r.u30() for _ in range(ic)]
        iinit=r.u30()
        traits=parse_traits()
        instances.append({'name':mn_name(name),'super':mn_name(supr),
                          'ifaces':[mn_name(x) for x in ifaces],'traits':traits})
    return {'major':major,'minor':minor,'nstr':len(strs),'nmethod':method_count,
            'nclass':class_count,'instances':instances}

allinst=[]
for a in abcs:
    info=parse_abc(a)
    print(f"  ABC v{info['major']}.{info['minor']}  strings={info['nstr']} methods={info['nmethod']} classes={info['nclass']}")
    allinst+=info['instances']

# Group classes by package
pkgs=defaultdict(list)
for c in allinst:
    nm=c['name']
    if '::' in nm: pkg,cls=nm.split('::',1)
    else: pkg,cls='(top level)',nm
    pkgs[pkg].append(c)

print("="*70)
print(f"TOTAL CLASSES: {len(allinst)}")
print("="*70)

# Filter out the standard Adobe fl.* component framework + flash player API to focus on game code
def is_lib(pkg):
    return pkg.startswith(('fl.','flash.','flashx.','adobe.','com.adobe','mx.','__AS3__'))

game=[p for p in pkgs if not is_lib(p)]
lib=[p for p in pkgs if is_lib(p)]

print("\n### GAME CODE PACKAGES (non-library) ###\n")
for pkg in sorted(game):
    classes=pkgs[pkg]
    print(f"\n■ package {pkg}   ({len(classes)} classes)")
    for c in sorted(classes,key=lambda x:x['name']):
        cls=c['name'].split('::',1)[-1]
        sup=c['super'].split('::',1)[-1]
        meth=[t[0] for t in c['traits'] if t[1] in ('Method','Getter','Setter')]
        slots=[t[0] for t in c['traits'] if t[1] in ('Slot','Const')]
        extra=f" : {sup}" if sup not in('Object','*','') else ""
        ifc=(" impl "+",".join(i.split('::')[-1] for i in c['ifaces'])) if c['ifaces'] else ""
        print(f"   • {cls}{extra}{ifc}  [{len(meth)} methods, {len(slots)} fields]")

print("\n\n### LIBRARY / FRAMEWORK PACKAGES (counts only) ###")
for pkg in sorted(lib):
    print(f"   {pkg}: {len(pkgs[pkg])} classes")
