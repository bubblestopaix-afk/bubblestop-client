from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode, os

VIOLET=(98,62,145); VIOLET_D=(72,44,108); VIOLET_L=(126,86,176)
GREEN=(155,195,30); GREEN_D=(124,158,22)
WHITE=(255,255,255)
W,H=1080,1920; CX=W//2
FD='/tmp/fonts/ttf'
def TITRE(sz): return ImageFont.truetype(f'{FD}/PaytoneOne-Regular.ttf', sz)
def OUT(sz,w='Regular'): return ImageFont.truetype(f'{FD}/Outfit-{w}.ttf', sz)

# cup pictogram
fg=Image.open('/sessions/jolly-nice-hamilton/mnt/bubblestop-client/assets/images/android-icon-foreground.png').convert('RGBA')
cup=fg.crop(fg.getbbox())
def cup_h(h):
    return cup.resize((int(cup.width*h/cup.height),h),Image.LANCZOS)
def cup_col(h,col):
    c=cup_h(h).copy(); px=c.load()
    for y in range(c.height):
        for x in range(c.width):
            r,g,b,a=px[x,y]
            if a>0: px[x,y]=(*col,a)
    return c
cup_white=lambda h: cup_col(h,WHITE)
cup_violet=lambda h: cup_col(h,VIOLET)
logo_white=Image.open('/sessions/jolly-nice-hamilton/mnt/bubblestop-client/store-assets/logos/logo_white.png').convert('RGBA')
logo_violet=Image.open('/sessions/jolly-nice-hamilton/mnt/bubblestop-client/store-assets/logos/logo_violet.png').convert('RGBA')
def paste_logo(img,logo,width,cy):
    h=int(logo.height*width/logo.width); lg=logo.resize((width,h),Image.LANCZOS)
    img.paste(lg,(CX-width//2,int(cy-h/2)),lg)

def vgrad(w,h,c1,c2):
    g=Image.new('RGB',(w,h)); d=ImageDraw.Draw(g)
    for y in range(h):
        t=y/max(1,h-1)
        d.line([(0,y),(w,y)],fill=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3)))
    return g
def paste_center(img, sprite, cy):
    img.paste(sprite,(CX-sprite.width//2, int(cy-sprite.height/2)), sprite)
def ctext(d,y,txt,font,fill): d.text((CX,y),txt,font=font,fill=fill,anchor='mm')
def wrap(d,txt,font,maxw):
    words=txt.split(); lines=[]; cur=''
    for w_ in words:
        t=(cur+' '+w_).strip()
        if d.textlength(t,font=font)<=maxw: cur=t
        else: lines.append(cur); cur=w_
    if cur: lines.append(cur)
    return lines
def cblock(d,y,txt,font,fill,maxw,lh):
    for ln in wrap(d,txt,font,maxw): ctext(d,y,ln,font,fill); y+=lh
    return y

OUT_DIR='/sessions/jolly-nice-hamilton/mnt/bubblestop-client/store-assets/play'
os.makedirs(OUT_DIR,exist_ok=True)

# ===== 1 HERO =====
img=vgrad(W,H,VIOLET_L,VIOLET_D).convert('RGBA'); d=ImageDraw.Draw(img)
glow=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(glow).ellipse([CX-360,360,CX+360,1080],fill=(255,255,255,38)); glow=glow.filter(ImageFilter.GaussianBlur(120))
img=Image.alpha_composite(img,glow); d=ImageDraw.Draw(img)
paste_logo(img, logo_white, 1000, 600)
y=952
ctext(d,y,"Ta carte de fidélité",TITRE(78),WHITE)
ctext(d,y+98,"toujours dans ta poche",TITRE(78),GREEN)
cblock(d,y+205,"Cumule tes tampons et débloque tes boissons offertes.",OUT(44),(232,222,248),880,58)
# chips centered
chips=["Aix","Lyon","Toulouse"]; fchip=OUT(40,'SemiBold'); padx=36; gap=26
ws=[d.textlength(c,font=fchip)+padx*2 for c in chips]; tot=sum(ws)+gap*(len(chips)-1)
x=CX-tot//2; cy=1560
for c,w_ in zip(chips,ws):
    d.rounded_rectangle([x,cy,x+w_,cy+80],radius=40,fill=GREEN); d.text((x+w_/2,cy+40),c,font=fchip,fill=VIOLET_D,anchor='mm'); x+=w_+gap
img.convert('RGB').save(f'{OUT_DIR}/01_hero.png',quality=95)

# ===== 2 TAMPONS =====
img=vgrad(W,H,(246,243,251),(229,221,243)).convert('RGBA'); d=ImageDraw.Draw(img)
ctext(d,168,"Cumule tes tampons",TITRE(72),VIOLET)
ctext(d,258,"à chaque boisson achetée",OUT(44),(110,95,140))
# card centered
CL,CR,CT,CB=90,990,360,1000
card=vgrad(CR-CL,CB-CT,VIOLET,(122,92,172)).convert('RGBA')
m=Image.new('L',(CR-CL,CB-CT),0); ImageDraw.Draw(m).rounded_rectangle([0,0,CR-CL,CB-CT],radius=54,fill=255)
img.paste(card,(CL,CT),m); d=ImageDraw.Draw(img)
# header centered group
paste_logo(img, logo_white, 440, CT+95); d=ImageDraw.Draw(img)
ctext(d,CT+188,"Carte de fidélité",OUT(34,'Medium'),(223,213,243))
# 10 bulles (5x2) : 9 tampons + la 10e = boisson OFFERTE (cadeau). 8 remplis -> reste 1.
r=56; cols=5; spacing=162; y0=CT+320; y1=y0+168; filled=8
xs=[CX+(i-2)*spacing for i in range(cols)]
pos=[(x,y) for y in (y0,y1) for x in xs]
for idx,(cx,cy) in enumerate(pos):
    if idx==9:
        # 10e bulle = cadeau (cercle vert + paquet cadeau blanc + noeud)
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=GREEN)
        bw,bh=64,50; bx0=cx-bw//2; by0=cy-2
        d.rounded_rectangle([bx0,by0,bx0+bw,by0+bh],radius=7,fill=WHITE)
        lw,lh=76,18; lx0=cx-lw//2; ly0=cy-22
        d.rounded_rectangle([lx0,ly0,lx0+lw,ly0+lh],radius=6,fill=WHITE)
        d.rectangle([cx-6,by0,cx+6,by0+bh],fill=GREEN)
        d.rectangle([cx-6,ly0,cx+6,ly0+lh],fill=GREEN)
        d.polygon([(cx,cy-22),(cx-24,cy-42),(cx-24,cy-20)],fill=WHITE)
        d.polygon([(cx,cy-22),(cx+24,cy-42),(cx+24,cy-20)],fill=WHITE)
    elif idx<filled:
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=WHITE)
        mc=cup_violet(66); img.paste(mc,(int(cx-mc.width/2),int(cy-mc.height/2)),mc); d=ImageDraw.Draw(img)
    else:
        d.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(255,255,255,170),width=5)
