// 島上的景點、分類與道路。
//
// 店家／景點的「位置、地址、電話、營業時間」在 src/spots.json；
// 這裡補上 3D 模型種類、人文地產景分類和介紹文字。
// spots.json 的 x / y 是 1000 × 625 畫框的百分比座標（和 geo.json 同一個座標系）。
import { latLonToWorld, type V2 } from './geo';
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
  | 'station' | 'airport' | 'bridge'
  | 'zen' | 'bamboo' | 'hall' | 'tunnel' | 'pond' | 'farm' | 'papaya' | 'tomato' | 'lotus' | 'pharmacy' | 'heritage';

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

type Def = Omit<Poi, 'pos' | 'feature'> & { feature?: string; ll: [number, number]; match?: string };

// ll 是真實的緯度、經度（WGS84）。來源：維基百科、寺廟資料庫、門牌地址點與旅遊資訊；
// 標「示意」的是只知道村落或路段、沒有精確座標的地點。
const DEFS: Def[] = [
  // ── 人 ──
  { id: 'market', name: '水上夜市', cat: 'ren', model: 'market', ll: [23.4345, 120.4100], rot: -0.3, feature: '每週日傍晚的在地夜市',
    text: '每週日傍晚，中正路旁的空地亮起一盞盞燈泡（約 16:30–23:00）。小吃、遊戲和鄰居的招呼聲，是最在地的水上日常。', addr: '嘉義縣水上鄉中正路旁（柳林村一帶）' },
  { id: 'hall', name: '水上市場', cat: 'ren', model: 'hall', ll: [23.4330, 120.4030], feature: '1978 年啟用的公有零售市場',
    text: '正義路上的公有市場，從早上的菜攤、熟食到乾貨，是水上人買菜、吃早餐、交換消息的地方。', addr: '嘉義縣水上鄉正義路（水頭村）', tel: '05-268-3195' },
  // ── 文 ──
  { id: 'kuzhu', name: '苦竹寺', cat: 'wen', model: 'bamboo', ll: [23.43337, 120.41724], rot: 0.2, feature: '1750 年創建的八掌溪畔古剎',
    text: '清乾隆年間創建，坐落在八掌溪北岸的柳林村，周圍綠竹環繞，是水上最古老的寺廟之一。', addr: '嘉義縣水上鄉柳林村柳子林45號', tel: '05-268-3308' },
  { id: 'shangtian', name: '上天宮', cat: 'wen', model: 'temple', ll: [23.4300, 120.3966], rot: 0.05, feature: '水上媽祖廟・1737 年創建',
    text: '璿宿上天宮主祀媽祖，是水上人的信仰中心。廟埕是祭典、市集與鄰里聚會的地方，燈籠輕輕搖晃，香煙裊裊。', addr: '嘉義縣水上鄉水上村中和路233號' },
  { id: 'miaolian', name: '妙蓮禪寺', cat: 'wen', model: 'zen', ll: [23.4188, 120.4192], rot: -0.2, feature: '寧靜的佛教禪寺',
    text: '2003 年創立的佛寺，位在義興村，現在也是讓人靜心的身心靈成長園區。', addr: '嘉義縣水上鄉義興村下菜園15之1號' },
  // ── 地 ──
  { id: 'tropic', name: '北回歸線', cat: 'di', model: 'tropic', ll: [23.45369, 120.41662], feature: '北緯 23.5°・太陽轉身的地方',
    text: '北回歸線穿過水上鄉，台1線旁立著標誌塔。每年夏至正午，太陽直射這條線，影子幾乎消失——「23.5° 剛剛好的城市」的名字就從這裡來。點一下標誌塔，看看陽光落下的那一刻。', addr: '嘉義縣水上鄉台1線旁（回歸村）' },
  { id: 'river', name: '八掌溪', cat: 'di', model: 'bridge', ll: [23.4045, 120.3830], rot: 0.55, feature: '流過水上、也劃出鄉界的河',
    text: '八掌溪由東向西流過水上，南端就是和台南後壁的分界，台1線與縱貫線鐵路在這裡跨過溪面。河岸是騎單車、看夕陽的好地方。' },
  { id: 'tunnel', name: '綠色隧道', cat: 'di', model: 'tunnel', ll: [23.4350, 120.4300], rot: 1.45, feature: '約 2.7 公里的芒果樹綠蔭大道（位置示意）',
    text: '嘉南13線從嘉義市湖子內往南一路到中庄，兩旁的芒果樹枝葉相接，像一條綠色的隧道，夏天騎單車特別涼。' },
  { id: 'pond', name: '九芎埤', cat: 'di', model: 'pond', ll: [23.4540, 120.3760], feature: '塗溝村的埤塘濕地（位置示意）',
    text: '屬於嘉南埤圳國家重要濕地的一部分，近年營造成水雉的浮葉棲地，可以慢慢看水鳥與水生植物。' },
  { id: 'butterfly', name: '蝴蝶園', cat: 'di', model: 'butterfly', ll: [23.4575, 120.3715], feature: '頂塗溝蝴蝶村',
    text: '社區一起營造的蝴蝶生態村，有蝶戀花步道與花圃，蝴蝶在花間飛舞。參觀需要事先預約。', addr: '嘉義縣水上鄉塗溝村頂塗溝13號', tel: '05-371-3190' },
  { id: 'farm', name: '大智慧農場', cat: 'di', model: 'farm', ll: [23.4300, 120.4750], feature: '三界埔的休閒農場（位置示意）',
    text: '大智慧養生休閒農場，位在東側丘陵的三界埔，沿縣道139過了成功大橋就到，可以體驗田園與農事。', addr: '嘉義縣水上鄉三界村三界埔152-23號', tel: '05-377-4916' },
  // ── 產 ──
  { id: 'papaya', name: '木瓜', cat: 'chan', model: 'papaya', ll: [23.4255, 120.4290], feature: '智慧木瓜園（位置示意）',
    text: '水上有大面積的智慧木瓜園，果園分散在各村。圖上的位置是示意，代表東側一帶的木瓜田。' },
  { id: 'tomato', name: '蕃茄', cat: 'chan', model: 'tomato', ll: [23.4470, 120.3640], feature: '大崙村的溫室小番茄',
    text: '大崙村一帶的溫室裡，種著甜甜的牛奶小番茄，水上到太保之間是溫室蕃茄的產地。' },
  { id: 'lotus', name: '蓮子', cat: 'chan', model: 'lotus', ll: [23.4520, 120.3680], feature: '水上蓮香（位置示意）',
    text: '水上鄉農會推廣的「水上蓮香」，以蓮藕、蓮花和蓮子為主，做成蓮藕粉、蓮子甜湯等伴手禮。圖上的位置是塗溝村一帶的示意。' },
  { id: 'xiancao', name: '仙草', cat: 'chan', model: 'herbfarm', ll: [23.4343, 120.4766], feature: '紅骨仙草的故鄉・三界埔',
    text: '水上是紅骨仙草的故鄉，主要產地在東側的三界埔，每年還有仙草柔軟節。中庄的仙圃企業（05-289-2869）等在地業者，把它做成仙草茶、仙草乾與濃縮液。',
    addr: '嘉義縣水上鄉三界村三界埔一帶' },
  { id: 'mansion', match: '白人牙膏觀光工廠', name: '白人牙膏觀光工廠', cat: 'chan', model: 'mansion', ll: [23.42455, 120.39120], rot: 0.1,
    text: '台灣經典牙膏品牌的觀光工廠，園區內古色古香的將軍府建築，可以體驗產業故事與 DIY。' },
  { id: 'coffee', match: '品皇咖啡觀光工廠', name: '品皇咖啡觀光工廠', cat: 'chan', model: 'coffee', ll: [23.4445, 120.3590], rot: 0.3,
    text: '從一顆咖啡豆開始的香氣之旅：參觀烘焙與製程，認識咖啡風味，再帶一杯回家。' },
  { id: 'sugar', match: '南靖糖廠', name: '南靖糖廠', cat: 'chan', model: 'sugar', ll: [23.41364, 120.38523], rot: 0.2,
    text: '百年糖廠仍在運轉，製糖期煙囪冒出白煙，空氣裡有淡淡甜味。冰品部和五分車鐵道是在地人的共同記憶。' },
  { id: 'bakery', match: '烘焙旅程', name: '烘焙旅程', cat: 'chan', model: 'bakery', ll: [23.4292, 120.3942], minor: true, text: '把仙草揉進可頌裡的小烘焙坊。' },
  { id: 'cafe', match: '雨豆樹咖啡輕飲', name: '雨豆樹', cat: 'chan', model: 'cafe', ll: [23.43272, 120.39911], minor: true, text: '大樹下的咖啡輕食，招牌是仙菇干貝雞。' },
  { id: 'duck', match: '廣東烤鴨莊', name: '廣東烤鴨', cat: 'chan', model: 'duck', ll: [23.4302, 120.4006], minor: true, text: '在地老字號的烤鴨，搭配仙草甜麵醬。' },
  { id: 'pharmacy', name: '金成藥鋪', cat: 'chan', model: 'pharmacy', ll: [23.4330, 120.4015], minor: true, feature: '正義路上的老中藥鋪',
    text: '開在正義路上的老藥鋪，木頭櫃子裡是一格格藥材，門口飄著淡淡的草藥香。', addr: '嘉義縣水上鄉正義路69號' },
  // ── 景 ──
  { id: 'space', match: '北回歸線太空教育館', name: '太空教育館', cat: 'jing', model: 'space',  ll: [23.45339, 120.41646],
    text: '緊鄰北回歸線標誌的天文科學館（北回歸線太陽館），從 23.5° 的地理意義出發，帶大人小孩認識太陽、星球與太空探索。' },
  { id: 'heritage', name: '林家古蹟', cat: 'jing', model: 'heritage', ll: [23.4265, 120.3885], feature: '十一指厝的紅磚三合院（位置示意）',
    text: '龍德村十一指厝的林家三合院，紅磚、燕尾和曬穀的埕，留著老聚落的樣子。這是私人住宅，請在外面安靜欣賞。' },
];

