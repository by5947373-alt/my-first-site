// 島上的景點、分類與道路。
//
// 店家／景點的「位置、地址、電話、營業時間」來自 assets/map-data.js（window.SHUISHANG_SPOTS），
// 也就是後台編輯的 src/content.json —— 後台改圖釘位置，島上的建築也會跟著搬家。
// 這裡只補上 3D 模型種類、人文地產景分類和介紹文字。
import { pctToWorld, toWorld, type V2 } from './geo';

export type Cat = 'ren' | 'wen' | 'di' | 'chan' | 'jing';
export const CATS: { id: Cat; label: string; en: string; color: string }[] = [
  { id: 'ren', label: '人', en: 'PEOPLE', color: '#E07A5F' },
  { id: 'wen', label: '文', en: 'CULTURE', color: '#A77BB0' },
  { id: 'di', label: '地', en: 'PLACE', color: '#4F97B7' },
  { id: 'chan', label: '產', en: 'INDUSTRY', color: '#D99A2B' },
  { id: 'jing', label: '景', en: 'SCENERY', color: '#5FA36B' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c])) as Record<Cat, (typeof CATS)[number]>;

export type Model =
  | 'tropic' | 'space' | 'sugar' | 'coffee' | 'mansion' | 'temple' | 'market' | 'butterfly'
  | 'herbfarm' | 'fruit' | 'coop' | 'studio' | 'duck' | 'cafe' | 'bakery' | 'rice' | 'shop'
  | 'station' | 'airport' | 'bridge';

export interface Poi {
  id: string;
  name: string;
  cat: Cat;
  model: Model;
  pos: V2;
  /** 旋轉（弧度），讓建築正面朝向道路 */
  rot?: number;
  feature: string;
  text: string;
  addr?: string | null;
  tel?: string | null;
  hours?: string | null;
  email?: string | null;
  /** 市區小店：鏡頭拉近才顯示名稱，避免標籤擠成一團 */
  minor?: boolean;
}

interface Spot { c: string; n: string; x: number; y: number; f: string; a: string | null; t: string | null; h: string | null; e: string | null }
declare global { interface Window { SHUISHANG_SPOTS?: Spot[] } }

type Def = Omit<Poi, 'pos' | 'feature'> & { feature?: string; px?: V2; match?: string };

