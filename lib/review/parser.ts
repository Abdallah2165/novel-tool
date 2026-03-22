export type ReviewSourceMatch = {
  snippet: string;
  start: number;
  end: number;
};

export type ParsedReviewItem = {
  id: string;
  issue: string;
  evidence: string;
  minimalFix: string;
  rawBlock: string;
  sourceMatch: ReviewSourceMatch | null;
};

type ReviewFieldKey = "issue" | "evidence" | "minimalFix";

type ReviewFieldBuffer = Record<ReviewFieldKey, string[]>;

const FIELD_MATCHERS: Array<{ key: ReviewFieldKey; pattern: RegExp }> = [
  { key: "issue", pattern: /^(?:[-*]\s*)?(?:\d+[.)、]\s*)?问题[:：]\s*(.*)$/ },
  { key: "evidence", pattern: /^(?:[-*]\s*)?(?:\d+[.)、]\s*)?证据[:：]\s*(.*)$/ },
  { key: "minimalFix", pattern: /^(?:[-*]\s*)?(?:\d+[.)、]\s*)?最小修法[:：]\s*(.*)$/ },
];

function createEmptyBuffer(): ReviewFieldBuffer {
  return {
    issue: [],
    evidence: [],
    minimalFix: [],
  };
}

function compactLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean).join("\n").trim();
}

function normalizeForSearch(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function buildNormalizedMap(value: string) {
  let normalized = "";
  const indexMap: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (/\s/.test(char)) {
      continue;
    }

    normalized += char;
    indexMap.push(index);
  }

  return { normalized, indexMap };
}

function extractQuotedCandidates(value: string) {
  const matches = value.match(/[“"「『](.+?)[”"」』]/g) ?? [];
  return matches
    .map((match) => match.slice(1, -1).trim())
    .filter((candidate) => candidate.length >= 4);
}

function extractPhraseCandidates(value: string) {
  return value
    .split(/[\n，。；：、,.!?！？（）()【】\[\]]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 6);
}

function uniqueCandidates(candidates: string[]) {
  return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))).sort(
    (left, right) => right.length - left.length,
  );
}

export function findSourceMatch(
  sourceContent: string,
  evidence: string,
  issue?: string,
): ReviewSourceMatch | null {
  const normalizedSource = buildNormalizedMap(sourceContent);
  const candidates = uniqueCandidates([
    ...extractQuotedCandidates(evidence),
    ...extractQuotedCandidates(issue ?? ""),
    ...extractPhraseCandidates(evidence),
    ...extractPhraseCandidates(issue ?? ""),
  ]);

  for (const candidate of candidates) {
    const exactIndex = sourceContent.indexOf(candidate);
    if (exactIndex >= 0) {
      return {
        snippet: sourceContent.slice(exactIndex, exactIndex + candidate.length),
        start: exactIndex,
        end: exactIndex + candidate.length,
      };
    }

    const normalizedCandidate = normalizeForSearch(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const normalizedIndex = normalizedSource.normalized.indexOf(normalizedCandidate);
    if (normalizedIndex < 0) {
      continue;
    }

    const start = normalizedSource.indexMap[normalizedIndex];
    const endIndex = normalizedIndex + normalizedCandidate.length - 1;
    const end = normalizedSource.indexMap[endIndex] + 1;

    return {
      snippet: sourceContent.slice(start, end),
      start,
      end,
    };
  }

  return null;
}

export function parseReviewDraft(content: string, sourceContent = ""): ParsedReviewItem[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const items: ParsedReviewItem[] = [];
  let current = createEmptyBuffer();
  let currentField: ReviewFieldKey | null = null;

  const pushCurrent = () => {
    const issue = compactLines(current.issue);
    const evidence = compactLines(current.evidence);
    const minimalFix = compactLines(current.minimalFix);

    if (!issue && !evidence && !minimalFix) {
      current = createEmptyBuffer();
      currentField = null;
      return;
    }

    items.push({
      id: `review-item-${items.length + 1}`,
      issue,
      evidence,
      minimalFix,
      rawBlock: [`问题：${issue}`, `证据：${evidence}`, `最小修法：${minimalFix}`].join("\n").trim(),
      sourceMatch: sourceContent.trim() ? findSourceMatch(sourceContent, evidence, issue) : null,
    });

    current = createEmptyBuffer();
    currentField = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedField = FIELD_MATCHERS.find(({ pattern }) => pattern.test(trimmed));

    if (matchedField) {
      if (matchedField.key === "issue" && (current.issue.length || current.evidence.length || current.minimalFix.length)) {
        pushCurrent();
      }

      const [, value = ""] = trimmed.match(matchedField.pattern) ?? [];
      currentField = matchedField.key;
      if (value.trim()) {
        current[currentField].push(value.trim());
      }
      continue;
    }

    if (!currentField || !trimmed) {
      continue;
    }

    current[currentField].push(trimmed);
  }

  pushCurrent();
  return items.filter((item) => item.issue || item.evidence || item.minimalFix);
}