# progress pill centered
pw=900; d.rounded_rectangle([CX-pw//2,1058,CX+pw//2,1184],radius=63,fill=GREEN)
ctext(d,1121,"Plus que 1 tampon avant ta boisson offerte",OUT(38,'SemiBold'),VIOLET_D)
cblock(d,1300,"Ta carte se met à jour en direct, à chaque passage en caisse.",OUT(40),(96,80,128),860,56)
img.convert('RGB').save(f'{OUT_DIR}/02_tampons.png',quality=95)

# ===== 3 OFFERTE =====
img=vgrad(W,H,GREEN,GREEN_D).convert('RGBA'); d=ImageDraw.Draw(img)
ctext(d,196,"Ta boisson offerte",TITRE(76),WHITE)
ctext(d,292,"une carte pleine = une boisson gratuite",OUT(44),(244,250,222))
disc=Image.new('RGBA',(720,720),(0,0,0,0)); ImageDraw.Draw(disc).ellipse([0,0,720,720],fill=WHITE)
paste_center(img,disc,830); d=ImageDraw.Draw(img)
paste_center(img,cup_violet(420),840); d=ImageDraw.Draw(img)
# badge top-right of disc
bx,by,br=CX+250,560,150
d.ellipse([bx-br,by-br,bx+br,by+br],fill=VIOLET)
d.text((bx,by-30),"100%",font=TITRE(56),fill=WHITE,anchor='mm')
d.text((bx,by+38),"OFFERTE",font=OUT(40,'ExtraBold'),fill=GREEN,anchor='mm')
cblock(d,1330,"Fresh tea & boba — à très vite chez Bubble Stop !",OUT(46),WHITE,900,60)
img.convert('RGB').save(f'{OUT_DIR}/03_offerte.png',quality=95)

# ===== 4 QR =====
img=vgrad(W,H,VIOLET_D,VIOLET).convert('RGBA'); d=ImageDraw.Draw(img)
cblock(d,180,"Montre ton QR en caisse",TITRE(64),WHITE,980,78)
ctext(d,300,"et tes tampons s'ajoutent aussitôt",OUT(42),(224,214,244))
# white card centered
cw,ch,cyt=720,860,420
m=Image.new('L',(cw,ch),0); ImageDraw.Draw(m).rounded_rectangle([0,0,cw,ch],radius=48,fill=255)
bg=Image.new('RGBA',(cw,ch),WHITE); img.paste(bg,(CX-cw//2,cyt),m); d=ImageDraw.Draw(img)
qr=qrcode.QRCode(border=1,box_size=10); qr.add_data("https://bubblestop.fr"); qr.make()
qimg=qr.make_image(fill_color=VIOLET,back_color="white").convert('RGB').resize((560,560),Image.NEAREST)
img.paste(qimg,(CX-280,cyt+50))
paste_logo(img, logo_violet, 360, cyt+712); d=ImageDraw.Draw(img)
ctext(d,cyt+792,"Carte de Léa",OUT(34,'Medium'),(120,100,150))
cblock(d,1430,"Pas de carte en carton à oublier : ta fidélité te suit dans toutes nos boutiques.",OUT(40),(220,210,242),900,54)
img.convert('RGB').save(f'{OUT_DIR}/04_qr.png',quality=95)

print("OK regénérés avec Paytone One + Outfit ->",OUT_DIR)
for fn in sorted(os.listdir(OUT_DIR)):
    if fn.endswith('.png'): print(' ',fn, Image.open(os.path.join(OUT_DIR,fn)).size)
