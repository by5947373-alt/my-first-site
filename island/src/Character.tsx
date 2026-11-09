// 「我的角色」面板：外觀、行程、拍照三個分頁。
import { useState, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';
import { useStore } from './store';
import { CAT } from './data';
import { DEFAULT_AVATAR, OPT, POSES, ROLES, SHOTS, randomAvatar, type Avatar } from './avatar';
import { PLACE_ORDER, PLAYER, placeInfo } from './scene/Avatar';
import { CAM } from './scene/CameraRig';

const accent = (c: string) => ({ '--acc': c } as CSSProperties);

function Chips<K extends keyof Avatar>({ k, list }: { k: K; list: readonly string[] }) {
  const v = useStore((s) => s.avatar[k]);
  const set = useStore.getState().setAvatar;
  return (
    <div className="isl-opt">
      {list.map((x) => (
        <button key={x} type="button" aria-pressed={v === x} onClick={() => set({ [k]: x } as Partial<Avatar>)}>{x}</button>
      ))}
    </div>
  );
}

function Swatches<K extends keyof Avatar>({ k, list }: { k: K; list: readonly string[] }) {
  const v = useStore((s) => s.avatar[k]);
  const set = useStore.getState().setAvatar;
  return (
    <div className="isl-swatch">
      {list.map((c) => (
        <button key={c} type="button" aria-pressed={v === c} aria-label={c} style={{ background: c }} onClick={() => set({ [k]: c } as Partial<Avatar>)} />
      ))}
      <label className="isl-swatch-pick" title="自訂顏色">
        <input type="color" value={String(v)} onChange={(e) => set({ [k]: e.target.value } as Partial<Avatar>)} />
      </label>
    </div>
  );
}

function Section({ title, children, open: initial = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={'isl-acc' + (open ? ' is-open' : '')}>
      <button type="button" className="isl-acc-head" aria-expanded={open} onClick={() => setOpen(!open)}>{title}<i>{open ? '−' : '+'}</i></button>
      {open && <div className="isl-acc-body">{children}</div>}
    </section>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="isl-field"><p>{label}</p>{children}</div>
);

function Look() {
  const a = useStore((s) => s.avatar);
  const facing = useStore((s) => s.facing);
  const place = useStore((s) => s.place);
  const mascot = useStore((s) => s.mascot);
  const st = useStore.getState();
  const here = placeInfo(place);
  const next = () => {
    const i = PLACE_ORDER.indexOf(place);
    st.set({ place: PLACE_ORDER[(i + 1) % PLACE_ORDER.length], meTick: st.meTick + 1 });
  };
  return (
    <>
      <Field label="名字">
        <input className="isl-search" placeholder="替角色取個名字" maxLength={12} value={a.name} onChange={(e) => st.setAvatar({ name: e.target.value })} />
      </Field>
      <Field label="身分">
        <div className="isl-opt">
          {Object.keys(ROLES).map((r) => (
            <button key={r} type="button" aria-pressed={a.role === r} onClick={() => st.setAvatar({ role: r, ...ROLES[r] })}>{r}</button>
          ))}
        </div>
        <p className="isl-hint2">切換身分會套用一組預設衣著與配件，之後每一項都能自己改。</p>
      </Field>
      <Field label="預覽方向">
        <div className="isl-two">
          <button type="button" aria-pressed={facing === 'front'} onClick={() => st.set({ facing: 'front' })}>面向鏡頭</button>
          <button type="button" aria-pressed={facing === 'back'} onClick={() => st.set({ facing: 'back' })}>背面</button>
        </div>
      </Field>
      <Field label="站在哪裡">
        <div className="isl-two">
          <span className="isl-place">{here?.name || '—'}</span>
          <button type="button" onClick={next}>換一個</button>
        </div>
        <p className="isl-hint2">也可以直接點海上的小島，角色就會過去。</p>
      </Field>
      <Field label="合照">
        <button type="button" className={'isl-wide' + (mascot ? ' is-on' : '')} onClick={() => st.set({ mascot: !mascot })}>
          {mascot ? '✓ 仙草仔在旁邊' : '與 仙草仔 合照'}
        </button>
      </Field>

      <Section title="臉與髮" open>
        <Field label="髮型"><Chips k="hair" list={OPT.hair} /></Field>
        <Field label="髮色"><Swatches k="hairColor" list={OPT.hairColor} /></Field>
        <Field label="膚色"><Swatches k="skin" list={OPT.skin} /></Field>
        <Field label="眼睛"><Chips k="eyes" list={OPT.eyes} /></Field>
        <Field label="嘴巴"><Chips k="mouth" list={OPT.mouth} /></Field>
        <Field label="臉部配件"><Chips k="face" list={OPT.face} /></Field>
      </Section>
      <Section title="衣著">
        <Field label="上衣"><Chips k="top" list={OPT.top} /></Field>
        <Field label="上衣顏色"><Swatches k="topColor" list={OPT.topColor} /></Field>
        <Field label="下身"><Chips k="bottom" list={OPT.bottom} /></Field>
        <Field label="下身顏色"><Swatches k="bottomColor" list={OPT.bottomColor} /></Field>
        <Field label="鞋子"><Swatches k="shoes" list={OPT.shoes} /></Field>
      </Section>
      <Section title="配件">
        <Field label="帽子"><Chips k="hat" list={OPT.hat} /></Field>
        <Field label="包包"><Chips k="bag" list={OPT.bag} /></Field>
        <Field label="手上拿"><Chips k="hold" list={OPT.hold} /></Field>
      </Section>
      <Section title="體型">
        <Field label="身高"><Chips k="height" list={OPT.height} /></Field>
        <Field label="身形"><Chips k="build" list={OPT.build} /></Field>
      </Section>
    </>
  );
}

function Trip() {
  const trip = useStore((s) => s.trip);
  const pois = useStore((s) => s.pois);
  const walking = useStore((s) => s.walking);
  const st = useStore.getState();
  const stops = trip.map((id) => pois.find((p) => p.id === id)).filter(Boolean) as typeof pois;
  if (!stops.length) {
    return (
      <div className="isl-empty">
        <p>還沒有行程。在景點介紹裡按「加入小旅行」，或做個小測驗，讓角色帶你走一趟。</p>
        <div className="isl-actions">
          <button type="button" className="isl-btn2 is-dark" onClick={() => st.set({ quiz: true })}>你是哪一種旅人？</button>
          <button type="button" className="isl-btn2" onClick={() => st.set({ panel: 'index', tab: 'spots' })}>去挑景點</button>
        </div>
      </div>
    );
  }
  return (
    <div className="isl-trip">
      <p className="isl-note">角色會從現在的位置出發，依序走到每一站，鏡頭會跟著走。</p>
      <ol>
        {stops.map((p, i) => (
          <li key={p.id} style={accent(CAT[p.cat].color)}>
            <span className="isl-trip-go"><b>{i + 1}</b><span>{p.name}</span></span>
          </li>
        ))}
      </ol>
      <div className="isl-actions">
        <button type="button" className="isl-btn2 is-dark is-ring" onClick={() => st.set({ walking: !walking, showRoute: true, selected: null })}>
          {walking ? '停下來' : '讓角色走一趟 →'}
        </button>
        <button type="button" className="isl-link" onClick={() => st.set({ panel: 'index', tab: 'trip' })}>編輯行程</button>
      </div>
    </div>
  );
}

/** 把 3D 畫面拍下來：以角色為中心裁成正方形，加上拍立得相框與文字。 */
function capture(frame: boolean, caption: string, sub: string) {
  const src = document.querySelector<HTMLCanvasElement>('.isl-canvas canvas');
  if (!src) return null;
  const w = src.width, h = src.height;
  const side = Math.min(w, h, Math.max(w, h) * 0.75);
  let cx = w / 2, cy = h / 2;
  if (CAM.cam) {
    const v = PLAYER.clone().add(new THREE.Vector3(0, 0.6, 0)).project(CAM.cam);
    cx = (v.x * 0.5 + 0.5) * w; cy = (-v.y * 0.5 + 0.5) * h;
  }
  const sx = Math.max(0, Math.min(w - side, cx - side / 2)), sy = Math.max(0, Math.min(h - side, cy - side / 2));
  const out = document.createElement('canvas');
  const S = 1080, pad = frame ? 56 : 0, bottom = frame ? 210 : 0;
  out.width = S + pad * 2; out.height = S + pad + bottom;
  const g = out.getContext('2d')!;
  g.fillStyle = frame ? '#FFFDF8' : '#FBF1D6';
  g.fillRect(0, 0, out.width, out.height);
  // 背景色（3D 畫布是透明的，天空顏色在 CSS 上）
  const sky = getComputedStyle(document.querySelector('.isl-stage')!);
  const grad = g.createLinearGradient(0, pad, 0, pad + S);
  grad.addColorStop(0, sky.getPropertyValue('--sky1').trim() || '#FFF8E6');
  grad.addColorStop(1, sky.getPropertyValue('--sky2').trim() || '#F3E2B8');
  g.fillStyle = grad;
  g.fillRect(pad, pad, S, S);
  g.drawImage(src, sx, sy, side, side, pad, pad, S, S);
  if (frame) {
    g.fillStyle = '#262019';
    g.font = '800 58px "Noto Sans TC", sans-serif';
    g.fillText(caption, pad + 6, pad + S + 100);
    g.fillStyle = '#9A8B78';
    g.font = '600 32px "IBM Plex Mono", monospace';
    g.fillText(sub, pad + 8, pad + S + 160);
    g.fillStyle = '#D9653B';
    g.font = '800 64px "Baloo 2", sans-serif';
    g.textAlign = 'right';
    g.fillText('23.5°', out.width - pad - 6, pad + S + 104);
  }
  return out.toDataURL('image/png');
}

function Photo() {
  const shot = useStore((s) => s.shot);
  const pose = useStore((s) => s.pose);
  const mascot = useStore((s) => s.mascot);
  const a = useStore((s) => s.avatar);
  const place = useStore((s) => s.place);
  const [frame, setFrame] = useState(true);
  const [img, setImg] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const st = useStore.getState();
  const snap = () => {
    const d = new Date();
    const where = placeInfo(place)?.name || '水上島';
    const url = capture(frame, `${a.name || '我'} 在 ${where}`, `SHUISHANG · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
    setFlash((n) => n + 1);
    if (url) setImg(url);
  };
  return (
    <>
      <Field label="構圖">
        <div className="isl-opt">{SHOTS.map((x) => <button key={x} type="button" aria-pressed={shot === x} onClick={() => st.set({ shot: x })}>{x}</button>)}</div>
      </Field>
      <Field label="動作">
        <div className="isl-opt">{POSES.map((x) => <button key={x} type="button" aria-pressed={pose === x} onClick={() => st.set({ pose: x })}>{x}</button>)}</div>
      </Field>
      <Field label="相框">
        <div className="isl-two">
          <button type="button" aria-pressed={frame} onClick={() => setFrame(true)}>拍立得</button>
          <button type="button" aria-pressed={!frame} onClick={() => setFrame(false)}>無框</button>
        </div>
      </Field>
      <Field label="合照">
        <button type="button" className={'isl-wide' + (mascot ? ' is-on' : '')} onClick={() => st.set({ mascot: !mascot })}>
          {mascot ? '✓ 仙草仔在旁邊' : '與 仙草仔 合照'}
        </button>
      </Field>
      <button type="button" className="isl-shutter" onClick={snap}>📷 拍照</button>
      {flash > 0 && <i className="isl-flash" key={flash} />}
      {img && (
        <figure className="isl-photo">
          <img src={img} alt="剛剛拍的照片" />
          <figcaption>
            <a className="isl-btn2 is-dark" href={img} download={`水上島-${Date.now()}.png`}>下載照片</a>
            <button type="button" className="isl-link" onClick={() => setImg(null)}>收起</button>
          </figcaption>
        </figure>
      )}
    </>
  );
}

export function CharacterPanel({ mobile }: { mobile: boolean }) {
  const tab = useStore((s) => s.charTab);
  const st = useStore.getState();
  const close = () => st.set({ panel: 'index', walking: false, homeTick: st.homeTick + 1, sidebar: mobile ? false : st.sidebar });
  return (
    <>
      {mobile && <button type="button" className="isl-grab" aria-label="收起" onClick={close}><i /></button>}
      <header className="isl-side-head">
        <p className="isl-eyebrow">MY CHARACTER</p>
        <h2>角色</h2>
        <button type="button" className="isl-side-x is-show" aria-label="關閉角色面板" onClick={close}>×</button>
        <div className="isl-tabs is-orange" role="tablist">
          {([['look', '外觀'], ['trip', '行程'], ['photo', '拍照']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''}
              onClick={() => st.set({ charTab: id, meTick: st.meTick + 1 })}>{label}</button>
          ))}
        </div>
      </header>
      <div className="isl-side-body">
        {tab === 'look' ? <Look /> : tab === 'trip' ? <Trip /> : <Photo />}
      </div>
      {tab === 'look' && (
        <footer className="isl-side-foot">
          <button type="button" className="isl-btn2" onClick={() => st.setAvatar(randomAvatar(st.avatar))}>🎲 隨機</button>
          <button type="button" className="isl-btn2" onClick={() => st.setAvatar({ ...DEFAULT_AVATAR, name: st.avatar.name })}>重設</button>
          <button type="button" className="isl-btn2 is-accent" onClick={() => { st.say(`${st.avatar.name || '你的角色'}準備好了！到「拍照」拍一張吧。`); st.set({ charTab: 'photo', meTick: st.meTick + 1 }); }}>完成</button>
        </footer>
      )}
    </>
  );
}
