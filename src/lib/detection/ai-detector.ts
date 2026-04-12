// ─── Types ───────────────────────────────────────────────────────────────────

export interface SentenceScore {
  sentence: string;
  score: number; // 0.0 to 1.0
  isAi: boolean;
}

export interface AiDetectionResult {
  overallScore: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  sentenceScores: SentenceScore[];
  signals: string[];
}

interface AiSignal {
  name: string;
  score: number;   // 0.0 to 1.0, higher = more AI-like
  weight: number;  // importance of this signal
  detail: string;  // human-readable explanation
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_PHRASES = [
  "furthermore", "moreover", "in conclusion", "it is worth noting",
  "it is important to", "it is worth mentioning", "notably",
  "significantly", "importantly", "in summary", "to summarize",
  "in addition to", "delve into", "comprehensive", "multifaceted",
  "it should be noted", "one must consider", "it can be argued",
  "this highlights", "this demonstrates", "this underscores",
  "plays a crucial role", "plays a key role", "a wide range of",
  "a variety of", "in the realm of", "in the context of",
  "it is essential", "it is crucial", "needless to say",
  "as previously mentioned", "as stated above", "in light of",
  "taking into account", "with respect to", "with regard to",
  "on the other hand", "by the same token", "in this regard",
  "moving forward", "going forward", "at the end of the day",
  "the fact that", "due to the fact", "in terms of",
];

// Em-dash (—), en-dash (–), curly double/single quotes (""), (''), ellipsis (…)
const TYPOGRAPHIC_CHARS_RE = /[—–""''…]/g;

const CONTRACTION_RE =
  /\b(don't|can't|won't|it's|they're|I've|I'm|you're|we're|isn't|aren't|wasn't|weren't|hasn't|haven't|couldn't|wouldn't|shouldn't|doesn't|didn't)\b/gi;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  const sentences = text
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length < 2) {
    return [text.trim()];
  }

  return sentences;
}

// ─── Signals ─────────────────────────────────────────────────────────────────

function signalTypographicChars(text: string): AiSignal {
  const words = text.split(/\s+/).filter(Boolean).length;
  const aiChars = (text.match(TYPOGRAPHIC_CHARS_RE) ?? []).length;
  const emDashCount = (text.match(/—/g) ?? []).length;
  const perWordRate = words > 0 ? aiChars / words : 0;

  // Calibration: 1 typographic char per 40 words = suspicious; per 20 = almost certainly AI
  let score = Math.min(1.0, perWordRate * 25);

  // Em-dashes are extremely rare in human typing — hard minimums
  if (emDashCount >= 2) score = Math.max(score, 0.55);
  if (emDashCount >= 5) score = Math.max(score, 0.75);

  return {
    name: "typographic_chars",
    score,
    weight: 0.25,
    detail: `Found ${aiChars} typographic characters (em-dashes, curly quotes) — not standard keyboard input`,
  };
}

function signalAiPhrases(text: string): AiSignal {
  const totalWords = text.trim().split(/\s+/).filter(Boolean).length;
  let phraseCount = 0;
  for (const phrase of AI_PHRASES) {
    phraseCount += (text.match(new RegExp(phrase, "gi")) ?? []).length;
  }
  const phraseDensity = totalWords > 0 ? phraseCount / totalWords : 0;
  const score = Math.min(1.0, phraseDensity * 40);
  return {
    name: "ai_phrases",
    score,
    weight: 0.20,
    detail: `Found ${phraseCount} AI-typical transition phrases in ${totalWords} words`,
  };
}

function signalBurstiness(text: string): AiSignal {
  const sentences = splitSentences(text);
  if (sentences.length < 3) {
    return {
      name: "burstiness",
      score: 0,
      weight: 0.20,
      detail: "Insufficient sentences to measure length variation",
    };
  }
  const lengths = sentences.map(
    (s) => s.trim().split(/\s+/).filter(Boolean).length
  );
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  const score = Math.max(0, Math.min(1.0, 1 - cv / 0.4));
  return {
    name: "burstiness",
    score,
    weight: 0.20,
    detail: `Sentence length variation: ${cv.toFixed(2)} (lower variation = more AI-like)`,
  };
}

function signalContractions(text: string): AiSignal {
  const contractions = (text.match(CONTRACTION_RE) ?? []).length;
  const totalSentences = splitSentences(text).length;
  const contractionRate = totalSentences > 0 ? contractions / totalSentences : 0;
  const score = Math.max(0, 1 - contractionRate * 3);
  return {
    name: "contractions",
    score,
    weight: 0.15,
    detail: `${contractions} contractions found — formal writing with no contractions is AI-typical`,
  };
}

