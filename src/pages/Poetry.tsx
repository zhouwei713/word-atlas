import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { go } from "../lib/router";
import { PoetryContext, usePoem, usePoetry, usePoetryLoader } from "../poetry/context";
import { PoetryLearn } from "./PoetryLearn";
import { poemStatus } from "../poetry/couplets";
import { poetryStore, togglePoemBookmark, usePoetryStore } from "../poetry/store";
import { newToday } from "../poetry/quiz";
import { isMastered } from "../store/srs";
import type { Poem } from "../poetry/types";

/** School stages are tags in the source data; the list shows them as their own filter. */
const STAGES = ["小学古诗", "初中古诗", "高中古诗"];
const poemHref = (id: string) => `#/poetry/${encodeURIComponent(id)}`;

/** Poetry section: loads its own index on first visit, then shows the list or one poem. */
export function Poetry({ id, learn, poem }: { id?: string; learn?: boolean; poem?: string }) {
  const { atlas, error } = usePoetryLoader();
  if (error)
    return (
      <div className="page">
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    );
  if (!atlas)
    return (
      <div className="page" aria-busy="true">
        <span className="spinner" />
      </div>
    );
  return (
    <PoetryContext.Provider value={atlas}>{learn ? <PoetryLearn poem={poem} /> : id ? <PoemPage id={id} /> : <PoemList />}</PoetryContext.Provider>
  );
}

