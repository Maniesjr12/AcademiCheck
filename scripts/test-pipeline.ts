/**
 * Pipeline smoke test — run with: npx tsx scripts/test-pipeline.ts
 *
 * Tests all three detection engines in sequence without the queue.
 * Requires ANTHROPIC_API_KEY to be set in .env for AI detection.
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from project root before importing any module that reads env vars
const __dirname =
  typeof import.meta.dirname !== "undefined"
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import { extractText } from "../src/lib/detection/text-extractor.js";
import { detectPlagiarism } from "../src/lib/detection/plagiarism-engine.js";
import { detectAiContent } from "../src/lib/detection/ai-detector.js";

// ─── Test corpus ──────────────────────────────────────────────────────────────

const TEST_TEXT = `The first time the sky forgot its color, nobody noticed.

It happened quietly—like most important things do. One moment, the sky above Lagos was its usual hazy blue, streaked with sunburnt clouds. The next, it became… something else. Not gray, not white, not even black. Just *absent*, as if someone had erased it and left a blank space behind.

People still went to work. Buses still honked. Traders still argued over prices. The world doesn’t stop just because something impossible happens.

Except for Tunde.

Tunde was a mechanic in a narrow street off Oshodi, the kind of place where engines never really slept. He noticed it because he always looked up. It was a habit he picked up as a kid, back when his father told him the sky could tell stories—if you paid attention.

So when he looked up that morning and saw nothing… he froze.

Not darkness. Not light. Just a strange, endless emptiness that made his chest feel hollow.

“Guy, you dey okay?” his apprentice asked, wiping grease on his shorts.

Tunde didn’t answer. He just pointed.

The boy squinted, frowned, then shrugged. “Na normal sky.”

Tunde felt something cold settle in his stomach.

---

By evening, things got worse.

Shadows stopped behaving properly. They stretched in the wrong directions, or didn’t appear at all. Birds flew up—and didn’t come back down. A plane passed overhead, but there was no sound, no trail, no proof it had ever been there except for the memory of seeing it.

Still, most people ignored it.

Except Tunde.

That night, he couldn’t sleep. He sat outside his room, staring upward into that impossible emptiness. The air felt thinner, like the world itself was holding its breath.

Then he heard it.

A voice—not loud, not soft. Not even exactly a sound. It was more like a thought that wasn’t his.

*“You noticed.”*

Tunde stood up slowly. “Who’s there?”

Silence.

Then—

*“You are not supposed to notice.”*

His throat went dry. “Notice what?”

The sky.

Or whatever had replaced it.

It shifted. Not visually—but *wrongly*. Like something behind reality moved, just out of reach of human perception.

*“The layer is failing.”*

Tunde didn’t understand, but somehow, he felt the meaning more than he heard the words.

“The layer?” he whispered.

*“The thing that makes your world… believable.”*

---

Over the next few days, reality began to unravel.

Clocks skipped seconds. Roads stretched longer than they should. People forgot conversations mid-sentence and continued like nothing happened.

And the sky… the sky grew thinner.

One evening, Tunde saw it clearly.

Behind the emptiness, there was structure—vast, mechanical, and impossibly complex. Like a giant machine pressing against the surface of the world, trying to break through.

And something inside it was watching.

*“It is not your fault,”* the voice returned.

Tunde clenched his fists. “Then fix it.”

*“We cannot.”*

“Why?”

A pause.

*“Because you were never meant to be aware. Awareness breaks the system.”*

Tunde laughed, but it came out shaky. “So what—because I looked up, the world is ending?”

*“Not ending. Resetting.”*

The word hit harder than anything else.

“Reset?”

*“Everything will return to before the error.”*

Tunde’s chest tightened. “And me?”

Silence.

Then—

*“You will not remember.”*

---

The next morning, the sky was blue again.

Perfect. Clear. Normal.

People went to work. Buses honked. Traders argued.

And Tunde?

Tunde was under a car, tightening a bolt, humming to himself.

He paused for a second, frowning slightly, as if he had forgotten something important.

Then he shook his head and continued working.

Above him, the sky stretched endlessly—beautiful, ordinary, and carefully repaired.

But far beyond it, hidden behind layers no human eye was meant to see…

Something was still watching.

And this time—

It was paying closer attention.
`;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function hr(char = "─", width = 60) {
  return char.repeat(width);
}

function heading(title: string) {
  console.log(`\n${hr()}`);
  console.log(` ${title}`);
  console.log(hr());
}

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

// ─── Step 1: Text extraction ──────────────────────────────────────────────────

async function testExtraction(): Promise<string> {
  heading("STEP 1 — Text Extraction");

  const result = await extractText({ text: TEST_TEXT });

  console.log(`Input characters  : ${TEST_TEXT.length}`);
  console.log(`Output characters : ${result.length}`);
  console.log(`Preview           : "${result.substring(0, 80)}…"`);

  if (!result || result.trim().length === 0) {
    throw new Error("extractText returned empty string");
  }

  console.log("\n✓ Extraction OK");
  return result;
}

// ─── Step 2: Plagiarism detection ─────────────────────────────────────────────

async function testPlagiarism(text: string) {
  heading("STEP 2 — Plagiarism Detection");
  console.log("Querying CrossRef, Semantic Scholar, and OpenAlex…\n");

  const result = await detectPlagiarism(text);

  console.log(`Overall similarity score : ${pct(result.overallScore)}`);
  console.log(`Sources found            : ${result.matches.length}`);

  if (result.matches.length === 0) {
    console.log("\n  (No matches above 0.25 cosine threshold)");
  } else {
    console.log();
    result.matches.forEach((m, i) => {
      console.log(
        `  ${i + 1}. [${pct(m.matchScore)} match] ${
          m.sourceTitle ?? "Untitled"
        }`
      );
      console.log(`     Type : ${m.sourceType}`);
      console.log(`     URL  : ${m.sourceUrl}`);
      console.log(`     Text : "${m.matchedText.substring(0, 100)}…"`);
      console.log();
    });
  }

  console.log("✓ Plagiarism detection OK");
  return result;
}

// ─── Step 3: AI content detection ────────────────────────────────────────────

async function testAiDetection(text: string) {
  heading("STEP 3 — AI Content Detection");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠  ANTHROPIC_API_KEY not set — skipping AI detection");
    console.log("   Set it in .env to enable this step.");
    return null;
  }

  console.log("Scoring sentences via Claude API…\n");

  const result = await detectAiContent(text);

  console.log(`Overall AI score  : ${pct(result.overallScore)}`);
  console.log(`Confidence        : ${result.confidence}`);
  console.log(`Sentences scored  : ${result.sentenceScores.length}`);
  console.log(
    `AI-flagged        : ${result.sentenceScores.filter((s) => s.isAi).length}`
  );

  if (result.signals.length > 0) {
    console.log("\nSignals:");
    result.signals.forEach((s) => console.log(`  • ${s}`));
  }

  if (result.sentenceScores.length > 0) {
    console.log("\nTop sentences by AI score:");
    const top = [...result.sentenceScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    top.forEach((s) => {
      const flag = s.isAi ? "[AI]" : "    ";
      console.log(
        `  ${flag} ${pct(s.score)}  "${s.sentence.substring(0, 80)}…"`
      );
    });
  }

  console.log("\n✓ AI detection OK");
  return result;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║          AcademiCheck — Detection Pipeline Test          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\nTest text: ${TEST_TEXT.substring(0, 80)}…`);
  console.log(`Words: ${TEST_TEXT.split(/\s+/).length}`);

  let failed = false;

  const text = await testExtraction().catch((err: unknown) => {
    console.error("\n✗ Extraction failed:", err);
    failed = true;
    return TEST_TEXT; // fall back to raw text so later steps can still run
  });

  await testPlagiarism(text).catch((err: unknown) => {
    console.error("\n✗ Plagiarism detection failed:", err);
    failed = true;
  });

  await testAiDetection(text).catch((err: unknown) => {
    console.error("\n✗ AI detection failed:", err);
    failed = true;
  });

  heading("SUMMARY");
  if (failed) {
    console.log("⚠  One or more steps encountered errors (see above).");
    process.exit(1);
  } else {
    console.log("✓  All steps completed successfully.");
  }
  console.log();
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
