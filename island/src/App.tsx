import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Scene } from './scene/Scene';
import { CAT, CATS, LINKS, PERSONAS, QUIZ, type Cat, type Poi } from './data';
import { PRESETS, useStore, poiById, type Tab } from './store';
import { CharacterPanel } from './Character';

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const canFull = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
const pad = (n: number) => String(n).padStart(2, '0');
const accent = (c: string) => ({ '--acc': c } as CSSProperties);

// ── 圖示（線條風格） ──
const I = {
  dawn: 'M3 18h18M6 15a6 6 0 0 1 12 0M12 4v3M5.6 8.6l1.8 1.8M18.4 8.6l-1.8 1.8',
  day: 'M12 8a4 4 0 1 0 .01 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5',
  dusk: 'M3 18h18M6 15a6 6 0 0 1 12 0M12 4v5M9.5 6.5L12 9l2.5-2.5',
  night: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  tag: 'M4 7h16v10H4zM8 12h8',
  carry: 'M9 3h6v3H9zM12 8.5a1.6 1.6 0 1 0 .01 0M8 21l2-8h4l2 8M7 12l3-1M17 12l-3-1',
  link: 'M5 19c3-1 3-6 7-7s5-5 7-7M5 19a2 2 0 1 0 0-.01M19 5a2 2 0 1 0 0-.01',
  pause: 'M9 5v14M15 5v14',
  play: 'M8 5l11 7-11 7z',
  aerial: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  log: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  home: 'M7 17L17 7M9 7h8v8',
  role: 'M12 3a9 9 0 1 0 .01 0M9 10h.01M15 10h.01M8.5 14.5c2 2 5 2 7 0',
  list: 'M5 7h14M5 12h14M5 17h14',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  unfull: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
};
function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

const nearestPreset = (t: number) => {
  let best: string = PRESETS[0].id, bd = 9;
  for (const p of PRESETS) { const d = Math.min(Math.abs(t - p.t), 1 - Math.abs(t - p.t)); if (d < bd) { bd = d; best = p.id; } }
  return best;
};