function PoemList() {
  const atlas = usePoetry();
  const cards = usePoetryStore((s) => s.progress.cards);
  const bookmarks = usePoetryStore((s) => s.progress.bookmarks);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<number | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [saved, setSaved] = useState(false);

  const usedForms = useMemo(() => [...new Set(atlas.poems.map((p) => p.form))].sort((a, b) => a - b), [atlas]);
  const themeCount = useMemo(() => {
    const n = new Map<number, number>();
    for (const p of atlas.poems) for (const t of p.themes) n.set(t, (n.get(t) ?? 0) + 1);
    return n;
  }, [atlas]);
  const themeOptions = useMemo(
    () =>
      [...themeCount]
        .filter(([t, c]) => c >= 2 && !STAGES.includes(atlas.themes[t]))
        .sort((a, b) => b[1] - a[1] || a[0] - b[0]),
    [atlas, themeCount],
  );
  const stageIndex = useMemo(() => new Map(STAGES.map((s) => [s, atlas.themes.indexOf(s)])), [atlas]);

  /** Per poem: couplets started and mastered, counted from card ids (`<poemId>:<n>`). */
  const progress = useMemo(() => {
    const m = new Map<string, { started: number; mastered: number }>();
    for (const [k, c] of Object.entries(cards)) {
      const id = k.slice(0, k.lastIndexOf(":"));
      const cur = m.get(id) ?? { started: 0, mastered: 0 };
      cur.started++;
      if (isMastered(c)) cur.mastered++;
      m.set(id, cur);
    }
    return m;
  }, [cards]);

  const shown = useMemo(() => {
    const query = q.trim();
    const themeIdx = theme === "" ? -1 : Number(theme);
    const stageIdx = stage ? (stageIndex.get(stage) ?? -1) : -1;
    return atlas.poems.filter(
      (p) =>
        (form === null || p.form === form) &&
        (themeIdx < 0 || p.themes.includes(themeIdx)) &&
        (!stage || (stageIdx >= 0 && p.themes.includes(stageIdx))) &&
        (!saved || bookmarks.includes(p.id)) &&
        (!query || p.title.includes(query) || p.author.includes(query)),
    );
  }, [atlas, q, form, stage, theme, saved, bookmarks, stageIndex]);

  const learned = [...progress.values()].filter((v) => v.started > 0).length;

  // Today's plan from the index alone: due cards, plus unseen poems up to the daily limit.
  const dailyNew = usePoetryStore((s) => s.prefs.dailyNew);
  const progressAll = usePoetryStore((s) => s.progress);
  const plan = useMemo(() => {
    const now = Date.now();
    const known = new Set(atlas.poems.map((p) => p.id));
    const due = Object.entries(progressAll.cards).filter(([k, c]) => c.due <= now && known.has(k.slice(0, k.lastIndexOf(":")))).length;
    const unseen = atlas.poems.filter((p) => !progress.has(p.id)).length;
    return { due, fresh: Math.min(unseen, Math.max(0, dailyNew - newToday(progressAll))) };
  }, [atlas, progress, progressAll, dailyNew]);

  return (
    <div className="page poetry">
      <header className="page-head">
        <p className="eyebrow">诗词 · Poetry</p>
        <h1 className="display">读一首诗，记一首诗。</h1>
        <p className="lede">
          {atlas.count} 首唐诗，按由易到难排列，已开始 {learned} 首。内容来自 chinese-poetry，尚未逐首人工审校。
        </p>
      </header>

      <section className="panel poem-plan" aria-label="今日学习">
        <div>
          <p className="eyebrow">今日</p>
          <p className="poem-plan-line">
            复习 <b>{plan.due}</b> 联 · 新诗 <b>{plan.fresh}</b> 首
          </p>
        </div>
        <label className="poem-plan-new">
          每天新诗
          <select value={dailyNew} onChange={(e) => poetryStore.prefs({ dailyNew: Number(e.target.value) })} aria-label="每天新诗数">
            {[1, 2, 3, 5, 8].map((n) => (
              <option key={n} value={n}>
                {n} 首
              </option>
            ))}
          </select>
        </label>
        <a className={`btn btn-primary ${plan.due + plan.fresh === 0 ? "is-disabled" : ""}`} href="#/poetry/learn" aria-disabled={plan.due + plan.fresh === 0}>
          开始学习
        </a>
      </section>

      <div className="poem-filters">
        <label className="search poem-search">
          <Search size={17} aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索题目或诗人" aria-label="搜索题目或诗人" />
        </label>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="题材">
          <option value="">全部题材</option>
          {themeOptions.map(([t, c]) => (
            <option key={t} value={t}>
              {atlas.themes[t]}（{c}）
            </option>
          ))}
        </select>
        <button className={`btn ${saved ? "btn-primary" : "btn-ghost"}`} onClick={() => setSaved(!saved)} aria-pressed={saved}>
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />} 收藏 {bookmarks.length}
        </button>
      </div>
      <div className="segmented segmented-wide" role="group" aria-label="体裁">
        <button className={form === null ? "is-on" : ""} onClick={() => setForm(null)} aria-pressed={form === null}>
          全部
        </button>
        {usedForms.map((f) => (
          <button key={f} className={form === f ? "is-on" : ""} onClick={() => setForm(f)} aria-pressed={form === f}>
            {atlas.forms[f]}
          </button>
        ))}
      </div>
      <div className="segmented segmented-wide" role="group" aria-label="学段">
        <button className={stage === null ? "is-on" : ""} onClick={() => setStage(null)} aria-pressed={stage === null}>
          全部学段
        </button>
        {STAGES.filter((s) => (stageIndex.get(s) ?? -1) >= 0).map((s) => (
          <button key={s} className={stage === s ? "is-on" : ""} onClick={() => setStage(s)} aria-pressed={stage === s}>
            {s}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="poem-empty">{saved && bookmarks.length === 0 ? "还没有收藏。在诗词页点右上角的书签即可收藏。" : "没有符合条件的诗。"}</p>
      ) : (
        <ul className="poem-list">
          {shown.map((p) => {
            const total = Math.floor(p.lines / 2);
            const v = progress.get(p.id);
            return (
              <li key={p.id}>
                <a href={poemHref(p.id)}>
                  <b>{p.title}</b>
                  <span>
                    {p.author} · {atlas.forms[p.form]}
                  </span>
                  {v && (
                    <small className={v.mastered >= total ? "is-done" : ""}>
                      {v.mastered >= total ? "已掌握" : `掌握 ${v.mastered}/${total} 联`}
                    </small>
                  )}
                  {bookmarks.includes(p.id) && <BookmarkCheck className="poem-mark" size={16} aria-label="已收藏" />}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PoemPage({ id }: { id: string }) {
  const atlas = usePoetry();
  const { poem, error } = usePoem(id);
  const ref = atlas.byId.get(id);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  const neighbor = (d: number) => {
    const n = ref && atlas.poems[ref.order + d];
    if (n) go({ page: "poetry", id: n.id }, null, true);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") neighbor(-1);
      if (e.key === "ArrowRight") neighbor(1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (!ref) {
    return (
      <div className="page poem-page">
        <a className="btn btn-ghost" href="#/poetry">
          <ChevronLeft size={18} /> 全部诗词
        </a>
        <p>没有找到这首诗。</p>
      </div>
    );
  }
  return (
    <div className="page poem-page">
      <div className="poem-bar">
        <a className="btn btn-ghost" href="#/poetry">
          <ChevronLeft size={18} /> 全部诗词
        </a>
        <span className="poem-bar-actions">
          <a className="btn btn-primary" href={`#/poetry/learn?p=${encodeURIComponent(id)}`}>
            学这首
          </a>
          <BookmarkButton id={id} />
        </span>
      </div>
      {poem ? <PoemBody poem={poem} /> : error ? <p>{error}</p> : <span className="spinner" />}
      <nav className="poem-nav" aria-label="切换诗词">
        <button className="icon-btn" onClick={() => neighbor(-1)} disabled={ref.order === 0} aria-label="上一首">
          <ChevronLeft size={20} />
        </button>
        <span>
          {ref.order + 1} / {atlas.count}
        </span>
        <button className="icon-btn" onClick={() => neighbor(1)} disabled={ref.order >= atlas.count - 1} aria-label="下一首">
          <ChevronRight size={20} />
        </button>
      </nav>
    </div>
  );
}

function BookmarkButton({ id }: { id: string }) {
  const saved = usePoetryStore((s) => s.progress.bookmarks.includes(id));
  return (
    <button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => togglePoemBookmark(id)} aria-pressed={saved} aria-label={saved ? "取消收藏" : "收藏"} title={saved ? "取消收藏" : "收藏"}>
      {saved ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
    </button>
  );
}

function PoemBody({ poem }: { poem: Poem }) {
  const pinyin = usePoetryStore((s) => s.prefs.pinyin);
  const cards = usePoetryStore((s) => s.progress.cards);
  const status = poemStatus(poem, cards);
  const themes = poem.themes.filter((t) => !STAGES.includes(t));
  const stage = poem.themes.find((t) => STAGES.includes(t));
  return (
    <article className="poem">
      <header>
        <p className="eyebrow">
          {poem.dynasty} · {poem.author} · {poem.form}
          {stage ? ` · ${stage}` : ""}
        </p>
        <h1 className="display">{poem.title}</h1>
        <label className="poem-toggle">
          <input type="checkbox" checked={pinyin} onChange={(e) => poetryStore.prefs({ pinyin: e.target.checked })} /> 显示拼音
        </label>
      </header>
      <div className={`poem-lines ${pinyin ? "has-py" : ""}`} lang="zh-Hans">
        {poem.lines.map((l, i) => (
          <p key={i}>
            {[...l.zh].map((ch, j) => (
              <span key={j} className={l.py[j] ? "ch" : "ch ch-punct"}>
                {pinyin && <small aria-hidden>{l.py[j]}</small>}
                <span>{ch}</span>
              </span>
            ))}
          </p>
        ))}
      </div>
      {poem.gist && (
        <section className="poem-gist">
          <h3 className="eyebrow">大意</h3>
          <p>{poem.gist}</p>
        </section>
      )}
      {themes.length > 0 && <p className="poem-tags">{themes.join(" · ")}</p>}
      <p className="poem-status">
        已开始 {status.started} / {status.total} 联 · 已掌握 {status.mastered} 联
      </p>
    </article>
  );
}
