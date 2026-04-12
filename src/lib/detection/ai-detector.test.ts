import { detectAiContent } from './ai-detector';

// ---------------------------------------------------------------------------
// Test text fixtures
// ---------------------------------------------------------------------------

// Dense AI-typical text: em-dash, AI phrases, no contractions, formal structure
const AI_TEXT =
  'It is worth noting that the comprehensive analysis demonstrates multifaceted outcomes \u2014 furthermore, this underscores the crucial role of innovation. Moreover, it is essential to consider the significant implications. In addition, one must consider the broader context in light of these findings. It is important to highlight that this plays a key role in the realm of academic discourse.';

// Human text: contractions, first-person, questions, irregular sentence lengths, one em-dash
const HUMAN_TEXT =
  "I honestly wasn't sure what to make of it at first. Why does this even matter? The data's messy \u2014 wait, I'm using a regular dash there. Can't really tell from just looking. My supervisor said don't overthink it. So I didn't.";

// Short text: well under 100 words
const SHORT_TEXT =
  'Climate change is reshaping ecosystems across the globe. Rising temperatures affect rainfall patterns and biodiversity. Immediate policy action is required.';

// Em-dash heavy: 6 em-dashes + multiple AI phrases, no contractions
const EM_DASH_TEXT =
  'Furthermore \u2014 it is essential to note \u2014 through comprehensive analysis \u2014 that multifaceted outcomes consistently emerge \u2014 as this underscores the crucial role of innovation. Moreover \u2014 it is important to highlight \u2014 this plays a key role in the realm of academic discourse.';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectAiContent', () => {
  it('Test 1: obvious AI text returns overallScore > 0.55', async () => {
    const result = await detectAiContent(AI_TEXT);
    expect(result.overallScore).toBeGreaterThan(0.55);
    expect(Array.isArray(result.sentenceScores)).toBe(true);
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('Test 2: obvious human text returns overallScore < 0.40', async () => {
    const result = await detectAiContent(HUMAN_TEXT);
    expect(result.overallScore).toBeLessThan(0.40);
    expect(Array.isArray(result.sentenceScores)).toBe(true);
  });

  it('Test 3: short text (under 100 words) returns confidence LOW', async () => {
    const result = await detectAiContent(SHORT_TEXT);
    expect(result.confidence).toBe('LOW');
  });

  it('Test 4: em-dash-heavy text returns overallScore > 0.5', async () => {
    const result = await detectAiContent(EM_DASH_TEXT);
    expect(result.overallScore).toBeGreaterThan(0.5);
  });
});