// px 是沒有對應 map-data 圖釘時用的畫框座標（1000 × 625）
const DEFS: Def[] = [
  { id: 'tropic', name: '北回歸線標誌', cat: 'di', model: 'tropic', px: [482, 158], feature: '北緯 23.5°・太陽轉身的地方',
    text: '北回歸線穿過水上鄉。每年夏至正午，太陽直射這條線，影子幾乎消失——「23.5° 剛剛好的城市」的名字就從這裡來。點一下標誌塔，看看陽光落下的那一刻。' },
  { id: 'space', match: '北回歸線太空教育館', name: '北回歸線太空教育館', cat: 'jing', model: 'space',
    text: '緊鄰北回歸線標誌的天文科學館，從 23.5° 的地理意義出發，帶大人小孩認識太陽、星球與太空探索。' },
  { id: 'airport', name: '嘉義水上機場', cat: 'di', model: 'airport', px: [337, 130], rot: -0.65, feature: '嘉義的空中門戶',
    text: '嘉義地區唯一的民用機場就在水上鄉北邊，飛往離島的班機從這裡起降。抬頭看看，小飛機正繞著島嶼飛行。' },
  { id: 'station', name: '水上車站', cat: 'di', model: 'station', px: [372, 269], rot: -0.87, feature: '縱貫線上的小站',
    text: '台鐵縱貫線上的水上車站，是市區生活圈的起點。火車沿著真實的鐵道路線在島上來回奔馳。' },
  { id: 'nanjing-st', name: '南靖車站', cat: 'di', model: 'station', px: [305, 386], rot: -1.4, feature: '糖廠旁的老車站',
    text: '鄰近南靖糖廠的小車站，過去是運糖、通勤的重要節點。' },
  { id: 'sugar', match: '南靖糖廠', name: '南靖糖廠', cat: 'chan', model: 'sugar', rot: 0.2,
    text: '百年糖廠仍在運轉，製糖期煙囪冒出白煙，空氣裡有淡淡甜味。冰品部和五分車鐵道是在地人的共同記憶。' },
  { id: 'mansion', match: '白人牙膏觀光工廠', name: '白人牙膏觀光工廠', cat: 'wen', model: 'mansion', rot: 0.1,
    text: '台灣經典牙膏品牌的觀光工廠，園區內古色古香的將軍府建築，可以體驗產業故事與 DIY。' },
  { id: 'coffee', match: '品皇咖啡觀光工廠', name: '品皇咖啡觀光工廠', cat: 'chan', model: 'coffee', rot: 0.3,
    text: '從一顆咖啡豆開始的香氣之旅：參觀烘焙與製程，認識咖啡風味，再帶一杯回家。' },
  { id: 'temple', name: '庄頭廟宇', cat: 'wen', model: 'temple', px: [352, 252], rot: 0.05, feature: '守護聚落的信仰中心',
    text: '水上的每個聚落幾乎都有自己的廟宇，是祭典、廟埕市集與鄰里聚會的地方。燈籠輕輕搖晃，香煙裊裊。' },
  { id: 'market', name: '水上夜市', cat: 'ren', model: 'market', px: [398, 305], rot: -0.3, feature: '傍晚亮起的生活風景',
    text: '天色暗下來，攤位的燈泡一盞盞亮起，小吃、遊戲和鄰居的招呼聲，是最在地的水上日常。' },
  { id: 'butterfly', name: '蝴蝶生態園', cat: 'jing', model: 'butterfly', px: [700, 330], feature: '花叢間的蝴蝶',
    text: '東側丘陵的自然地景，花圃與綠蔭吸引蝴蝶停留。放慢腳步，看看在花間飛舞的小翅膀。' },
  { id: 'river', name: '八掌溪', cat: 'jing', model: 'bridge', px: [470, 322], rot: 0.55, feature: '流過水上的母親之河',
    text: '八掌溪由東向西流過水上，有一段就是鄉界。河岸是騎單車、看夕陽的好地方。' },
  { id: 'xianpu', match: '仙圃企業', name: '仙圃企業', cat: 'chan', model: 'herbfarm',
    text: '水上是紅骨仙草的故鄉。仙圃企業種植、加工仙草，做成仙草茶、仙草乾與濃縮液。' },
  { id: 'qingmu', match: '青木堂', name: '青木堂', cat: 'chan', model: 'fruit',
    text: '在地新鮮蔬果的集散處：木瓜、鳳梨、文旦、哈密瓜，跟著季節換上不同的顏色。' },
  { id: 'coop', match: '水上鄉農會', name: '水上鄉農會', cat: 'chan', model: 'coop', minor: true,
    text: '把水上的蓮藕、稻米與仙草做成伴手禮，是農產與餐桌之間的橋樑。' },
  { id: 'studio', match: '水上美生活文化工作室', name: '水上美生活文化工作室', cat: 'ren', model: 'studio', minor: true,
    text: '用仙草做麵、做醬，甚至做成顏料。地方職人把在地作物變成生活裡的新樣子。' },
  { id: 'duck', match: '廣東烤鴨莊', name: '廣東烤鴨莊', cat: 'ren', model: 'duck', minor: true, text: '在地老字號的烤鴨，搭配仙草甜麵醬。' },
  { id: 'cafe', match: '雨豆樹咖啡輕飲', name: '雨豆樹咖啡輕飲', cat: 'ren', model: 'cafe', minor: true, text: '大樹下的咖啡輕食，招牌是仙菇干貝雞。' },
  { id: 'bakery', match: '烘焙旅程', name: '烘焙旅程', cat: 'ren', model: 'bakery', minor: true, text: '把仙草揉進可頌裡的小烘焙坊。' },
  { id: 'rice', match: '林叨抵嘉火雞肉飯', name: '林叨抵嘉火雞肉飯', cat: 'ren', model: 'rice', minor: true, text: '一碗經典嘉義火雞肉飯。' },
];

