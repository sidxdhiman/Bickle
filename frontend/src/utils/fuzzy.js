// Fast subsequence fuzzy matcher with scoring — good enough for live
// keystroke search over hundreds of items without any library.
// "drink wa" matches "Drink Water" (chars in order, word starts boosted).

export function fuzzyScore(query, text) {
  if (!query || !text) return 0;
  const fullQ = query.toLowerCase().trim();
  if (!fullQ) return 0;
  const t = text.toLowerCase();

  // Fast path: contiguous substring match (best signal)
  const subIdx = t.indexOf(fullQ);
  if (subIdx !== -1) {
    let score = 1000 + (fullQ.length / t.length) * 200;
    if (subIdx === 0) score += 300;
    else if (/[\s\-_/]/.test(t[subIdx - 1])) score += 150; // word-start substring
    score -= subIdx * 3;
    return score;
  }

  // Subsequence match on space-stripped query so "drink wa" scans as "drinkwa"
  const q = fullQ.replace(/\s+/g, '');
  if (!q) return 0;

  let ti = 0;
  let score = 0;
  let consecutive = 0;
  let prevIndex = -2;
  let matched = 0;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let i = ti; i < t.length; i++) {
      if (t[i] === ch) { found = i; break; }
    }
    if (found === -1) return 0;

    matched++;
    score += 10;
    if (found === prevIndex + 1) {
      consecutive += 1;
      score += 12 + consecutive * 6; // runs of consecutive chars are strong
    } else {
      consecutive = 0;
    }
    if (found === 0 || /[\s\-_/]/.test(t[found - 1])) score += 25; // word starts
    prevIndex = found;
    ti = found + 1;
  }

  score += (matched / t.length) * 60;
  return score;
}

// Score an item against a query using a primary field and optional
// secondary fields (weighted down). Returns best score or 0.
export function scoreItem(query, primary, secondaries = []) {
  let best = fuzzyScore(query, primary);
  for (const s of secondaries) {
    const sc = fuzzyScore(query, s) * 0.45;
    if (sc > best) best = sc;
  }
  return best;
}

// Rank a list of items for a query. `getText` returns the primary string,
// `getSecondaries` an optional array of lower-weight strings.
// Returns items with { item, score } sorted best-first, capped at `limit`.
export function fuzzySearch(query, items, getText, getSecondaries, limit = 10) {
  const scored = [];
  for (const item of items) {
    const score = scoreItem(query, getText(item), getSecondaries ? getSecondaries(item) : []);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