export function App() {
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  const [mobile, setMobile] = useState(() => window.innerWidth < 900);
  const sidebar = useStore((s) => s.sidebar);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    const on = () => setMobile(window.innerWidth < 900);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useStore.getState();
      if (s.intro !== null) s.closeIntro();
      else if (s.quiz || s.journal) s.set({ quiz: false, journal: false });
      else if (s.selected) s.select(null);
      else if (mobile && s.sidebar) s.set({ sidebar: false });
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [mobile]);

  return (
    <div className={'isl' + (sidebar ? ' has-side' : '') + (selected ? ' has-sel' : '')}>
      <div className="isl-stage">
        <Canvas
          className="isl-canvas"
          orthographic
          shadows
          flat
          dpr={dpr}
          camera={{ position: [0, 40, 40], zoom: 20, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          onPointerMissed={(e) => {
            // 只有點在 3D 畫面的空白處才取消選取；點標籤、按鈕不算
            const ev = e as MouseEvent;
            if (ev.button === 0 && (ev.target as HTMLElement)?.tagName === 'CANVAS') useStore.getState().select(null);
          }}
          aria-label="水上鄉 3D 微縮島嶼地圖"
        >
          <PerformanceMonitor onDecline={() => setDpr(1)} />
          <Scene interactive zoomable mobile={mobile} />
        </Canvas>

        <TopBar mobile={mobile} />
        <Toast />
        <p className="isl-hint" aria-hidden="true">
          {coarse ? '單指旋轉・雙指縮放・點建築或小人' : '拖曳旋轉・右鍵平移・滾輪縮放・點建築或路上的小人'}
        </p>
        <p className="isl-credit">
          地圖資料 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> 貢獻者（ODbL）・道路與連結為示意
        </p>
      </div>

      <Sidebar mobile={mobile} />
      <Intro mobile={mobile} />
      <Quiz />
      <Journal />
    </div>
  );
}

// ─────────────────────────── 頂部 ───────────────────────────
function Tool({ d, label, on, onClick, title, cls }: { d: string; label: string; on?: boolean; onClick: () => void; title?: string; cls?: string }) {
  return (
    <button type="button" className={'isl-tool' + (on ? ' is-on' : '') + (cls ? ' ' + cls : '')} aria-pressed={on} onClick={onClick} title={title || label}>
      <Icon d={d} /><span>{label}</span>
    </button>
  );
}

function goHome() {
  const s = useStore.getState();
  s.select(null);
  s.set({ homeTick: s.homeTick + 1, touring: false });
}

function TimeBar({ mobile }: { mobile: boolean }) {
  const now = useStore((s) => nearestPreset(s.time));
  const lock = useStore((s) => s.timeLock);
  const [open, setOpen] = useState(false);
  const pick = (id: string, t: number) => {
    const s = useStore.getState();
    // 再按一次目前鎖定的時段 → 恢復自動流動
    if (lock && now === id) s.set({ timeLock: false });
    else s.set({ time: t, timeLock: true });
    setOpen(false);
  };
  const icons: Record<string, string> = { dawn: I.dawn, day: I.day, dusk: I.dusk, night: I.night };
  const buttons = PRESETS.map((p) => (
    <button key={p.id} type="button" className={'isl-time-btn' + (now === p.id ? ' is-on' : '')} onClick={() => pick(p.id, p.t)}
      title={lock && now === p.id ? `${p.label}（再按一次恢復自動流動）` : p.label} aria-pressed={lock && now === p.id}>
      <Icon d={icons[p.id]} />{mobile && <span>{p.label}</span>}
    </button>
  ));
  if (!mobile) return <div className="isl-group isl-time" role="group" aria-label="時間">{buttons}{!lock && <i className="isl-auto">自動</i>}</div>;
  return (
    <div className="isl-time-m">
      <Tool d={icons[now]} label="時間" on={open} onClick={() => setOpen(!open)} />
      {open && <div className="isl-pop" role="group" aria-label="時間">{buttons}<p>{lock ? '再按一次目前時段，恢復自動流動' : '時間正在自動流動'}</p></div>}
    </div>
  );
}

function TopBar({ mobile }: { mobile: boolean }) {
  // 只訂閱需要的欄位：time 每一格都在變，整個 store 訂下去會每格重畫
  const showLabels = useStore((x) => x.showLabels), showCarriers = useStore((x) => x.showCarriers);
  const showLinks = useStore((x) => x.showLinks), paused = useStore((x) => x.paused), aerial = useStore((x) => x.aerial);
  const journal = useStore((x) => x.journal), quiz = useStore((x) => x.quiz), sidebar = useStore((x) => x.sidebar);
  const charOpen = useStore((x) => x.sidebar && x.panel === 'character');
  const s = { ...useStore.getState(), showLabels, showCarriers, showLinks, paused, aerial, journal, quiz, sidebar };
  const [full, setFull] = useState(false);
  useEffect(() => {
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fs);
    return () => document.removeEventListener('fullscreenchange', fs);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const tools = (
    <>
      <Tool d={I.tag} label="名牌" on={s.showLabels} onClick={() => s.set({ showLabels: !s.showLabels })} title="顯示／隱藏景點名牌" />
      <Tool d={I.carry} label="搬運" on={s.showCarriers} onClick={() => s.set({ showCarriers: !s.showCarriers })} title="顯示／隱藏在景點之間搬東西的小人" />
      <Tool d={I.link} label="連結線" on={s.showLinks} onClick={() => s.set({ showLinks: !s.showLinks })} title="顯示所有景點之間的在地連結" />
      <Tool d={s.paused ? I.play : I.pause} label={s.paused ? '播放' : '暫停'} on={s.paused} onClick={() => s.set({ paused: !s.paused })} title="暫停／繼續所有動態" />
      <Tool d={I.aerial} label="鳥瞰" on={s.aerial} onClick={() => s.set({ aerial: !s.aerial })} title="從正上方俯瞰" />
      <Tool d={I.log} label="日誌" on={s.journal} onClick={() => s.set({ journal: !s.journal, quiz: false })} title="探索日誌" />
    </>
  );
  const right = (
    <>
      <Tool d={I.home} label="全景" onClick={goHome} cls="is-pill" />
      <Tool d={I.role} label="角色" on={charOpen} cls="is-pill" title="我的角色：外觀、行程、拍照"
        onClick={() => {
          const g = useStore.getState();
          if (charOpen) g.set({ panel: 'index', walking: false });
          else { g.select(null); g.set({ sidebar: true, panel: 'character', meTick: g.meTick + 1 }); }
        }} />
      <Tool d={I.list} label="清單" on={s.sidebar && !charOpen} onClick={() => s.set(charOpen ? { panel: 'index' } : { sidebar: !s.sidebar })} cls="is-pill" />
      <button type="button" className="isl-tool is-pill is-q" onClick={() => s.set({ intro: 0 })} title="使用說明" aria-label="使用說明">?</button>
    </>
  );
  const brand = (
    <a className="isl-brand" href="./" aria-label="23.5° 水上島 首頁" onClick={(e) => { e.preventDefault(); goHome(); }}>
      <b>23.5°</b>
      <span><strong>剛剛好的城市</strong><small>SHUISHANG <em>水上島</em></small></span>
    </a>
  );
  if (mobile) {
    return (
      <div className="isl-top is-m">
        <div className="isl-row">{brand}<div className="isl-right">{right}</div></div>
        <div className="isl-scroll"><TimeBar mobile />{tools}{canFull && <Tool d={full ? I.unfull : I.full} label="全螢幕" on={full} onClick={toggleFull} />}</div>
      </div>
    );
  }
  return (
    <div className="isl-top">
      {brand}
      <TimeBar mobile={false} />
      <div className="isl-group isl-tools">{tools}{canFull && <Tool d={full ? I.unfull : I.full} label="全螢幕" on={full} onClick={toggleFull} />}</div>
      <div className="isl-right">{right}</div>
    </div>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !show) return null;
  return (
    <div className="isl-toast" role="status" key={toast.n}>
      <p>{toast.text}</p>
      <button type="button" aria-label="關閉" onClick={() => setShow(false)}>×</button>
    </div>
  );
}

// ─────────────────────────── 右側索引 ───────────────────────────
function Sidebar({ mobile }: { mobile: boolean }) {
  const open = useStore((s) => s.sidebar);
  const pois = useStore((s) => s.pois);
  const tab = useStore((s) => s.tab);
  const trip = useStore((s) => s.trip);
  const query = useStore((s) => s.query);
  const sel = useStore((s) => s.selected);
  const linkCount = useMemo(() => LINKS.filter((l) => pois.some((p) => p.id === l.from) && pois.some((p) => p.id === l.to)).length, [pois]);
  const panel = useStore((s) => s.panel);
  if (!open) return null;
  if (panel === 'character') {
    return <aside className={'isl-side is-char' + (mobile ? ' is-sheet' : '')} aria-label="我的角色"><CharacterPanel mobile={mobile} /></aside>;
  }
  const st = useStore.getState();
  const tabs: [Tab, string, number][] = [['spots', '景點', pois.length], ['links', '連結', linkCount], ['trip', '小旅行', trip.length]];
  return (
    <aside className={'isl-side' + (mobile ? ' is-sheet' : '')} aria-label="水上景點索引">
      {mobile && <button type="button" className="isl-grab" aria-label="收起清單" onClick={() => st.set({ sidebar: false })}><i /></button>}
      {!sel && (
        <header className="isl-side-head">
          <p className="isl-eyebrow">THE SHUISHANG INDEX</p>
          <h2>剛剛好，慢慢走。</h2>
          <p className="isl-meta">{pois.length} 個景點　／　{linkCount} 條在地連結<br />選一個地方，走進它的日常。</p>
          <button type="button" className="isl-quiz-cta" onClick={() => st.set({ quiz: true, journal: false })}>
            <span><b>你是水上的哪一種旅人？</b><small>五個問題，替你排一趟剛剛好的小旅行。</small></span><i>›</i>
          </button>
          <input className="isl-search" type="search" placeholder="搜尋景點、店家、關鍵字…" value={query}
            onChange={(e) => st.set({ query: e.target.value, tab: 'spots' })} aria-label="搜尋景點" />
          <div className="isl-tabs" role="tablist">
            {tabs.map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => st.set({ tab: id })}>
                {label}{id !== 'spots' && <small>{n}</small>}
              </button>
            ))}
          </div>
        </header>
      )}
      <div className="isl-side-body">
        {sel ? <Detail /> : tab === 'spots' ? <SpotList /> : tab === 'links' ? <LinkList /> : <TripList />}
      </div>
      {mobile && !sel && <button type="button" className="isl-side-x" aria-label="關閉清單" onClick={() => st.set({ sidebar: false })}>×</button>}
    </aside>
  );
}

