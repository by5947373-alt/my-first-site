import { create } from 'zustand';
import type { Cat, Poi } from './data';

// ── 存在瀏覽器裡的東西（無痕模式等存不了也沒關係） ──
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 存不了就算了 */ } };
const K_TRIP = 'shuishang-island-trip', K_SEEN = 'shuishang-island-visited', K_INTRO = 'shuishang-island-intro';

export type Tab = 'spots' | 'links' | 'trip';
/** 一天中的時間 0→1：0.22 清晨、0.5 白天、0.78 黃昏、0.95 夜晚 */
export const PRESETS = [
  { id: 'dawn', label: '清晨', t: 0.22 },
  { id: 'day', label: '白天', t: 0.5 },
  { id: 'dusk', label: '黃昏', t: 0.78 },
  { id: 'night', label: '夜晚', t: 0.95 },
] as const;

interface State {
  pois: Poi[];
  selected: string | null;
  hovered: string | null;
  filter: Cat | 'all';
  query: string;
  trip: string[];
  showRoute: boolean;
  touring: boolean;
  /** 每次 +1，鏡頭就回到全景 */
  homeTick: number;
  /** 被點擊的次數（觸發建築專屬動畫） */
  pulse: Record<string, number>;
  reduced: boolean;
  closeUp: boolean;
  /** 和其他標籤重疊、暫時藏起來的標籤 */
  hidden: string[];

  // 時間與工具列
  time: number;
  /** true = 停在選定的時段；false = 一天自己流動 */
  timeLock: boolean;
  paused: boolean;
  showLabels: boolean;
  showCarriers: boolean;
  showLinks: boolean;
  aerial: boolean;

  // 面板
  sidebar: boolean;
  tab: Tab;
  journal: boolean;
  quiz: boolean;
  /** 新手導覽目前第幾步（null = 不顯示） */
  intro: number | null;
  toast: { text: string; n: number } | null;
  /** 探索日誌：第一次點開每個景點的時間 */
  visited: Record<string, number>;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setFilter: (c: Cat | 'all') => void;
  toggleTrip: (id: string) => void;
  moveTrip: (id: string, d: -1 | 1) => void;
  setTrip: (ids: string[]) => void;
  clearTrip: () => void;
  say: (text: string) => void;
  closeIntro: () => void;
  set: (p: Partial<State>) => void;
}

const wide = () => typeof window !== 'undefined' && window.innerWidth >= 900;

export const useStore = create<State>((set, get) => ({
  pois: [],
  selected: null,
  hovered: null,
  filter: 'all',
  query: '',
  trip: load<string[]>(K_TRIP, []).filter((x) => typeof x === 'string'),
  showRoute: false,
  touring: false,
  homeTick: 0,
  pulse: {},
  reduced: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  closeUp: false,
  hidden: [],

  time: 0.42,
  timeLock: false,
  paused: false,
  showLabels: true,
  showCarriers: true,
  showLinks: false,
  aerial: false,

  sidebar: wide(),
  tab: 'spots',
  journal: false,
  quiz: false,
  intro: load<boolean>(K_INTRO, false) ? null : 0,
  toast: null,
  visited: load<Record<string, number>>(K_SEEN, {}),

  select: (id) => set((s) => {
    const visited = id && !s.visited[id] ? { ...s.visited, [id]: Date.now() } : s.visited;
    if (visited !== s.visited) save(K_SEEN, visited);
    return {
      selected: id,
      pulse: id ? { ...s.pulse, [id]: (s.pulse[id] || 0) + 1 } : s.pulse,
      visited,
      // 選了景點就打開右側面板顯示介紹
      sidebar: id ? true : s.sidebar,
    };
  }),
  hover: (id) => { if (get().hovered !== id) set({ hovered: id }); },
  setFilter: (filter) => set({ filter }),
  toggleTrip: (id) => set((s) => {
    const trip = s.trip.includes(id) ? s.trip.filter((x) => x !== id) : [...s.trip, id];
    save(K_TRIP, trip);
    return { trip, showRoute: trip.length > 1 ? s.showRoute : false };
  }),
  moveTrip: (id, d) => set((s) => {
    const t = [...s.trip], i = t.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= t.length) return {};
    [t[i], t[j]] = [t[j], t[i]];
    save(K_TRIP, t);
    return { trip: t };
  }),
  setTrip: (ids) => { save(K_TRIP, ids); set({ trip: ids, showRoute: ids.length > 1 }); },
  clearTrip: () => { save(K_TRIP, []); set({ trip: [], showRoute: false, touring: false }); },
  say: (text) => set((s) => ({ toast: { text, n: (s.toast?.n || 0) + 1 } })),
  closeIntro: () => { save(K_INTRO, true); set({ intro: null }); },
  set: (p) => set(p),
}));

export const poiById = (id: string | null) => (id ? useStore.getState().pois.find((p) => p.id === id) : undefined);

/** 環境動畫是否停住（使用者按了暫停，或系統設定減少動態） */
export const frozen = () => { const s = useStore.getState(); return s.reduced || s.paused; };
