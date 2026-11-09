// 我的角色：外觀選項、身分預設、站立地點，以及附近的小島。
import type { V2 } from './geo';

// ── 海上的小島（裝飾用的想像場景，水上鄉本身不靠海） ──
export interface Islet { id: string; name: string; pos: V2; r: number; kind: 'lighthouse' | 'harbor' | 'beach' | 'flower' | 'star' | 'rock'; text: string }
export const ISLETS: Islet[] = [
  { id: 'lighthouse', name: '燈塔小島', pos: [-24, -7], r: 2.1, kind: 'lighthouse', text: '小小的燈塔守著海面，夜裡會亮起旋轉的光。' },
  { id: 'harbor', name: '漁港小島', pos: [2, 13.6], r: 2.4, kind: 'harbor', text: '木棧道延伸進海裡，漁船在這裡進出。' },
  { id: 'beach', name: '沙灘小島', pos: [-23, 9], r: 2.5, kind: 'beach', text: '白沙、陽傘和椰子樹，最適合發呆的地方。' },
  { id: 'flower', name: '花海小島', pos: [24, -3], r: 2.0, kind: 'flower', text: '一整片花田和慢慢轉的風車。' },
  { id: 'star', name: '觀星小島', pos: [14.5, -13.5], r: 1.8, kind: 'star', text: '離光害最遠的小島，晚上來看星星。' },
  { id: 'rock', name: '海鳥岩', pos: [-11, -15], r: 1.0, kind: 'rock', text: '海鳥休息的小岩礁。' },
];
/** 海平面高度（主島草地在 y=0） */
export const SEA_Y = -1.2;
/** 小島頂面高度 */
export const ISLET_Y = -0.75;

// ── 外觀 ──
export interface Avatar {
  name: string;
  role: string;
  hair: string; hairColor: string; skin: string; eyes: string; mouth: string; face: string;
  top: string; topColor: string; bottom: string; bottomColor: string; shoes: string;
  hat: string; bag: string; hold: string;
  height: string; build: string;
}

export const OPT = {
  hair: ['短髮', '長髮', '鮑伯頭', '側分', '捲髮', '丸子頭', '馬尾', '刺蝟頭', '光頭'],
  hairColor: ['#3B2A22', '#1F1E24', '#6B4630', '#B5532F', '#D8A84E', '#E8E2D6', '#7FA7D9', '#E58FB0'],
  skin: ['#F8DCC4', '#F1C7A3', '#E2AC82', '#C98E66', '#A56E4B', '#7A4E35'],
  eyes: ['點點', '笑眼', '大眼', '瞇眼'],
  mouth: ['無', '微笑', '驚訝', '平靜'],
  face: ['無', '眼鏡', '墨鏡', '口罩'],
  top: ['T恤', '襯衫', '背心', '連帽外套'],
  topColor: ['#3E9FD6', '#F07E6E', '#6FBF8E', '#F6CF57', '#C48BD6', '#FFFFFF', '#3D3A4E', '#F5A65B'],
  bottom: ['長褲', '短褲', '裙子'],
  bottomColor: ['#2F4D8C', '#4A4F5C', '#C9A27A', '#6FBF8E', '#F07E6E', '#E8E2D6'],
  shoes: ['#3D3A4E', '#FFFFFF', '#E5574A', '#C08E5D'],
  hat: ['無', '斗笠', '棒球帽', '草帽', '毛帽', '安全帽'],
  bag: ['無', '背包', '斜背包', '竹籃'],
  hold: ['無', '仙草茶', '相機', '氣球', '地圖'],
  height: ['矮', '中', '高'],
  build: ['瘦', '中', '圓'],
};

export const DEFAULT_AVATAR: Avatar = {
  name: '', role: '旅人',
  hair: '短髮', hairColor: '#1F1E24', skin: '#F1C7A3', eyes: '點點', mouth: '微笑', face: '無',
  top: 'T恤', topColor: '#3E9FD6', bottom: '長褲', bottomColor: '#2F4D8C', shoes: '#3D3A4E',
  hat: '無', bag: '背包', hold: '無', height: '中', build: '中',
};

/** 身分：切換時套用一組預設衣著與配件，之後每一項都能自己改。 */
export const ROLES: Record<string, Partial<Avatar>> = {
  旅人: { top: 'T恤', topColor: '#3E9FD6', bottom: '長褲', bottomColor: '#2F4D8C', hat: '棒球帽', bag: '背包', hold: '地圖' },
  在地青年: { top: '連帽外套', topColor: '#F5A65B', bottom: '短褲', bottomColor: '#4A4F5C', hat: '無', bag: '斜背包', hold: '仙草茶' },
  農友: { top: '襯衫', topColor: '#6FBF8E', bottom: '長褲', bottomColor: '#C9A27A', hat: '斗笠', bag: '竹籃', hold: '無' },
  學生: { top: '襯衫', topColor: '#FFFFFF', bottom: '短褲', bottomColor: '#2F4D8C', hat: '無', bag: '背包', hold: '無' },
  長輩: { top: '襯衫', topColor: '#C48BD6', bottom: '長褲', bottomColor: '#4A4F5C', hat: '草帽', bag: '無', hold: '無', hairColor: '#E8E2D6' },
  店家老闆: { top: '背心', topColor: '#F07E6E', bottom: '長褲', bottomColor: '#3D3A4E', hat: '無', bag: '無', hold: '仙草茶' },
  單車騎士: { top: 'T恤', topColor: '#F6CF57', bottom: '短褲', bottomColor: '#3D3A4E', hat: '安全帽', bag: '斜背包', hold: '無' },
  攝影師: { top: '連帽外套', topColor: '#3D3A4E', bottom: '長褲', bottomColor: '#C9A27A', hat: '毛帽', bag: '斜背包', hold: '相機' },
  上班族: { top: '襯衫', topColor: '#FFFFFF', bottom: '長褲', bottomColor: '#3D3A4E', hat: '無', bag: '斜背包', hold: '無', face: '眼鏡' },
};

export const POSES = ['站好', '揮手', '比 YA', '跳起來', '轉圈'] as const;
export type Pose = (typeof POSES)[number];
export const SHOTS = ['全身特寫', '與島合照', '從上面拍'] as const;
export type Shot = (typeof SHOTS)[number];

export function randomAvatar(base: Avatar): Avatar {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    ...base,
    hair: pick(OPT.hair), hairColor: pick(OPT.hairColor), skin: pick(OPT.skin), eyes: pick(OPT.eyes), mouth: pick(OPT.mouth),
    face: Math.random() < 0.7 ? '無' : pick(OPT.face), top: pick(OPT.top), topColor: pick(OPT.topColor), bottom: pick(OPT.bottom),
    bottomColor: pick(OPT.bottomColor), shoes: pick(OPT.shoes), hat: Math.random() < 0.4 ? '無' : pick(OPT.hat),
    bag: pick(OPT.bag), hold: pick(OPT.hold), height: pick(OPT.height), build: pick(OPT.build),
  };
}
