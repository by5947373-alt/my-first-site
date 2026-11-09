import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Scene } from './scene/Scene';
import { CAT, CATS, type Cat } from './data';
import { useStore, poiById } from './store';

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// 瀏覽器全螢幕（iPhone Safari 不支援，按鈕就不顯示）
const canFull = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

export function App() {
  const [full, setFull] = useState(false);
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  const [mobile, setMobile] = useState(() => window.innerWidth < 720);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    const on = () => setMobile(window.innerWidth < 720);
    const fs = () => setFull(!!document.fullscreenElement);
    addEventListener('resize', on);
    document.addEventListener('fullscreenchange', fs);
    return () => { removeEventListener('resize', on); document.removeEventListener('fullscreenchange', fs); };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') useStore.getState().select(null); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className={'isl' + (selected ? ' has-card' : '')}>
      <Canvas
        className="isl-canvas"
        orthographic
        shadows
        flat
        dpr={dpr}
        camera={{ position: [0, 40, 40], zoom: 20, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
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

      <div className="isl-top">
        <div className="isl-title">
          <b>23.5° 水上島</b>
          <span>嘉義水上鄉・人文地產景 3D 探索地圖</span>
        </div>
        <div className="isl-tools">
          <button type="button" className="isl-btn isl-compass" title="指北針（點一下回到全景）" aria-label="指北針" onClick={goHome}>
            <i><b>N</b></i>
          </button>
          <button type="button" className="isl-btn" onClick={goHome} title="回到全景">
            <Icon d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />
            <span>全景</span>
          </button>
          <TripButton />
          {canFull && (
            <button type="button" className="isl-btn" onClick={toggleFull} aria-pressed={full} title={full ? '離開全螢幕' : '全螢幕'}>
              <Icon d={full ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
              <span>{full ? '離開' : '全螢幕'}</span>
            </button>
          )}
        </div>
      </div>

      <Filters />
      <InfoCard />
      <TripPanel />

      <p className="isl-hint" aria-hidden="true">
        {coarse ? '單指旋轉・雙指縮放・點建築看介紹' : '拖曳旋轉・右鍵平移・滾輪縮放・點擊建築'}
      </p>
      <p className="isl-credit">
        地圖資料 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> 貢獻者（ODbL）・道路為示意路線
      </p>
    </div>
  );
}

function goHome() {
  const s = useStore.getState();
  s.select(null);
  s.set({ homeTick: s.homeTick + 1, touring: false });
}

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

function Filters() {
  const pois = useStore((s) => s.pois);
  const filter = useStore((s) => s.filter);
  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c.id, pois.filter((p) => p.cat === c.id).length])), [pois]);
  const pick = (c: Cat | 'all') => useStore.getState().setFilter(filter === c ? 'all' : c);
  return (
    <div className="isl-cats" role="group" aria-label="人文地產景分類">
      <button type="button" className="isl-chip" aria-pressed={filter === 'all'} onClick={() => pick('all')}>全部 <small>{pois.length}</small></button>
      {CATS.map((c) => (
        <button key={c.id} type="button" className="isl-chip" style={{ '--acc': c.color } as React.CSSProperties}
          aria-pressed={filter === c.id} onClick={() => pick(c.id)} disabled={!counts[c.id]}>
          <i>{c.label}</i><span className="isl-chip-en">{c.en}</span> <small>{counts[c.id]}</small>
        </button>
      ))}
    </div>
  );
}

function TripButton() {
  const n = useStore((s) => s.trip.length);
  const open = useStore((s) => s.tripOpen);
  return (
    <button type="button" className="isl-btn" aria-pressed={open} onClick={() => useStore.getState().set({ tripOpen: !open })} title="我的小旅行">
      <Icon d="M5 19c3-1 3-6 7-7s5-5 7-7M5 19a2 2 0 1 0 0-.01M19 5a2 2 0 1 0 0-.01" />
      <span>小旅行</span>{n > 0 && <b className="isl-badge">{n}</b>}
    </button>
  );
}

