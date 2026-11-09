import { create } from 'zustand';
import type { Cat, Poi } from './data';

const TRIP_KEY = 'shuishang-island-trip';
const loadTrip = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(TRIP_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }
  catch { return []; }
};
const saveTrip = (t: string[]) => { try { localStorage.setItem(TRIP_KEY, JSON.stringify(t)); } catch { /* 無痕模式等 */ } };

interface State {
  pois: Poi[];
  selected: string | null;
  hovered: string | null;
  filter: Cat | 'all';
  trip: string[];
  showRoute: boolean;
  tripOpen: boolean;
  touring: boolean;
  /** 每次 +1，鏡頭就回到全景 */
  homeTick: number;
  /** 被點擊的次數（觸發建築專屬動畫） */
  pulse: Record<string, number>;
  reduced: boolean;
  closeUp: boolean;
  /** 和其他標籤重疊、暫時藏起來的標籤 */
  hidden: string[];
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setFilter: (c: Cat | 'all') => void;
  toggleTrip: (id: string) => void;
  moveTrip: (id: string, d: -1 | 1) => void;
  clearTrip: () => void;
  set: (p: Partial<State>) => void;
}

export const useStore = create<State>((set, get) => ({
  pois: [],
  selected: null,
  hovered: null,
  filter: 'all',
  trip: loadTrip(),
  showRoute: false,
  tripOpen: false,
  touring: false,
  homeTick: 0,
  pulse: {},
  reduced: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  closeUp: false,
  hidden: [],
  select: (id) => set((s) => ({
    selected: id,
    pulse: id ? { ...s.pulse, [id]: (s.pulse[id] || 0) + 1 } : s.pulse,
  })),
  hover: (id) => { if (get().hovered !== id) set({ hovered: id }); },
  setFilter: (filter) => set({ filter }),
  toggleTrip: (id) => set((s) => {
    const trip = s.trip.includes(id) ? s.trip.filter((x) => x !== id) : [...s.trip, id];
    saveTrip(trip);
    return { trip, showRoute: trip.length > 1 ? s.showRoute : false };
  }),
  moveTrip: (id, d) => set((s) => {
    const t = [...s.trip], i = t.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= t.length) return {};
    [t[i], t[j]] = [t[j], t[i]];
    saveTrip(t);
    return { trip: t };
  }),
  clearTrip: () => { saveTrip([]); set({ trip: [], showRoute: false, touring: false }); },
  set: (p) => set(p),
}));

export const poiById = (id: string | null) => (id ? useStore.getState().pois.find((p) => p.id === id) : undefined);
