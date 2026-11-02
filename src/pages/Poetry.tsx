import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { PoetryContext, usePoem, usePoetry, usePoetryLoader } from "../poetry/context";
import { poemStatus } from "../poetry/couplets";
import { usePoetryStore, poetryStore } from "../poetry/store";
import type { Poem } from "../poetry/types";

/** Poetry section: loads its own index on first visit, then shows the list or one poem. */
export function Poetry({ id }: { id?: string }) {
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
  return <PoetryContext.Provider value={atlas}>{id ? <PoemPage id={id} /> : <PoemList />}</PoetryContext.Provider>;
}

function PoemList() {
  const atlas = usePoetry();
  const [form, setForm] = useState<number | null>(null);
  const cards = usePoetryStore((s) => s.progress.cards);
  const shown = useMemo(() => atlas.poems.filter((p) => form === null || p.form === form), [atlas, form]);
  const usedForms = useMemo(() => [...new Set(atlas.poems.map((p) => p.form))].sort((a, b) => a - b), [atlas]);
  const started = useMemo(() => new Set(Object.keys(cards).map((k) => k.slice(0, k.lastIndexOf(":")))), [cards]);

  return (
    <div className="page poetry">
      <header className="page-head">
        <p className="eyebrow">诗词 · Poetry</p>
        <h1 className="display">读一首诗，记一首诗。</h1>
        <p className="lede">
          {atlas.count} 首唐诗，按由易到难排列。内容来自 chinese-poetry，尚未逐首人工审校。
        </p>
      </header>
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
      <ul className="poem-list">
        {shown.map((p) => (
          <li key={p.id}>
            <a href={`#/poetry/${encodeURIComponent(p.id)}`}>
              <b>{p.title}</b>
              <span>
                {p.author} · {atlas.forms[p.form]}
              </span>
              {started.has(p.id) && <i className="poem-dot" aria-label="已开始学习" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PoemPage({ id }: { id: string }) {
  const { poem, error } = usePoem(id);
  return (
    <div className="page poem-page">
      <a className="btn btn-ghost" href="#/poetry">
        <ChevronLeft size={18} /> 全部诗词
      </a>
      {poem ? <PoemBody poem={poem} /> : error ? <p>{error}</p> : <span className="spinner" />}
    </div>
  );
}

function PoemBody({ poem }: { poem: Poem }) {
  const atlas = usePoetry();
  const pinyin = usePoetryStore((s) => s.prefs.pinyin);
  const cards = usePoetryStore((s) => s.progress.cards);
  const status = poemStatus(poem, cards);
  return (
    <article className="poem">
      <header>
        <p className="eyebrow">
          {poem.dynasty} · {poem.author} · {poem.form}
        </p>
        <h1 className="display">{poem.title}</h1>
        <label className="poem-toggle">
          <input type="checkbox" checked={pinyin} onChange={(e) => poetryStore.prefs({ pinyin: e.target.checked })} /> 显示拼音
        </label>
      </header>
      <div className="poem-lines" lang="zh-Hans">
        {poem.lines.map((l, i) => (
          <p key={i}>
            {[...l.zh].map((ch, j) => (
              <ruby key={j}>
                {ch}
                {pinyin && l.py[j] ? <rt>{l.py[j]}</rt> : null}
              </ruby>
            ))}
          </p>
        ))}
      </div>
      {poem.gist && (
        <section>
          <h3 className="eyebrow">大意</h3>
          <p>{poem.gist}</p>
        </section>
      )}
      {poem.themes.length > 0 && <p className="poem-tags">{poem.themes.join(" · ")}</p>}
      <p className="poem-status">
        已开始 {status.started} / {status.total} 联 · 已掌握 {status.mastered} 联 · 共 {atlas.count} 首
      </p>
    </article>
  );
}
