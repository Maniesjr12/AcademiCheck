import { createRequire } from "module";
import { searchCrossRef, searchSemanticScholar, searchOpenAlex, type SearchResult } from "./source-lookup";

// natural is CJS-only; its main entry is broken by afinn-165 ESM dep,
// so we import the two submodules we actually need via createRequire.
const _require = createRequire(import.meta.url);
const _stopwordsModule = _require("natural/lib/natural/util/stopwords") as { words: string[] };
const TfIdf = _require("natural/lib/natural/tfidf/tfidf") as new () => {
  addDocument(doc: string | string[]): void;
  listTerms(docIndex: number): Array<{ term: string; tfidf: number }>;
};

const STOP_SET = new Set<string>(_stopwordsModule.words);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourceMatch {
  sourceUrl: string;
  sourceTitle: string;
  sourceType: "web" | "journal" | "student_submission";
  matchedText: string;
  originalText: string;
  matchScore: number;
  startIndex: number;
  endIndex: number;
}

export interface PlagiarismResult {
  overallScore: number; // 0.0 to 1.0
  matches: SourceMatch[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHUNK_WORD_SIZE = 200;
const MAX_CHUNKS = 10; // cap API calls for very long documents
const MATCH_THRESHOLD = 0.15;
const NUM_HASHES = 100;

// Pre-generated MinHash coefficients — fixed seeds for determinism.
const MINHASH_COEFFS: [number, number][] = Array.from({ length: NUM_HASHES }, (_, i) => [
  ((i + 1) * 0x9e3779b9) >>> 0,
  ((i + 1) * 0x517cc1b7) >>> 0,
]);

// ─── Step 1: Preprocessing ───────────────────────────────────────────────────

export function preprocessText(text: string): string[] {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  return lower
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_SET.has(t));
}

// ─── Step 2: Shingling ───────────────────────────────────────────────────────

export function generateShingles(tokens: string[], k = 5): Set<string> {
  const shingles = new Set<string>();
  for (let i = 0; i <= tokens.length - k; i++) {
    shingles.add(tokens.slice(i, i + k).join(" "));
  }
  return shingles;
}

// ─── Step 3: MinHash Signature ───────────────────────────────────────────────

function polyHash(str: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0;
}

export function minHashSignature(shingles: Set<string>, numHashes = NUM_HASHES): number[] {
  const sig = new Array<number>(numHashes).fill(0xffffffff);
  for (const shingle of shingles) {
    const base = polyHash(shingle);
    for (let i = 0; i < numHashes; i++) {
      const [a, b] = MINHASH_COEFFS[i]!;
      const h = (Math.imul(a, base) + b) >>> 0;
      if (h < sig[i]!) sig[i] = h;
    }
  }
  return sig;
}

// ─── Step 4: Jaccard Similarity (via MinHash) ────────────────────────────────

export function jaccardSimilarity(sig1: number[], sig2: number[]): number {
  if (sig1.length === 0 || sig1.length !== sig2.length) return 0;
  let matches = 0;
  for (let i = 0; i < sig1.length; i++) {
    if (sig1[i] === sig2[i]) matches++;
  }
  return matches / sig1.length;
}

// ─── Step 5: TF-IDF Cosine Similarity ───────────────────────────────────────

export function cosineSimilarity(text1: string, text2: string): number {
  if (!text1.trim() || !text2.trim()) return 0;

  const tfidf = new TfIdf();
  tfidf.addDocument(text1);
  tfidf.addDocument(text2);

  const vec1 = new Map<string, number>();
  const vec2 = new Map<string, number>();

  for (const { term, tfidf: score } of tfidf.listTerms(0)) vec1.set(term, score);
  for (const { term, tfidf: score } of tfidf.listTerms(1)) vec2.set(term, score);

  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const [term, s1] of vec1) {
    dot += s1 * (vec2.get(term) ?? 0);
    norm1 += s1 * s1;
  }
  for (const [, s2] of vec2) norm2 += s2 * s2;

  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ─── Search Query Extraction ─────────────────────────────────────────────────

const QUERY_STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "shall","can","that","this","these","those","it","its","as","up","about",
  "into","than","then","so","if","when","where","which","who",
]);

function extractSearchQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !QUERY_STOPWORDS.has(w))
    .slice(0, 10)
    .join(" ")
    .substring(0, 100);
}

function extractThreeQueries(chunk: string): [string, string, string] {
  const sentences = chunk.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);

  const first = sentences[0] ?? chunk;
  const middle = sentences[Math.floor(sentences.length / 2)] ?? chunk;
  // "most unique" phrase: words sorted by length descending
  const byLength = chunk
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 5 && !QUERY_STOPWORDS.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10)
    .join(" ")
    .substring(0, 100);

  return [
    extractSearchQuery(first),
    extractSearchQuery(middle),
    byLength || extractSearchQuery(chunk),
  ];
}

