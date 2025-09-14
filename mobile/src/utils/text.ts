export function computeShortName(name: string, maxLen = 10): string {
  const raw = (name || '').trim();
  if (!raw) return 'Assistant';
  // Take substring before common separators or brackets
  const sepIdxs = ['（', '(', '[', '【', '{', '·', '・', '-', '—', '·', '|', '｜', '—', '–', ':'].map((s) => raw.indexOf(s)).filter((i) => i > 0);
  const cutIdx = sepIdxs.length > 0 ? Math.min(...sepIdxs) : -1;
  let base = cutIdx > 0 ? raw.slice(0, cutIdx) : raw;
  base = base.trim();
  // If base longer than max, try to avoid cutting surrogate pairs
  if (base.length > maxLen) {
    base = Array.from(base).slice(0, maxLen).join('');
  }
  // Avoid empty result
  return base || 'Assistant';
}
