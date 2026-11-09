// 進入點：把 3D 島嶼掛到 index.html 的 #island-root。
// 不支援 WebGL 的瀏覽器保留頁面上的提示文字。
import { createRoot } from 'react-dom/client';
import css from './styles.css?inline';
import { App } from './App';
import { buildPois } from './data';
import { useStore } from './store';
import gsap from 'gsap';

// 畫面很卡時，動畫照實際時間走完（不要變成慢動作），鏡頭才不會飛很久才到
gsap.ticker.lagSmoothing(0);

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function mount() {
  const el = document.getElementById('island-root');
  if (!el) return;
  if (!webgl()) { el.classList.add('isl-nogl'); return; }
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  useStore.getState().set({ pois: buildPois() });
  el.textContent = '';
  el.classList.add('isl-ready');
  createRoot(el).render(<App />);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
