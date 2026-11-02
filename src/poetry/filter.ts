import { isMastered, type CardState } from "../store/srs";
import type { PoemRef } from "./types";

/** School stages are tags in the source data; the list shows them as their own filter. */
export const STAGES = ["小学古诗", "初中古诗", "高中古诗"];

export type Status = "all" | "new" | "learning" | "mastered" | "saved";
export const STATUS: [Status, string][] = [
  ["all", "全部"],
  ["new", "未学"],
  ["learning", "学习中"],
  ["mastered", "已掌握"],
  ["saved", "收藏"],
];
export const isStatus = (v: unknown): v is Status => STATUS.some(([k]) => k === v);

export type PoemState = "new" | "learning" | "mastered";

export interface PoemProgress {
  started: number;
  mastered: number;
}

/** Per poem: couplets started and mastered, counted from card ids (`<poemId>:<n>`). */
export function poemProgress(cards: Record<string, CardState>): Map<string, PoemProgress> {
  const m = new Map<string, PoemProgress>();
  for (const [k, c] of Object.entries(cards)) {
    const id = k.slice(0, k.lastIndexOf(":"));
    const cur = m.get(id) ?? { started: 0, mastered: 0 };
    cur.started++;
    if (isMastered(c)) cur.mastered++;
    m.set(id, cur);
  }
  return m;
}

/** Couplets that can be asked in a poem; a lone last line is not one. */
export const coupletCount = (p: Pick<PoemRef, "lines">) => Math.floor(p.lines / 2);

/** A poem is mastered when every askable couplet is, learning once any couplet has been asked. */
export function stateOf(p: Pick<PoemRef, "lines">, v: PoemProgress | undefined): PoemState {
  const total = coupletCount(p);
  if (v && total > 0 && v.mastered >= total) return "mastered";
  return v && v.started > 0 ? "learning" : "new";
}

export interface ListFilter {
  q: string;
  /** Names rather than indexes, so links stay valid if the data is regenerated. */
  form?: string;
  stage?: string;
  theme?: string;
  status: Status;
}

export interface FilterSource {
  poems: PoemRef[];
  forms: string[];
  themes: string[];
}

export function filterPoems(atlas: FilterSource, f: ListFilter, progress: Map<string, PoemProgress>, bookmarks: string[]): PoemRef[] {
  const q = f.q.trim();
  const form = f.form ? atlas.forms.indexOf(f.form) : -1;
  const stage = f.stage ? atlas.themes.indexOf(f.stage) : -1;
  const theme = f.theme ? atlas.themes.indexOf(f.theme) : -1;
  const saved = new Set(bookmarks);
  return atlas.poems.filter((p) => {
    if (f.form && p.form !== form) return false;
    if (f.stage && !p.themes.includes(stage)) return false;
    if (f.theme && !p.themes.includes(theme)) return false;
    if (q && !p.title.includes(q) && !p.author.includes(q)) return false;
    if (f.status === "saved") return saved.has(p.id);
    if (f.status === "all") return true;
    return stateOf(p, progress.get(p.id)) === f.status;
  });
}