// ─── Academic API Queries ────────────────────────────────────────────────────

async function queryAllApis(chunk: string): Promise<SearchResult[]> {
  const [q1, q2, q3] = extractThreeQueries(chunk);
  const queries = [...new Set([q1, q2, q3].filter(Boolean))];

  const resultSets = await Promise.allSettled(
    queries.flatMap((q) => [
      searchCrossRef(q),
      searchSemanticScholar(q),
      searchOpenAlex(q),
    ])
  );

  const seen = new Set<string>();
  const combined: SearchResult[] = [];
  for (const r of resultSets) {
    if (r.status === "fulfilled") {
      for (const item of r.value) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          combined.push(item);
        }
      }
    }
  }
  return combined;
}

// ─── Google Custom Search Fallback ───────────────────────────────────────────

interface GoogleSearchItem {
  link?: string;
  title?: string;
  snippet?: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
}

async function searchGoogle(sentence: string): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!key || !cx) return [];

  const encoded = encodeURIComponent(sentence.substring(0, 128));
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encoded}&num=5`;

  let data: GoogleSearchResponse;
  try {
    data = (await fetchJson(url)) as GoogleSearchResponse;
  } catch {
    return [];
  }

  return (data?.items ?? []).flatMap((item): SearchResult[] => {
    if (!item.link) return [];
    return [
      {
        url: item.link,
        title: item.title ?? item.link,
        abstract: item.snippet ?? "",
        sourceType: "web",
      },
    ];
  });
}

async function googleFallback(
  submissionText: string,
  seenUrls: Set<string>
): Promise<SourceMatch[]> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  if (!key) return [];

  const sentences = submissionText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 15);

  const matches: SourceMatch[] = [];

  for (const sentence of sentences.slice(0, 5)) {
    const results = await searchGoogle(sentence);
    for (const result of results) {
      if (!result.url || seenUrls.has(result.url) || !result.abstract) continue;
      const score = cosineSimilarity(sentence, result.abstract);
      if (score >= MATCH_THRESHOLD) {
        seenUrls.add(result.url);
        const startIndex = submissionText.indexOf(sentence);
        matches.push({
          sourceUrl: result.url,
          sourceTitle: result.title,
          sourceType: "web",
          matchedText: sentence.substring(0, 500),
          originalText: result.abstract.substring(0, 500),
          matchScore: score,
          startIndex: startIndex >= 0 ? startIndex : 0,
          endIndex: startIndex >= 0 ? startIndex + sentence.length : sentence.length,
        });
      }
    }
  }

  return matches;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function detectPlagiarism(submissionText: string): Promise<PlagiarismResult> {
  const totalChars = submissionText.length;
  if (totalChars === 0) return { overallScore: 0, matches: [] };

  // Split into 200-word chunks, capped at MAX_CHUNKS
  const words = submissionText.split(/\s+/);
  const chunks: Array<{ text: string; startIndex: number; endIndex: number }> = [];

  let charOffset = 0;
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_WORD_SIZE) {
    const slice = words.slice(i, i + CHUNK_WORD_SIZE);
    const chunkText = slice.join(" ");
    chunks.push({
      text: chunkText,
      startIndex: charOffset,
      endIndex: charOffset + chunkText.length,
    });
    charOffset += chunkText.length + 1; // +1 for the whitespace separator
  }

  const seenUrls = new Set<string>();
  const matches: SourceMatch[] = [];

  for (const chunk of chunks) {
    const candidates = await queryAllApis(chunk.text);

    for (const candidate of candidates) {
      if (!candidate.url || seenUrls.has(candidate.url)) continue;

      const score = cosineSimilarity(chunk.text, candidate.abstract);
      if (score >= MATCH_THRESHOLD) {
        seenUrls.add(candidate.url);
        matches.push({
          sourceUrl: candidate.url,
          sourceTitle: candidate.title,
          sourceType: candidate.sourceType,
          matchedText: chunk.text.substring(0, 500),
          originalText: candidate.abstract.substring(0, 500),
          matchScore: score,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        });
      }
    }
  }

  // Step 5: Google Custom Search fallback for sentences over 15 words
  const googleMatches = await googleFallback(submissionText, seenUrls);
  matches.push(...googleMatches);

  // Overall score: total matched characters / total characters, capped at 1.0
  const matchedChars = matches.reduce((sum, m) => sum + (m.endIndex - m.startIndex), 0);
  const overallScore = Math.min(1.0, matchedChars / totalChars);

  matches.sort((a, b) => b.matchScore - a.matchScore);

  return { overallScore, matches };
}