/** 合併景點定義與 spots.json 的店家資料（地址、電話、營業時間）。 */
export function buildPois(spots: Spot[] = SPOTS as Spot[]): Poi[] {
  const out: Poi[] = DEFS.map((d) => {
    const s = d.match ? spots.find((x) => x.n === d.match) : undefined;
    return {
      id: d.id, name: d.name, cat: d.cat, model: d.model, rot: d.rot, minor: d.minor, text: d.text,
      pos: latLonToWorld(d.ll[0], d.ll[1]), feature: d.feature || s?.f || '',
      addr: d.addr ?? s?.a, tel: d.tel ?? s?.t, hours: d.hours ?? s?.h, email: d.email ?? s?.e,
    };
  });
  return relax(out);
}

/** 市區店家彼此距離不到 200 公尺，圖釘疊在一起；3D 建築需要一點空間，所以輕輕推開。 */
function relax(pois: Poi[]): Poi[] {
  const P = pois.map((p) => [...p.pos] as V2);
  const R = (p: Poi) => (p.minor ? 0.6 : ['market', 'sugar', 'temple', 'bamboo', 'hall', 'tunnel'].includes(p.model) ? 1.1 : 0.9);
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
  { from: 'xiancao', to: 'duck', what: '仙草甜麵醬', story: '烤鴨捲餅裡那一抹仙草甜麵醬，來自三界埔的紅骨仙草。' },
  { from: 'xiancao', to: 'bakery', what: '仙草粉', story: '仙草揉進麵團，烤成帶有草本香氣的仙草可頌。' },
  { from: 'xiancao', to: 'market', what: '仙草茶', story: '夜市攤上一杯冰涼的仙草茶，是夏夜的標配。' },
  { from: 'farm', to: 'xiancao', what: '山城風景', story: '東側的三界埔丘陵，農場和仙草田比鄰而居。' },
  { from: 'papaya', to: 'hall', what: '當季木瓜', story: '一早從果園採下，送到市場的水果攤。' },
  { from: 'tomato', to: 'hall', what: '牛奶小番茄', story: '大崙村溫室的小番茄，甜到可以直接當零嘴。' },
  { from: 'lotus', to: 'hall', what: '蓮藕與蓮子', story: '水上蓮香，做成蓮藕粉、蓮子湯與伴手禮。' },
  { from: 'hall', to: 'duck', what: '新鮮食材', story: '市場一早進貨，店家的菜色跟著季節走。' },
  { from: 'pharmacy', to: 'hall', what: '老街日常', story: '正義路上，藥鋪和市場相鄰，是老水上的生活圈。' },
  { from: 'sugar', to: 'market', what: '糖廠冰品', story: '糖廠的冰品是好幾代水上人的共同記憶。' },
  { from: 'coffee', to: 'cafe', what: '咖啡香', story: '從觀光工廠到市區咖啡館，水上有自己的咖啡日常。' },
  { from: 'shangtian', to: 'market', what: '廟埕人潮', story: '媽祖廟的祭典散場，人潮順著街走進夜市。' },
  { from: 'kuzhu', to: 'river', what: '溪畔古剎', story: '苦竹寺就坐落在八掌溪北岸，兩百多年來看著溪水流過。' },
  { from: 'tropic', to: 'space', what: '23.5° 的故事', story: '標誌塔旁的太空教育館，把北回歸線的地理意義講成天文故事。' },
  { from: 'butterfly', to: 'pond', what: '濕地生態', story: '塗溝村的蝴蝶村和九芎埤濕地，一起守護社區的小生命。' },
  { from: 'heritage', to: 'mansion', what: '十一指厝', story: '林家三合院和將軍府都在十一指厝，老聚落的紅磚味道一脈相承。' },
  { from: 'tunnel', to: 'farm', what: '單車路線', story: '騎過芒果樹的綠色隧道，一路往東到三界埔的農場。' },
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
  ren: { name: '巷口美食家', text: '你相信一個地方的味道，藏在店家老闆的手藝裡。這趟就從市區的在地小吃開始，吃到夜市。', picks: ['hall', 'duck', 'cafe', 'bakery', 'market'] },
  wen: { name: '老街記憶收集者', text: '你喜歡聽建築和廟宇說故事。帶上好奇心，從媽祖廟、溪畔古剎一路走到老三合院和禪寺。', picks: ['shangtian', 'kuzhu', 'heritage', 'miaolian'] },
  di: { name: '23.5° 地理探險家', text: '你對座標、地形和自然特別有感。追著北回歸線，再穿過綠色隧道，去濕地和蝴蝶村看看。', picks: ['tropic', 'space', 'tunnel', 'pond', 'butterfly'] },
  chan: { name: '產地好奇寶寶', text: '你想知道東西是怎麼來的。從仙草、木瓜、蕃茄的產地到觀光工廠，把水上的產業串成一條線。', picks: ['xiancao', 'papaya', 'tomato', 'sugar', 'coffee'] },
  jing: { name: '慢活風景控', text: '你的旅行沒有行程表，只有好光線。看看太空館、老三合院，再沿著八掌溪和綠色隧道慢慢晃。', picks: ['space', 'heritage', 'river', 'tunnel'] },
};

// ── 地圖上的其他建築（不在景點清單裡，只是擺著）：經緯度來自 OpenStreetMap ──
export const DECOR: { id: string; model: Model; ll: [number, number]; rot?: number }[] = [
  { id: 'airport', model: 'airport', ll: [23.45922, 120.39252], rot: -0.65 },
  { id: 'station', model: 'station', ll: [23.43397, 120.39944], rot: -0.87 },
  { id: 'nanjing-st', model: 'station', ll: [23.41321, 120.38641], rot: -1.4 },
];
