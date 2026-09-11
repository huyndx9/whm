import type { Ingredient, Supplier } from "../../types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s()[\]{}·.,/-]/g, "");
}

/** 두 문자열의 문자 단위 유사도 0..1 (Dice 계수) */
function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) {
    return 0.85 + 0.1 * (Math.min(x.length, y.length) / Math.max(x.length, y.length));
  }

  const bigrams = (s: string): string[] => {
    if (s.length < 2) return [s];
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };

  const bx = bigrams(x);
  const by = bigrams(y);
  const pool = [...by];
  let hits = 0;
  for (const g of bx) {
    const idx = pool.indexOf(g);
    if (idx >= 0) {
      hits++;
      pool.splice(idx, 1);
    }
  }
  return (2 * hits) / (bx.length + by.length);
}

export interface MatchResult {
  ingredientId: string | null;
  confidence: number;
}

/**
 * 영수증의 품목명을 등록된 원재료와 연결한다.
 * 이름과 품목 설명 양쪽을 보고 가장 잘 맞는 항목을 고른다.
 */
export function matchIngredient(rawName: string, ingredients: Ingredient[]): MatchResult {
  let best: MatchResult = { ingredientId: null, confidence: 0 };

  for (const ing of ingredients) {
    if (!ing.active) continue;
    const byName = similarity(rawName, ing.name);
    const byNote = similarity(rawName, ing.note) * 0.8;
    const score = Math.max(byName, byNote);
    if (score > best.confidence) {
      best = { ingredientId: ing.id, confidence: Number(score.toFixed(2)) };
    }
  }

  // 너무 낮은 점수는 매칭 실패로 처리해서 사용자가 직접 고르게 한다
  if (best.confidence < 0.45) return { ingredientId: null, confidence: best.confidence };
  return best;
}

export function matchSupplier(rawName: string, suppliers: Supplier[]): string | null {
  if (!rawName.trim()) return null;
  let bestId: string | null = null;
  let bestScore = 0;
  for (const s of suppliers) {
    if (!s.active) continue;
    const score = similarity(rawName, s.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = s.id;
    }
  }
  return bestScore >= 0.5 ? bestId : null;
}