function signalVocabulary(text: string): AiSignal {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return {
      name: "vocabulary",
      score: 0.2,
      weight: 0.10,
      detail: "Insufficient text for vocabulary analysis",
    };
  }

  const uniqueWords = new Set(words).size;
  const typeTokenRatio = uniqueWords / words.length;
  const longWords = words.filter((w) => w.length >= 7).length;
  const longWordRatio = longWords / words.length;

  // AI sweet spot: 25–45% long (7+ char) words
  const inAiZone = longWordRatio >= 0.25 && longWordRatio <= 0.45;
  const score = inAiZone ? 0.6 : 0.2;

  return {
    name: "vocabulary",
    score,
    weight: 0.10,
    detail: `${Math.round(longWordRatio * 100)}% sophisticated words, vocabulary diversity: ${typeTokenRatio.toFixed(2)}`,
  };
}

function signalStructure(text: string): AiSignal {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const hasOneSentenceParagraphs = paragraphs.some(
    (p) => splitSentences(p).length === 1
  );
  const hasFirstPerson = /\b(I|my|me|myself)\b/.test(text);
  const hasQuestions = text.includes("?");

  let humanSignals = 0;
  if (hasOneSentenceParagraphs) humanSignals++;
  if (hasFirstPerson) humanSignals++;
  if (hasQuestions) humanSignals++;

  const score = Math.max(0, 1 - humanSignals * 0.35);
  return {
    name: "structure",
    score,
    weight: 0.10,
    detail: `Structural markers: first-person=${hasFirstPerson}, questions=${hasQuestions}, varied paragraphs=${hasOneSentenceParagraphs}`,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function detectAiContent(text: string): Promise<AiDetectionResult> {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount === 0) {
    return {
      overallScore: 0,
      confidence: "LOW",
      sentenceScores: [],
      signals: ["Insufficient text for analysis"],
    };
  }

  const allSignals: AiSignal[] = [
    signalTypographicChars(trimmed),
    signalAiPhrases(trimmed),
    signalBurstiness(trimmed),
    signalContractions(trimmed),
    signalVocabulary(trimmed),
    signalStructure(trimmed),
  ];

  // Weights sum to 1.0 (0.25+0.20+0.20+0.15+0.10+0.10)
  const totalWeight = allSignals.reduce((sum, s) => sum + s.weight, 0);
  const weightedScore =
    allSignals.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;

  // ── Fix 4: hard minimums for strong typographic signals ──────────────────
  const totalEmDashes = (trimmed.match(/—/g) ?? []).length;
  const totalEllipsis = (trimmed.match(/…/g) ?? []).length;
  const contractionCount = (trimmed.match(CONTRACTION_RE) ?? []).length;

  let finalScore = weightedScore;
  if (totalEmDashes >= 3) finalScore = Math.max(finalScore, 0.45);
  if (totalEmDashes >= 6) finalScore = Math.max(finalScore, 0.62);
  if (totalEmDashes >= 3 && totalEllipsis >= 2) finalScore = Math.max(finalScore, 0.58);
  if (wordCount >= 300 && contractionCount === 0) finalScore = Math.max(finalScore, 0.40);

  // ── Fix 5: recalibrated confidence thresholds ─────────────────────────────
  let confidence: "LOW" | "MEDIUM" | "HIGH";
  if (wordCount < 80) {
    confidence = "LOW";
  } else if (wordCount < 250) {
    confidence = finalScore > 0.55 ? "MEDIUM" : "LOW";
  } else {
    if (finalScore > 0.65) confidence = "HIGH";
    else if (finalScore > 0.40) confidence = "MEDIUM";
    else confidence = "LOW";
  }

  // Only surface signals that contributed meaningfully
  const signals = allSignals
    .filter((s) => s.score > 0.4)
    .map((s) => s.detail);

  // ── Fix 3: sentence-level scoring with per-character weights ─────────────
  const sentences = splitSentences(trimmed);
  const sentenceScores: SentenceScore[] = sentences.map((sentence) => {
    const emDashInSentence = (sentence.match(/—/g) ?? []).length;
    const ellipsisInSentence = (sentence.match(/…/g) ?? []).length;
    const curlyQuotes = (sentence.match(/[""'']/g) ?? []).length;
    const hasAiPhrase = AI_PHRASES.some((p) =>
      sentence.toLowerCase().includes(p)
    );

    const charScore = Math.min(1,
      emDashInSentence * 0.6 +
      ellipsisInSentence * 0.4 +
      curlyQuotes * 0.15
    );
    const phraseScore = hasAiPhrase ? 0.65 : 0;
    const score = Math.min(1, Math.max(charScore, phraseScore));

    return { sentence, score, isAi: score > 0.30 };
  });

  return { overallScore: finalScore, confidence, sentenceScores, signals };
}