const FALLBACK_CAT: Record<string, Cat> = { taste: 'ren', culture: 'wen', grow: 'chan' };

/** 合併靜態定義與 map-data.js 的即時資料。 */
export function buildPois(spots: Spot[] = window.SHUISHANG_SPOTS || []): Poi[] {
  const used = new Set<string>();
  const out: Poi[] = [];
  for (const d of DEFS) {
    const s = d.match ? spots.find((x) => x.n === d.match) : undefined;
    if (s) used.add(s.n);
    const pos = s ? pctToWorld(s.x, s.y) : d.px ? toWorld(d.px) : null;
    if (!pos) continue; // 後台刪掉了這個據點
    out.push({
      id: d.id, name: d.name, cat: d.cat, model: d.model, rot: d.rot, minor: d.minor, text: d.text,
      pos, feature: s?.f || d.feature || '', addr: s?.a, tel: s?.t, hours: s?.h, email: s?.e,
    });
  }
  // 後台新增、這裡還沒設定模型的據點：放一棟通用小店
  spots.filter((s) => !used.has(s.n)).forEach((s, i) => out.push({
    id: 'spot-' + i, name: s.n, cat: FALLBACK_CAT[s.c] || 'ren', model: 'shop', pos: pctToWorld(s.x, s.y),
    feature: s.f, text: '', addr: s.a, tel: s.t, hours: s.h, email: s.e, minor: true,
  }));
  return relax(out);
}

/** 市區店家彼此距離不到 200 公尺，圖釘疊在一起；3D 建築需要一點空間，所以輕輕推開。 */
function relax(pois: Poi[]): Poi[] {
  const P = pois.map((p) => [...p.pos] as V2);
  const R = (p: Poi) => (p.minor ? 0.62 : ['market', 'sugar', 'temple', 'airport'].includes(p.model) ? 1.15 : 0.9);
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[j][0] - P[i][0], dz = P[j][1] - P[i][1];
      const d = Math.hypot(dx, dz) || 0.01, min = R(pois[i]) + R(pois[j]);
      if (d < min) {
        const push = (min - d) / 2, ux = dx / d, uz = dz / d;
        P[i][0] -= ux * push; P[i][1] -= uz * push; P[j][0] += ux * push; P[j][1] += uz * push;
      }
    }
  }
  return pois.map((p, i) => ({ ...p, pos: P[i] }));
}

// ── 道路（示意路線，串起主要聚落與景點；畫框座標） ──
export const ROADS_PX: { name: string; main?: boolean; pts: V2[] }[] = [
  { name: '台1線', main: true, pts: [[505, 118], [470, 168], [430, 214], [400, 252], [388, 280], [362, 318], [338, 352], [318, 392], [312, 432]] },
  { name: '縣道168', main: true, pts: [[150, 262], [240, 268], [318, 276], [388, 282], [452, 292], [520, 312], [600, 340], [690, 372], [770, 420], [830, 468]] },
  { name: '品皇咖啡路', pts: [[318, 276], [262, 248], [205, 226], [170, 214]] },
  { name: '機場路', pts: [[388, 280], [372, 236], [352, 186], [340, 140]] },
  { name: '南靖路', pts: [[388, 282], [352, 300], [330, 326], [300, 372], [282, 410]] },
  { name: '中庄路', pts: [[600, 340], [640, 300], [705, 285], [760, 270], [818, 290]] },
  { name: '回歸路', pts: [[430, 214], [470, 200], [520, 196], [548, 220]] },
];