function InfoCard() {
  const id = useStore((s) => s.selected);
  const inTrip = useStore((s) => (id ? s.trip.includes(id) : false));
  const touring = useStore((s) => s.touring);
  const p = poiById(id);
  if (!p) return null;
  const c = CAT[p.cat];
  const q = encodeURIComponent(p.addr ? p.addr.replace(/ /g, '') : '嘉義縣水上鄉 ' + p.name);
  const rows: [string, string | null | undefined][] = [['地址', p.addr], ['電話', p.tel], ['營業', p.hours], ['Email', p.email]];
  return (
    <aside className="isl-card" style={{ '--acc': c.color } as React.CSSProperties} aria-live="polite" key={p.id}>
      <button type="button" className="isl-x" aria-label="關閉" onClick={() => useStore.getState().select(null)}>×</button>
      <p className="isl-card-cat"><i>{c.label}</i>{c.en}</p>
      <h3>{p.name}</h3>
      {p.feature && <p className="isl-card-feat">{p.feature}</p>}
      {p.text && <p className="isl-card-text">{p.text}</p>}
      {rows.some(([, v]) => v) && (
        <dl>{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      )}
      <div className="isl-card-act">
        <button type="button" className={'isl-cta' + (inTrip ? ' is-on' : '')} onClick={() => useStore.getState().toggleTrip(p.id)}>
          {inTrip ? '✓ 已加入小旅行' : '＋ 加入小旅行'}
        </button>
        <a className="isl-link" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">Google 地圖 ↗</a>
      </div>
      {touring && <p className="isl-card-tour">小旅行導覽中… <button type="button" onClick={() => useStore.getState().set({ touring: false })}>停止</button></p>}
    </aside>
  );
}

function TripPanel() {
  const open = useStore((s) => s.tripOpen);
  const trip = useStore((s) => s.trip);
  const pois = useStore((s) => s.pois);
  const show = useStore((s) => s.showRoute);
  const touring = useStore((s) => s.touring);
  const stops = trip.map((id) => pois.find((p) => p.id === id)).filter(Boolean) as typeof pois;

  // 導覽：每站停留幾秒，鏡頭依序飛過去
  useEffect(() => {
    if (!touring || !stops.length) return;
    let i = 0;
    const s = useStore.getState();
    s.set({ showRoute: stops.length > 1 });
    s.select(stops[0].id);
    const timer = setInterval(() => {
      i++;
      if (i >= stops.length) { clearInterval(timer); useStore.getState().set({ touring: false }); return; }
      useStore.getState().select(stops[i].id);
    }, 5200);
    return () => clearInterval(timer);
  }, [touring]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const st = useStore.getState();
  return (
    <section className="isl-trip" aria-label="我的小旅行">
      <header>
        <h3>我的小旅行 <small>{stops.length} 站</small></h3>
        <button type="button" className="isl-x" aria-label="收起" onClick={() => st.set({ tripOpen: false })}>×</button>
      </header>
      {stops.length === 0 ? (
        <p className="isl-trip-empty">點島上的建築，在介紹卡按「加入小旅行」，就能排出自己的路線。</p>
      ) : (
        <ol>
          {stops.map((p, i) => (
            <li key={p.id} style={{ '--acc': CAT[p.cat].color } as React.CSSProperties}>
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
      )}
      {stops.length > 0 && (
        <div className="isl-trip-act">
          <button type="button" className="isl-cta" disabled={stops.length < 2} aria-pressed={show} onClick={() => st.set({ showRoute: !show })}>
            {show ? '隱藏路線' : '顯示路線'}
          </button>
          <button type="button" className="isl-cta is-solid" onClick={() => st.set({ touring: !touring, tripOpen: !mobileNow() })}>
            {touring ? '停止導覽' : '▶ 開始導覽'}
          </button>
          <button type="button" className="isl-link" onClick={() => st.clearTrip()}>清空</button>
        </div>
      )}
    </section>
  );
}

const mobileNow = () => window.innerWidth < 720;
