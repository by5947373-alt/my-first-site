// 島上的景點、分類與道路。
//
// 店家／景點的「位置、地址、電話、營業時間」在 src/spots.json；
// 這裡補上 3D 模型種類、人文地產景分類和介紹文字。
// spots.json 的 x / y 是 1000 × 625 畫框的百分比座標（和 geo.json 同一個座標系）。
import { pctToWorld, toWorld, type V2 } from './geo';
import SPOTS from './spots.json';

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

/** 合併模型定義與 spots.json 的店家資料。 */
export function buildPois(spots: Spot[] = SPOTS as Spot[]): Poi[] {
  const used = new Set<string>();
  const out: Poi[] = [];
  for (const d of DEFS) {
    const s = d.match ? spots.find((x) => x.n === d.match) : undefined;
    if (s) used.add(s.n);
    const pos = s ? pctToWorld(s.x, s.y) : d.px ? toWorld(d.px) : null;
    if (!pos) continue; // spots.json 裡刪掉了這個據點
    out.push({
      id: d.id, name: d.name, cat: d.cat, model: d.model, rot: d.rot, minor: d.minor, text: d.text,
      pos, feature: s?.f || d.feature || '', addr: s?.a, tel: s?.t, hours: s?.h, email: s?.e,
    });
  }
  // spots.json 新增、這裡還沒設定模型的據點：放一棟通用小店
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

// ── 在地連結：景點之間串起來的人、物、故事（「搬運」的小人和「連結線」都看這份） ──
// 這些是示意的在地故事，說明產地、店家與景點之間的關係；內容可依實際情況修改。
export interface Link { from: string; to: string; what: string; story: string }
export const LINKS: Link[] = [
  { from: 'xianpu', to: 'studio', what: '紅骨仙草', story: '仙草田採收的紅骨仙草，到工作室變成仙草麵、仙草醬與仙草顏料。' },
  { from: 'xianpu', to: 'coop', what: '仙草乾', story: '曬好的仙草乾送到農會，做成仙草蓮藕吸凍等伴手禮。' },
  { from: 'studio', to: 'duck', what: '仙草甜麵醬', story: '烤鴨捲餅裡的那一抹仙草甜麵醬，來自在地的仙草。' },
  { from: 'studio', to: 'bakery', what: '仙草粉', story: '仙草揉進麵團，烤成帶有草本香氣的仙草可頌。' },
  { from: 'coop', to: 'rice', what: '在地白米', story: '水上的稻米，盛成一碗嘉義火雞肉飯。' },
  { from: 'coop', to: 'qingmu', what: '蓮藕與米', story: '農會與蔬果店一起，把當季農產送到大家的餐桌。' },
  { from: 'qingmu', to: 'market', what: '當季水果', story: '木瓜、鳳梨、文旦，夜市的果汁攤最懂季節。' },
  { from: 'sugar', to: 'market', what: '糖廠冰品', story: '糖廠的冰品是好幾代水上人的共同記憶。' },
  { from: 'coffee', to: 'cafe', what: '咖啡香', story: '從觀光工廠到市區咖啡館，水上有自己的咖啡日常。' },
  { from: 'station', to: 'tropic', what: '旅人', story: '從水上車站出發，往北騎一段路，就到北回歸線。' },
  { from: 'tropic', to: 'space', what: '23.5° 的故事', story: '標誌塔旁的太空教育館，把北回歸線的地理意義講成天文故事。' },
  { from: 'airport', to: 'space', what: '旅人', story: '搭飛機抵達，第一站就去看太陽轉身的地方。' },
  { from: 'nanjing-st', to: 'sugar', what: '旅人', story: '下了南靖車站，走幾步就是百年糖廠。' },
  { from: 'temple', to: 'market', what: '廟埕人潮', story: '廟會散場，人潮順著街走進夜市。' },
  { from: 'mansion', to: 'station', what: '伴手禮', story: '逛完觀光工廠，帶著伴手禮到車站搭車回家。' },
  { from: 'river', to: 'butterfly', what: '綠色廊道', story: '八掌溪沿岸的綠帶，連起東側丘陵的蝴蝶棲地。' },
];

// ── 角色測驗：你是水上的哪一種旅人？ ──
export const QUIZ: { q: string; a: { t: string; c: Cat }[] }[] = [
  { q: '週末一早醒來，你最想先做什麼？', a: [
    { t: '去市場吃一碗熱騰騰的早餐', c: 'ren' }, { t: '到廟口走走，看看老街', c: 'wen' }, { t: '騎車找一條沒走過的路', c: 'di' }] },
  { q: '旅行時，你最常帶回家的是？', a: [
    { t: '在地小農的農產與伴手禮', c: 'chan' }, { t: '一大堆風景照', c: 'jing' }, { t: '和店家老闆聊天的故事', c: 'ren' }] },
  { q: '如果只能選一個地方待一下午？', a: [
    { t: '觀光工廠，看東西怎麼被做出來', c: 'chan' }, { t: '河堤邊吹風、看夕陽', c: 'jing' }, { t: '有故事的老建築', c: 'wen' }] },
  { q: '「北緯 23.5 度」讓你想到？', a: [
    { t: '太陽直射、影子消失的那一刻', c: 'di' }, { t: '夏天的田野和天空', c: 'jing' }, { t: '一個地方的身分與記憶', c: 'wen' }] },
  { q: '你理想中的小旅行節奏是？', a: [
    { t: '吃吃喝喝，一站接一站', c: 'ren' }, { t: '慢慢走，哪裡好看就停下來', c: 'jing' }, { t: '有主題地把一件事弄懂', c: 'chan' }] },
];
export const PERSONAS: Record<Cat, { name: string; text: string; picks: string[] }> = {
  ren: { name: '巷口美食家', text: '你相信一個地方的味道，藏在店家老闆的手藝裡。這趟就從市區的在地小吃開始，吃到夜市。', picks: ['station', 'rice', 'duck', 'bakery', 'market'] },
  wen: { name: '老街記憶收集者', text: '你喜歡聽建築和廟宇說故事。帶上好奇心，從庄頭廟宇走到將軍府和百年糖廠。', picks: ['temple', 'mansion', 'nanjing-st', 'sugar'] },
  di: { name: '23.5° 地理探險家', text: '你對座標、地形和交通特別有感。從車站出發，追著北回歸線，一路走到天空。', picks: ['station', 'tropic', 'space', 'airport'] },
  chan: { name: '產地好奇寶寶', text: '你想知道東西是怎麼來的。從仙草田、農會到觀光工廠，把水上的產業串成一條線。', picks: ['xianpu', 'studio', 'coop', 'coffee', 'sugar'] },
  jing: { name: '慢活風景控', text: '你的旅行沒有行程表，只有好光線。沿著八掌溪，往東邊丘陵找蝴蝶。', picks: ['river', 'butterfly', 'xianpu', 'tropic'] },
};