function SpotList() {
  const pois = useStore((s) => s.pois);
  const filter = useStore((s) => s.filter);
  const query = useStore((s) => s.query.trim());
  const visited = useStore((s) => s.visited);
  const st = useStore.getState();
  const rows = pois.map((p, i) => ({ p, n: i + 1 })).filter(({ p }) =>
    (filter === 'all' || p.cat === filter) &&
    (!query || [p.name, p.feature, p.text, p.addr, CAT[p.cat].label].some((x) => x && x.includes(query))));
  return (
    <>
      <div className="isl-cats" role="group" aria-label="人文地產景分類">
        <button type="button" className="isl-chip" aria-pressed={filter === 'all'} onClick={() => st.setFilter('all')}>全部</button>
        {CATS.map((c) => (
          <button key={c.id} type="button" className="isl-chip" style={accent(c.color)} aria-pressed={filter === c.id}
            onClick={() => st.setFilter(filter === c.id ? 'all' : c.id)} title={c.en}>
            <i>{c.label}</i>{pois.filter((p) => p.cat === c.id).length}
          </button>
        ))}
      </div>
      {rows.length === 0 ? <p className="isl-empty">找不到「{query}」相關的景點。</p> : (
        <ol className="isl-index">
          {rows.map(({ p, n }) => (
            <li key={p.id} style={accent(CAT[p.cat].color)}>
              <button type="button" onClick={() => { st.set({ touring: false }); st.select(p.id); }}
                onPointerEnter={() => st.hover(p.id)} onPointerLeave={() => st.hover(null)}>
                <em>{pad(n)}</em>
                <span><b>{p.name}</b><small><i>{CAT[p.cat].label}</i>{p.feature}</small></span>
                <span className="isl-index-r">{visited[p.id] ? <i className="isl-seen" title="已探索">✓</i> : null}↗</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function LinkList() {
  const pois = useStore((s) => s.pois);
  const st = useStore.getState();
  const name = (id: string) => pois.find((p) => p.id === id);
  return (
    <>
      <p className="isl-note">景點之間不是孤立的：產地、店家、車站和風景彼此串連。打開上方「連結線」可以一次看全部；路上扛著貨物的小人，就是正在搬運的連結。</p>
      <ol className="isl-links">
        {LINKS.map((l, i) => {
          const a = name(l.from), b = name(l.to);
          if (!a || !b) return null;
          return (
            <li key={i} style={accent(CAT[a.cat].color)}>
              <button type="button" onClick={() => { st.set({ showLinks: true }); st.select(a.id); }}>
                <em>{pad(i + 1)}</em>
                <span><b>{a.name} <i>→</i> {b.name}</b><small><strong>{l.what}</strong>　{l.story}</small></span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function TripList() {
  const trip = useStore((s) => s.trip);
  const pois = useStore((s) => s.pois);
  const show = useStore((s) => s.showRoute);
  const touring = useStore((s) => s.touring);
  const stops = trip.map((id) => pois.find((p) => p.id === id)).filter(Boolean) as Poi[];
  const st = useStore.getState();
  return (
    <div className="isl-trip">
      {stops.length === 0 ? (
        <p className="isl-empty">點島上的建築，在介紹裡按「加入小旅行」，就能排出自己的路線。<br />不知道去哪？試試上面的「你是水上的哪一種旅人？」</p>
      ) : (
        <>
          <ol>
            {stops.map((p, i) => (
              <li key={p.id} style={accent(CAT[p.cat].color)}>
                <button type="button" className="isl-trip-go" onClick={() => { st.set({ touring: false }); st.select(p.id); }}>
                  <b>{i + 1}</b><span>{p.name}</span>
                </button>
                <span className="isl-trip-ops">
                  <button type="button" aria-label="往前" disabled={i === 0} onClick={() => st.moveTrip(p.id, -1)}>↑</button>
                  <button type="button" aria-label="往後" disabled={i === stops.length - 1} onClick={() => st.moveTrip(p.id, 1)}>↓</button>
                  <button type="button" aria-label="移除" onClick={() => st.toggleTrip(p.id)}>×</button>
                </span>
              </li>
            ))}
          </ol>
          <div className="isl-actions">
            <button type="button" className="isl-btn2" disabled={stops.length < 2} aria-pressed={show} onClick={() => st.set({ showRoute: !show })}>
              {show ? '隱藏路線' : '顯示路線'}
            </button>
            <button type="button" className="isl-btn2 is-dark" onClick={() => st.set({ touring: !touring })}>{touring ? '停止導覽' : '開始導覽 →'}</button>
            <button type="button" className="isl-link" onClick={() => st.clearTrip()}>清空</button>
          </div>
        </>
      )}
    </div>
  );
}

function Detail() {
  const id = useStore((s) => s.selected);
  const inTrip = useStore((s) => (id ? s.trip.includes(id) : false));
  const touring = useStore((s) => s.touring);
  const pois = useStore((s) => s.pois);
  const p = poiById(id);
  if (!p) return null;
  const st = useStore.getState();
  const c = CAT[p.cat];
  const n = pois.findIndex((x) => x.id === p.id) + 1;
  const q = encodeURIComponent(p.addr ? p.addr.replace(/ /g, '') : '嘉義縣水上鄉 ' + p.name);
  const rows: [string, string | null | undefined][] = [['地址', p.addr], ['電話', p.tel], ['營業', p.hours], ['Email', p.email]];
  const rel = LINKS.filter((l) => l.from === p.id || l.to === p.id);
  return (
    <article className="isl-detail" style={accent(c.color)} key={p.id}>
      <button type="button" className="isl-back" onClick={() => st.select(null)}>← 返回清單</button>
      <p className="isl-detail-cat"><em>{pad(n)}</em><i>{c.label}</i>{c.en}</p>
      <h3>{p.name}</h3>
      {p.feature && <p className="isl-detail-feat">{p.feature}</p>}
      {p.text && <p className="isl-detail-text">{p.text}</p>}
      {rows.some(([, v]) => v) && <dl>{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      <div className="isl-actions">
        <button type="button" className={'isl-btn2' + (inTrip ? ' is-on' : '')} onClick={() => st.toggleTrip(p.id)}>
          {inTrip ? '✓ 已加入小旅行' : '＋ 加入小旅行'}
        </button>
        <a className="isl-link" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">Google 地圖 ↗</a>
      </div>
      {rel.length > 0 && (
        <section className="isl-rel">
          <h4>在地連結 <small>{rel.length}</small></h4>
          <ul>
            {rel.map((l, i) => {
              const other = poiById(l.from === p.id ? l.to : l.from);
              if (!other) return null;
              return (
                <li key={i}>
                  <button type="button" onClick={() => st.select(other.id)} style={accent(CAT[other.cat].color)}>
                    <b>{l.from === p.id ? '送往' : '來自'} {other.name}</b><small><strong>{l.what}</strong>　{l.story}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {touring && <p className="isl-tour">小旅行導覽中… <button type="button" onClick={() => st.set({ touring: false })}>停止</button></p>}
    </article>
  );
}

// 小旅行導覽：每站停留幾秒，鏡頭依序飛過去
function useTour() {
  const touring = useStore((s) => s.touring);
  useEffect(() => {
    const st = useStore.getState();
    const stops = st.trip.filter((id) => poiById(id));
    if (!touring || !stops.length) { if (touring) st.set({ touring: false }); return; }
    let i = 0;
    st.set({ showRoute: stops.length > 1 });
    st.select(stops[0]);
    const timer = setInterval(() => {
      i++;
      if (i >= stops.length) { clearInterval(timer); useStore.getState().set({ touring: false }); return; }
      useStore.getState().select(stops[i]);
    }, 5200);
    return () => clearInterval(timer);
  }, [touring]);
}

// ─────────────────────────── 對話框 ───────────────────────────
function Modal({ children, onClose, label, wide }: { children: ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  return (
    <div className="isl-modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'isl-modal-card' + (wide ? ' is-wide' : '')}>{children}</div>
    </div>
  );
}

function Intro({ mobile }: { mobile: boolean }) {
  useTour();
  const step = useStore((s) => s.intro);
  if (step === null) return null;
  const st = useStore.getState();
  const steps = [
    { h: '這座島就是水上鄉', p: `照著水上鄉真實的行政區輪廓，做成一座 3D 微縮島。點一棟建築，或用${mobile ? '「清單」' : '右側清單'}探索 ${st.pois.length} 個景點。` },
    { h: '小人在幫景點串起關係', p: '選一個景點就會亮出它的在地連結。點路上扛著貨物的小人，可以看到他正把什麼，從哪裡搬到哪裡。' },
    { h: '水上的一天會自己流動', p: `上方可以切換清晨、白天、黃昏、夜晚的光線，也可以按暫停${mobile ? '；手機版請點「時間」' : ''}。` },
    { h: '做一個自己的角色', p: '按「角色」可以換髮型、衣服和配件，站到海上的小島，讓角色沿著小旅行走一趟，再和吉祥物仙草仔拍張照。' },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <Modal onClose={() => st.closeIntro()} label="使用說明">
      <p className="isl-eyebrow">HELLO, SHUISHANG / {pad(step + 1)}</p>
      <h2>{s.h}</h2>
      <p className="isl-modal-text">{s.p}</p>
      <div className="isl-modal-act">
        <button type="button" className="isl-btn2" onClick={() => st.closeIntro()}>略過</button>
        <button type="button" className="isl-btn2 is-dark is-ring" autoFocus onClick={() => (last ? st.closeIntro() : st.set({ intro: step + 1 }))}>
          {last ? '走進水上 →' : '下一步 →'}
        </button>
      </div>
    </Modal>
  );
}

function Quiz() {
  const open = useStore((s) => s.quiz);
  const [ans, setAns] = useState<Cat[]>([]);
  useEffect(() => { if (open) setAns([]); }, [open]);
  if (!open) return null;
  const st = useStore.getState();
  const close = () => st.set({ quiz: false });
  if (ans.length < QUIZ.length) {
    const q = QUIZ[ans.length];
    return (
      <Modal onClose={close} label="你是水上的哪一種旅人？">
        <p className="isl-eyebrow">WHO ARE YOU IN SHUISHANG / {pad(ans.length + 1)}</p>
        <h2>{q.q}</h2>
        <div className="isl-progress"><i style={{ width: `${(ans.length / QUIZ.length) * 100}%` }} /></div>
        <div className="isl-options">
          {q.a.map((a) => <button key={a.t} type="button" onClick={() => setAns([...ans, a.c])}>{a.t}</button>)}
        </div>
        <div className="isl-modal-act">
          <button type="button" className="isl-btn2" onClick={ans.length ? () => setAns(ans.slice(0, -1)) : close}>{ans.length ? '← 上一題' : '取消'}</button>
          <span className="isl-modal-count">{ans.length + 1} / {QUIZ.length}</span>
        </div>
      </Modal>
    );
  }
  const score = CATS.map((c) => ({ c: c.id, n: ans.filter((x) => x === c.id).length })).sort((a, b) => b.n - a.n);
  const top = score[0].c;
  const per = PERSONAS[top];
  const picks = per.picks.filter((id) => poiById(id));
  return (
    <Modal onClose={close} label="測驗結果">
      <p className="isl-eyebrow">YOU ARE / {CAT[top].en}</p>
      <h2>你是「{per.name}」</h2>
      <p className="isl-modal-text">{per.text}</p>
      <ol className="isl-picks">{picks.map((id, i) => <li key={id} style={accent(CAT[poiById(id)!.cat].color)}><b>{i + 1}</b>{poiById(id)!.name}</li>)}</ol>
      <div className="isl-modal-act">
        <button type="button" className="isl-btn2" onClick={() => setAns([])}>再測一次</button>
        <button type="button" className="isl-btn2 is-dark is-ring" onClick={() => {
          st.setTrip(picks);
          st.select(null);
          st.set({ quiz: false, tab: 'trip', sidebar: true, homeTick: st.homeTick + 1 });
          st.say(`已為「${per.name}」排好 ${picks.length} 站的小旅行，按「開始導覽」出發吧。`);
        }}>排進小旅行 →</button>
      </div>
    </Modal>
  );
}

function Journal() {
  const open = useStore((s) => s.journal);
  const visited = useStore((s) => s.visited);
  const pois = useStore((s) => s.pois);
  if (!open) return null;
  const st = useStore.getState();
  const seen = pois.filter((p) => visited[p.id]).sort((a, b) => visited[a.id] - visited[b.id]);
  const left = pois.filter((p) => !visited[p.id]);
  const time = (ms: number) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const go = (id: string) => { st.set({ journal: false }); st.select(id); };
  return (
    <Modal onClose={() => st.set({ journal: false })} label="探索日誌" wide>
      <p className="isl-eyebrow">FIELD NOTES</p>
      <h2>探索日誌</h2>
      <p className="isl-modal-text">已探索 <b>{seen.length}</b> / {pois.length} 個景點{seen.length === pois.length ? '——整座島都走過了！' : '。'}</p>
      <div className="isl-progress"><i style={{ width: `${(seen.length / Math.max(1, pois.length)) * 100}%` }} /></div>
      <div className="isl-badges">
        {CATS.map((c) => {
          const all = pois.filter((p) => p.cat === c.id), got = all.filter((p) => visited[p.id]).length;
          return <span key={c.id} className={got && got === all.length ? 'is-done' : ''} style={accent(c.color)}><i>{c.label}</i>{got}/{all.length}</span>;
        })}
      </div>
      {seen.length > 0 && (
        <ol className="isl-log">
          {seen.map((p) => <li key={p.id} style={accent(CAT[p.cat].color)}><button type="button" onClick={() => go(p.id)}><time>{time(visited[p.id])}</time><i>{CAT[p.cat].label}</i>{p.name}</button></li>)}
        </ol>
      )}
      {left.length > 0 && (
        <>
          <h4 className="isl-sub">還沒去過</h4>
          <div className="isl-left">{left.map((p) => <button key={p.id} type="button" style={accent(CAT[p.cat].color)} onClick={() => go(p.id)}>{p.name}</button>)}</div>
        </>
      )}
      <div className="isl-modal-act">
        {seen.length > 0 && <button type="button" className="isl-link" onClick={() => {
          try { localStorage.removeItem('shuishang-island-visited'); } catch { /* 存不了就算了 */ }
          st.set({ visited: {} });
        }}>清除紀錄</button>}
        <button type="button" className="isl-btn2 is-dark" onClick={() => st.set({ journal: false })}>繼續探索</button>
      </div>
    </Modal>
  );
}
