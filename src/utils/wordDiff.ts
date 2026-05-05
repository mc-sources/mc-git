export interface TextSpan {
  text: string;
  changed: boolean;
}

/** Tokenize a string into word and non-word tokens. */
function tokenize(s: string): string[] {
  return s.match(/\w+|\W/g) ?? [];
}

/**
 * Compute word-level diff between two strings using LCS.
 * Returns spans for the old line (removals highlighted) and new line (additions highlighted).
 * Limited to 200 tokens per side to avoid O(n²) slowness on very long lines.
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string
): { oldSpans: TextSpan[]; newSpans: TextSpan[] } {
  const MAX = 200;
  const oldTokens = tokenize(oldLine).slice(0, MAX);
  const newTokens = tokenize(newLine).slice(0, MAX);

  const m = oldTokens.length;
  const n = newTokens.length;

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldTokens[i - 1] === newTokens[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to find matching token indices
  const oldMatch = new Set<number>();
  const newMatch = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      oldMatch.add(i - 1);
      newMatch.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Build spans — merge consecutive tokens of same type
  function buildSpans(tokens: string[], matched: Set<number>): TextSpan[] {
    const spans: TextSpan[] = [];
    for (let k = 0; k < tokens.length; k++) {
      const changed = !matched.has(k);
      if (spans.length > 0 && spans[spans.length - 1].changed === changed) {
        spans[spans.length - 1].text += tokens[k];
      } else {
        spans.push({ text: tokens[k], changed });
      }
    }
    return spans;
  }

  return {
    oldSpans: buildSpans(oldTokens, oldMatch),
    newSpans: buildSpans(newTokens, newMatch),
  };
}
