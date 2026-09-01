# 產生首頁地圖的 SVG 路徑與圖釘座標。
#
# 資料來源：OpenStreetMap（ODbL），水上鄉 relation id = 2790360。
# 先用 Overpass 取回三份原始資料放在同目錄，再執行本檔：
#
#   curl -s https://overpass-api.de/api/interpreter --data-urlencode \
#     'data=[out:json][timeout:80];rel(2790360);out geom;' -o shuishang.json
#   curl -s https://overpass-api.de/api/interpreter --data-urlencode \
#     'data=[out:json][timeout:110];rel(2790360);rel(r);out geom;' -o villages.json
#   curl -s https://overpass-api.de/api/interpreter --data-urlencode \
#     'data=[out:json][timeout:110];rel(2790360);map_to_area->.a;
#      (way["railway"="rail"]["usage"="main"](area.a);
#       way["waterway"="river"](area.a););out geom tags;' -o lines.json
#
# shuishang.json 需先拼成單一封閉環存成 ring.json（見 README 說明或改寫本檔）。
# 輸出 mapdata.json：land / river / rail 路徑、tropicY、spots、marks。
import json, math

W,H,PAD = 1000.0, 625.0, 118.0
ring  = json.load(open('ring.json'))
lines = json.load(open('lines.json'))

LAT0 = 23.4262
KX = 111.320*math.cos(math.radians(LAT0))   # km per degree lon
KY = 110.574                                # km per degree lat

def m(lon,lat): return (lon*KX, lat*KY)
xs=[m(*p)[0] for p in ring]; ys=[m(*p)[1] for p in ring]
x0,x1,y0,y1 = min(xs),max(xs),min(ys),max(ys)
S = (W-2*PAD)/(x1-x0)                       # fit by width; shape stays true
OX = PAD - x0*S
OY = H/2 + (y0+y1)/2*S                      # y flips (north up)
def P(lon,lat):
    X,Y = m(lon,lat)
    return (X*S+OX, OY-Y*S)

# --- Douglas-Peucker ---
def dp(pts, tol):
    if len(pts)<3: return pts
    ax,ay=pts[0]; bx,by=pts[-1]
    dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy) or 1e-9
    im,dm=0,-1
    for i in range(1,len(pts)-1):
        px,py=pts[i]
        d=abs(dy*px-dx*py+bx*ay-by*ax)/L
        if d>dm: im,dm=i,d
    if dm>tol:
        return dp(pts[:im+1],tol)[:-1]+dp(pts[im:],tol)
    return [pts[0],pts[-1]]

proj=[P(*p) for p in ring]
# a closed ring breaks Douglas-Peucker (start == end), so cut it at the two
# extreme-x vertices and simplify each half separately
r = proj[:-1]
i0 = min(range(len(r)), key=lambda i: r[i][0])
r = r[i0:]+r[:i0]
i1 = max(range(len(r)), key=lambda i: r[i][0])
simp = dp(r[:i1+1], 1.15)[:-1] + dp(r[i1:]+[r[0]], 1.15)[:-1]
def path(pts, close=True):
    d='M '+' L '.join('%.1f %.1f'%p for p in pts)
    return d+(' Z' if close else '')

# --- 八掌溪 (real geometry, only what falls inside the view) ---
def in_view(p): return -40 <= p[0] <= W+40 and -40 <= p[1] <= H+40
river=[]
for e in lines['elements']:
    if e.get('tags',{}).get('name')=='八掌溪' and e.get('geometry'):
        pts=[P(g['lon'],g['lat']) for g in e['geometry']]
        pts=dp(pts,1.0)
        if any(in_view(p) for p in pts) and len(pts)>1: river.append(pts)
rail=[]
for e in lines['elements']:
    if e.get('tags',{}).get('railway')=='rail' and e.get('geometry'):
        pts=dp([P(g['lon'],g['lat']) for g in e['geometry']],1.0)
        if len(pts)>1: rail.append(pts)

TROPIC = 23.4534   # the marked line through the 太陽館 / 北回歸線公園
ty = P(120.42, TROPIC)[1]

SPOTS=[
 ('廣東烤鴨莊','taste',23.4302,120.4006),
 ('雨豆樹咖啡輕飲','taste',23.43272,120.39911),
 ('林叨抵嘉火雞肉飯','taste',23.4298,120.4010),
 ('烘焙旅程','taste',23.4292,120.3942),
 ('北回歸線太空教育館','return',23.45339,120.41646),
 ('品皇咖啡觀光工廠','return',23.4445,120.3590),
 ('白人牙膏觀光工廠','return',23.42455,120.39120),
 ('南靖糖廠','return',23.41364,120.38523),
 ('仙圃企業','grow',23.4213,120.4368),
 ('青木堂','grow',23.4327,120.4149),
 ('水上美生活文化工作室','grow',23.4306,120.4003),
 ('水上鄉農會','grow',23.43292,120.39839),
]
MARKS=[('嘉義水上機場',23.45922,120.39252),('水上車站',23.43397,120.39944),
       ('南靖車站',23.41321,120.38641),('北回歸線標誌',23.45465,120.41702)]

print('land bbox px  x %.0f..%.0f   y %.0f..%.0f'%(
    min(p[0] for p in proj),max(p[0] for p in proj),
    min(p[1] for p in proj),max(p[1] for p in proj)))
print('boundary pts %d -> %d ; river segs %d ; rail segs %d'%(len(proj),len(simp),len(river),len(rail)))
print('tropic y = %.1f (%.1f%%)'%(ty, ty/H*100))
print('\n-- spots (x%%, y%%) --')
for n,c,la,lo in SPOTS:
    x,y=P(lo,la); print('%-22s %-6s %6.2f %6.2f'%(n,c,x/W*100,y/H*100))
print('\n-- marks --')
for n,la,lo in MARKS:
    x,y=P(lo,la); print('%-16s %6.2f %6.2f'%(n,x/W*100,y/H*100))

json.dump({'land':path(simp),'river':[path(r,False) for r in river],
           'rail':[path(r,False) for r in rail],'tropicY':round(ty,1),
           'spots':[{'n':n,'c':c,'x':round(P(lo,la)[0]/W*100,2),'y':round(P(lo,la)[1]/H*100,2)} for n,c,la,lo in SPOTS],
           'marks':[{'n':n,'x':round(P(lo,la)[0]/W*100,2),'y':round(P(lo,la)[1]/H*100,2)} for n,la,lo in MARKS]},
          open('mapdata.json','w'), ensure_ascii=False)
