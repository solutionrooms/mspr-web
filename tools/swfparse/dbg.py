import struct, zlib
data=open("mspaintracer.swf","rb").read(); body=zlib.decompress(data[8:])
def read_rect(b,pos):
    nbits=b[pos]>>3; return pos+((5+nbits*4+7)//8)
pos=read_rect(body,0)+4
abcs=[]
while pos<len(body):
    cl=struct.unpack("<H",body[pos:pos+2])[0]; pos+=2
    code=cl>>6; ln=cl&0x3f
    if ln==0x3f: ln=struct.unpack("<I",body[pos:pos+4])[0]; pos+=4
    if code==82: abcs.append(body[pos:pos+ln])
    if code==0: break
    pos+=ln
buf=abcs[0]
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
    def d64(s): v=struct.unpack("<d",s.b[s.p:s.p+8])[0]; s.p+=8; return v
    def strn(s): n=s.u30(); v=s.b[s.p:s.p+n].decode('utf-8','replace'); s.p+=n; return v
r=R(buf); r.p=4
ni=r.u30(); print("int_count",ni,"at p~",r.p)
ints=[0]+[r.u30() for _ in range(ni-1)]; print("after ints p=",r.p)
nu=r.u30(); print("uint_count",nu); uints=[0]+[r.u30() for _ in range(nu-1)]; print("after uints p=",r.p)
nd=r.u30(); print("double_count",nd,"remaining bytes",len(buf)-r.p)
