import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectQuality, GalaxyEngine } from "../galaxy/engine";
import { TOPIC_COLORS } from "../galaxy/layout";
import { go } from "../lib/router";
import { cue } from "../lib/sound";
import { store } from "../store/store";
import { stateOf, poemProgress } from "./filter";
import { usePoetry } from "./context";
import { layoutPoems } from "./galaxy";
import { usePoetryStore } from "./store";
import type { PoemRef } from "./types";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const clampDist = (d: number) => Math.max(0.35, Math.min(4.2, d));
const sfx = () => store.get().settings.sfx;

/** The poem atlas as a star map: one star per poem, arms by form, brighter as it is learned. */
export function PoetryGalaxy({ focus }: { focus?: string | null }) {
  const atlas = usePoetry();
  const layout = useMemo(() => layoutPoems(atlas), [atlas]);
  const cards = usePoetryStore((s) => s.progress.cards);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<GalaxyEngine | null>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ ref: PoemRef; x: number; y: number } | null>(null);
  const [fallback, setFallback] = useState(false);
  const progress = useMemo(() => poemProgress(cards), [cards]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const eng = new GalaxyEngine(cv, layout, { quality: detectQuality(), reducedMotion: reduced(), preserve: false, autoRotate: 0.025, distScale: 0.62 });
    engine.current = eng;
    setFallback(!eng.webgl);
    eng.resize();
    const ro = new ResizeObserver(() => eng.resize());
    ro.observe(cv);
    // Only animate while visible.
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? eng.start() : eng.stop()));
    io.observe(cv);
    const vis = () => (document.hidden ? eng.stop() : eng.start());
    document.addEventListener("visibilitychange", vis);
    eng.onFrame = () => {
      const kids = labels.current?.children as HTMLCollectionOf<HTMLElement> | undefined;
      if (!kids) return;
      layout.topicCenters.forEach(([x, y, z], k) => {
        const el = kids[k];
        const p = eng.toScreen(x, y, z);
        if (!el) return;
        if (!p) {
          el.style.opacity = "0";
          return;
        }
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = String(Math.max(0, Math.min(0.9, 3.4 - p.depth)));
      });
    };
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      eng.destroy();
      engine.current = null;
    };
  }, [layout]);

  // Brightness follows learning state: dust, learning, mastered.
  useEffect(() => {
    const states = new Float32Array(layout.n);
    atlas.poems.forEach((p, i) => {
      const s = stateOf(p, progress.get(p.id));
      states[i] = s === "mastered" ? 2 : s === "learning" ? 1 : 0;
    });
    engine.current?.setStates(states);
  }, [atlas, layout, progress]);

  useEffect(() => {
    if (!focus) return;
    const i = layout.index.get(focus);
    if (i !== undefined) {
      engine.current?.flyTo(i);
      if (sfx()) void cue("fly");
    }
  }, [focus, layout]);

  /* ---------- interaction ---------- */
  const drag = useRef<{ x: number; y: number; moved: number; pinch?: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastTwinkle = useRef(0);
  const dwell = useRef(0);
  useEffect(() => () => window.clearTimeout(dwell.current), []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const open = (ref: PoemRef) => window.setTimeout(() => go({ page: "poetry", id: ref.id }), 350);

  const onMove = (e: React.PointerEvent) => {
    const eng = engine.current;
    if (!eng) return;
    const p = local(e);
    const ps = pointers.current;
    if (ps.has(e.pointerId)) {
      const prev = ps.get(e.pointerId)!;
      ps.set(e.pointerId, p);
      if (ps.size === 2) {
        const [a, b] = [...ps.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (drag.current?.pinch) eng.cam.dist = clampDist(eng.cam.dist * (drag.current.pinch / dist));
        if (drag.current) drag.current.pinch = dist;
        return;
      }
      if (drag.current) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        eng.cam.yaw -= dx * 0.006;
        eng.cam.pitch = Math.max(0.12, Math.min(1.45, eng.cam.pitch + dy * 0.005));
      }
      return;
    }
    if (e.pointerType !== "mouse") return;
    // Only reveal a poem once the cursor rests on its star, so sweeping across doesn't flicker.
    const i = eng.pick(p.x, p.y);
    eng.hover = i;
    window.clearTimeout(dwell.current);
    if (i < 0) {
      dwell.current = window.setTimeout(() => setHover(null), 260);
      return;
    }
    const ref = atlas.poems[i];
    if (hover?.ref.id === ref.id) return;
    dwell.current = window.setTimeout(() => {
      setHover({ ref, x: p.x, y: p.y });
      const now = performance.now();
      if (sfx() && now - lastTwinkle.current > 400) {
        lastTwinkle.current = now;
        void cue("twinkle");
      }
    }, 120);
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    drag.current = { ...local(e), moved: 0 };
  };

  const onUp = (e: React.PointerEvent) => {
    const eng = engine.current;
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) return;
    drag.current = null;
    if (!eng || !d || d.moved > 8) return;
    const p = local(e);
    const i = eng.pick(p.x, p.y, e.pointerType === "mouse" ? 16 : 26);
    if (i < 0) return;
    const ref = atlas.poems[i];
    if (e.pointerType !== "mouse" && hover?.ref.id !== ref.id) {
      // First tap previews, second tap opens.
      eng.hover = i;
      setHover({ ref, x: p.x, y: p.y });
      if (sfx()) void cue("twinkle");
      return;
    }
    eng.flyTo(i);
    if (sfx()) void cue("fly");
    open(ref);
  };

  useEffect(() => {
    // Wheel zoom must not scroll the page while over the galaxy.
    const cv = canvas.current;
    if (!cv) return;
    const stop = (e: WheelEvent) => {
      e.preventDefault();
      if (engine.current) engine.current.cam.dist = clampDist(engine.current.cam.dist * Math.exp(e.deltaY * 0.0012));
    };
    cv.addEventListener("wheel", stop, { passive: false });
    return () => cv.removeEventListener("wheel", stop);
  }, []);

  const lit = useMemo(() => atlas.poems.reduce((n, p) => n + (progress.has(p.id) ? 1 : 0), 0), [atlas, progress]);
  const zoom = (k: number) => engine.current && (engine.current.cam.dist = clampDist(engine.current.cam.dist * k));
  const state = hover ? stateOf(hover.ref, progress.get(hover.ref.id)) : "new";

  return (
    <div className="galaxy galaxy-full">
      <canvas
        ref={canvas}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          if (engine.current) engine.current.hover = -1;
          setHover(null);
        }}
        role="img"
        aria-label={`诗词星图：${layout.n} 颗星，已点亮 ${lit} 颗。可拖动旋转、滚动缩放，点击星星打开诗。`}
        tabIndex={0}
        onKeyDown={(e) => {
          const eng = engine.current;
          if (!eng) return;
          if (e.key === "ArrowLeft") eng.cam.yaw -= 0.12;
          if (e.key === "ArrowRight") eng.cam.yaw += 0.12;
          if (e.key === "ArrowUp") eng.cam.pitch = Math.min(1.45, eng.cam.pitch + 0.08);
          if (e.key === "ArrowDown") eng.cam.pitch = Math.max(0.12, eng.cam.pitch - 0.08);
          if (e.key === "+" || e.key === "=") zoom(0.85);
          if (e.key === "-") zoom(1.18);
        }}
      />
      {fallback && <span className="galaxy-fallback" />}
      <div className="galaxy-labels" ref={labels} aria-hidden="true">
        {layout.labels.map((name, k) => (
          <span key={name} style={{ "--c": TOPIC_COLORS[k % TOPIC_COLORS.length] } as React.CSSProperties}>
            {name}
          </span>
        ))}
      </div>
      {hover && (
        <button
          className="galaxy-tip poem-tip"
          style={{ transform: `translate(${Math.min(hover.x + 18, (canvas.current?.clientWidth ?? 0) - 220)}px, ${Math.max(8, hover.y - 46)}px)` }}
          onClick={() => go({ page: "poetry", id: hover.ref.id })}
        >
          <span>
            <b>{hover.ref.title}</b>
            <small>
              {hover.ref.author} · {atlas.forms[hover.ref.form]} · {state === "mastered" ? "已掌握" : state === "learning" ? "学习中" : "未学"}
            </small>
          </span>
        </button>
      )}
      <div className="galaxy-hud">
        <p>
          <b>{lit}</b> / {layout.n} 颗星已点亮
        </p>
        <ul className="galaxy-legend" aria-hidden="true">
          <li>
            <i className="lg-dust" />
            未学
          </li>
          <li>
            <i className="lg-learning" />
            学习中
          </li>
          <li>
            <i className="lg-mastered" />
            已掌握
          </li>
        </ul>
      </div>
      <div className="galaxy-controls">
        <button className="icon-btn" onClick={() => zoom(0.8)} aria-label="放大">
          <Plus size={18} />
        </button>
        <button className="icon-btn" onClick={() => zoom(1.25)} aria-label="缩小">
          <Minus size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            engine.current?.reset();
            engine.current?.replayIntro();
            if (sfx()) void cue("fly");
          }}
          aria-label="回到全景"
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            const started = atlas.poems.filter((p) => progress.has(p.id));
            const pick = started[Math.floor(Math.random() * started.length)] ?? atlas.poems[0];
            const i = layout.index.get(pick.id);
            if (i !== undefined) {
              engine.current?.flyTo(i);
              if (sfx()) void cue("fly");
            }
          }}
          aria-label="飞到一颗已点亮的星"
        >
          <Crosshair size={17} />
        </button>
      </div>
      <p className="galaxy-hint">拖动旋转 · 滚动缩放 · 点击星星打开诗</p>
    </div>
  );
}
