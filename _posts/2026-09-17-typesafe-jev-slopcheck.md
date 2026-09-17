---
title: "Code Enumerates, Jev Judges: Building slopcheck on a Model That Never Writes a Word"
date: 2026-09-17
categories: [Technology, AI, How-To]
tags: [ai, typesafe, jev, code-review, agents, ci, how-to]
author: TJ
image: /assets/img/slopcheck-jev.png
---

I built a CI tool this week that reads every pull request and says whether it is AI slop. It flags speculative abstractions, tests that only assert on mocks, swallowed errors, reinvented library code, narrating comments, and scope creep against the stated goal. It points at the exact lines. It runs in under a second per change. Building it, including every debug run, every fixture pass, and every time I re-ran the whole suite to chase a threshold, cost ninety-one cents.

The interesting part is not the tool. It is that the model behind it never generated a single sentence. slopcheck runs on Jev, TypeSafe AI's "System One" model, and Jev does not write text. You hand it a block of state and a set of typed questions, and it returns probabilities. That constraint turned out to be the most productive thing about the whole project, and it changed how I think about where AI belongs in software.

## A Model That Won't Talk Back

TypeSafe announced Jev on September 15. Their framing borrows Kahneman: LLMs are System Two, slow and deliberate, generating a reply one token at a time. Jev is System One, the fast intuitive judgment. Their founder, Diogo Almeida, who co-invented RLHF at OpenAI, calls it "a frontier-intelligence function call: unstructured state in, typed probabilistic decisions out."

There are exactly three things you can ask it:

- **Noul**: a yes/no question. Returns the probability the answer is yes.
- **Choice**: pick one of a defined set of options. Returns the pick, the full distribution, and a confidence.
- **Score**: place the input on an ordered rubric you write. Returns a probability-weighted position on the levels and a confidence.

That is the whole API. One endpoint, one request shape: a `state` (string or JSON), a `model`, and a map of `questions`. Every question is answered in parallel over the same state, in the same pass. There is nothing to parse. The model cannot return a type it was not asked for, cannot add a fourth option, and cannot pad its answer with an explanation. TypeSafe calls that "0% hallucination" and, to their credit, admits the number is definitional rather than empirical: schema matching is guaranteed, correctness is not.

The numbers that matter for a builder:

| | Jev (published) |
|---|---|
| Input tokens | $0.042 per million |
| Output tokens | free |
| End-to-end latency | 70 to 500 ms |
| Context | 64k tokens for state plus questions |

The launch demo was Jev playing Doom from structured game state at ten decisions a second. The Register clocked one of those decisions at 0.114 seconds against 8.566 seconds for GPT-5.6 Terra on the same input. Whether or not you care about Doom, that gap is the reason a new class of applications exists.

## Why the Constraint Is the Feature

Every LLM-based code reviewer I have used or built has the same shape: paste the diff into a prompt, ask for a review, parse whatever comes back. The output is prose. Sometimes it is JSON that is mostly right. You cannot tell how sure the model was about any individual claim. You cannot set a threshold. You cannot show the reviewer a number and say "this is what the model read for this line." You also cannot easily ask forty questions about the same diff without forty times the cost and a very long wait.

TypeSafe's building guide puts the alternative in one line: "Code handles deterministic work and owns the control flow." The model does not run the review. Code runs the review. The model answers narrow, literal questions inside it, and every answer is a number code can compare, threshold, sort, and print. Their docs call these "smart if-statements," which undersells it. What you get is programmable common sense: a primitive you can compose the same way you compose any other function.

The cost structure reinforces the design. Since output is free and a whole batch of questions runs in one pass, the incentive is to ask a lot. TypeSafe's parallel-questions cookbook batches thirteen regulatory questions against a 54,000-character document in one call and measures it at 12.2x cheaper and 10x faster than thirteen separate calls, with identical answers. Their fan-out pattern goes further: ask speculative questions you might not need and let code ignore the irrelevant ones, because "adding more questions to a call typically doesn't add any latency to the response."

slopcheck asks several hundred questions per change. In one request.

## What We Built

slopcheck takes a diff (working tree, staged, a branch since its base, a patch file, or a GitHub PR by number) and produces a verdict: MERGE READY, POLISH THEN MERGE, NEEDS REWORK, or NEEDS A HUMAN, with an exit code CI can gate on. It has one runtime dependency, the jsdiff parser. Everything else is the question builder, the candidate enumerator, and the composition logic.

The division of labor is strict. Code parses the patch, tags every line with its new-file number, enumerates candidate lines by syntax, builds the questions, and composes the answers into a verdict. Jev does every piece of judging. There is no regex anywhere in the project that decides something is slop.

### One literal question per pattern

Each of the eighteen patterns is a concept with a title, a meaning, a fix, and one Noul question over the whole diff. The `criteria` field spells out the boundary, including the exclusions that separate lazy code from careful code. Here is the one for speculative abstraction, straight from the source:

```typescript
speculative_abstraction: {
  title: "Speculative abstraction",
  meaning: "An interface, factory, strategy, or wrapper with one implementation and no second caller in the diff.",
  fix: "Call the concrete code directly; add the layer when a second caller exists.",
  blocking: true,
  ask: "Does this diff add an abstraction (an interface, abstract base class, factory, strategy, registry, or wrapper) that has only one implementation and no second caller anywhere in the diff?",
  criteria: {
    true: "A new type or layer exists for a caller the diff does not contain; deleting it would leave the code shorter and just as correct.",
    false: "No abstraction was added, or every added type has a second implementation or a second caller in the diff. Validation at trust boundaries and error handling are not abstractions.",
  },
  locate: { classes: ["class"], /* per-line questions below */ },
},
```

Two of the concepts are Scores instead of Nouls. Ceremony runs 0 to 4 from "direct and minimal" to "framework syndrome," and each level is a full sentence describing a concrete situation, because Jev reads the rubric literally. Wordiness does the same for padding.

### Code finds the lines, Jev judges them

A whole-diff yes is not enough. A reviewer needs `billing/formatters.py:26`. This is where two TypeSafe cookbooks did most of my design work for me.

The line-by-line search cookbook splits GitHub's Terms of Service into 218 clauses, tags each with an ID like `L052`, sends the tagged document once, and asks two questions in the same pass: a Choice over the line IDs for "where is the answer," and an independent Noul for "does the document contain an answer at all." The Noul exists because "Choice question probabilities always add up to 1, so a line ranks first even when none answer the query." The pre-parsed value extraction cookbook adds the other half of the idea: have a regex over-find candidate spans, then have the model select among them, so it "cannot invent a value or transpose a digit."

slopcheck does the same thing to a diff. Every line goes to Jev prefixed with its new-file line number, so "line 42" in a question is a lookup rather than a count (counting is one of Jev's documented weak spots). Code then enumerates candidates by syntax class: every added class, function, test, comment, import, error handler, cast, config read, loop, debug call, and every removed assertion. These regexes recognize syntax, not slop. For each candidate, each concept that locates on that class asks one Noul:

```typescript
locate: {
  classes: ["test"],
  ask: "Consider the test defined at {file} line {line} (`{code}`) and its whole body. Do its asserted values come solely from a mock's or stub's configured return value or side effect, with no production computation contributing to them?",
},
```

I went with a Noul per candidate instead of a Choice over candidates because a pattern can live on many lines at once, and the strongest one should decide. The builder is short enough to show whole:

```typescript
export function buildQuestions(job: Job, overrides?: ConceptOverrides): Record<string, Question> {
  const q: Record<string, Question> = {};
  for (const [id, c] of Object.entries(CONCEPTS)) {
    if (skipReason(id, c, job, overrides?.[id])) continue;
    q[`${id}__file`] = c.isScore
      ? { type: "score", instructions: c.ask, criteria: c.levels! }
      : { type: "noul", instructions: c.ask, ...(c.criteria && { criteria: c.criteria }) };
    for (const cand of candidatesFor(c, job))
      locateAsks(c).forEach((a, k) => {
        q[lineKey(id, cand, k)] = { type: "noul", instructions: fill(a.ask, cand), ...(a.criteria && { criteria: a.criteria }) };
      });
  }
  return q;
}
```

The whole map goes out as one POST with the tagged diff as state. For the shipped slop fixture that is 9,629 input tokens and 0.7 seconds round trip.

### Composition is code, and it fails closed

Answers come back as a flat map of numbers. Everything after that is plain TypeScript with thresholds you can read:

- A concept with lines is **found** when its strongest line reads at or above 0.85. Lines from 0.70 are listed as evidence with their readings.
- Readings between 0.60 and 0.85 are **close calls**, printed with their strongest line, never a verdict.
- If Jev reads 0.85 or higher for the whole diff but code enumerated no candidate line of the right kind, that is a **coverage gap**: a hole in my enumerator, not a pass. The file goes to a human with that reason.
- Polish-class concepts (narrating comments, leftovers, generic names) never block. Blocking ones do. The file verdict is the worst finding a line of that file decided; the change verdict is the worst file.

One detail I like: speculative abstraction asks two literal questions per class (is this an abstraction; does the diff give it a second implementation or caller) and combines them in code as `min(p, 1 - q)`. Jev's jaggedness page warns that compound and negated questions lose accuracy. So don't ask compound questions. Ask two simple ones and do the logic yourself.

### What the report looks like

Here is the shipped fixture, a "format_date helper" that arrived as a strategy pattern with a factory and a registry. Trimmed to one file:

```
── billing/formatters.py ────────────────────────────────────  NEEDS REWORK

  ✖ Speculative abstraction                              found on 4 lines
    An interface, factory, strategy, or wrapper with one implementation and no second caller in the diff.
      billing/formatters.py:5    class FormatterStrategy(abc.ABC):                 0.85
      billing/formatters.py:14   class DateFormatterStrategy(FormatterStrategy):   0.88
      billing/formatters.py:26   class DateFormatterFactory:                       0.94
      billing/formatters.py:34   class FormatterRegistry:                          0.92
    Fix  Call the concrete code directly; add the layer when a second caller exists.
    Jev  whole diff 0.92 · strongest line 0.94 · line ≥ 0.85 · speculative_abstraction

  • Narrating comments                          found on 6 lines · polish
    Comments that restate the adjacent line instead of saying why.
      billing/formatters.py:22   # Call strftime on the value to produce the formatted string   0.87
      billing/formatters.py:38   # Initialize the internal storage dictionary                   0.89
      billing/formatters.py:42   # Register the formatter for the kind                          0.90
    Fix  Delete the comment, or replace it with the constraint or tradeoff it should explain.

  Also checked: 12 more patterns, nothing found (whole-diff reading · strongest line)
    ◦ Leftovers        0.78 · 0.60   close: strongest line billing/formatters.py:41 at 0.60
    Dead config        0.07 · 0.05       Reinvented wheel   0.27 · 0.46
    Swallowed errors   0.02 · –          Symptom patch      0.03 · –
```

Every number on that page is Jev's reading. Nothing is hidden behind a summary. If a line reads 0.83 and misses the bar, you see the 0.83 and you see why. A `--json` flag carries the same thing plus the arithmetic per finding, so an agent hook can feed it back to the author before a human ever looks.

## What Building on It Taught Me

**Literal means literal.** Jev "answers the question you wrote, not the one you meant." My first symptom-patch question asked whether the diff fixes "only the one call site the report names." On a blatant two-call-site symptom patch it read 0.06. Rephrased as "does this diff work around a defect at the places that call a function instead of fixing the function that produces the defect," the same fixture read 0.84 and 0.95 on the two slop cases and 0.09 on both clean bug fixes. Same model, same diff. The question was the bug.

**Field order is signal.** With the goal placed after a kilobyte of diff, a goal-dependent question read 0.33. With `goal` as the first field in the state, 0.93. Stable across repeats. The state JSON is not a bag; it is a document the model reads top to bottom.

**Measure noise before you re-ask.** Over three runs on the fixtures, readings moved by at most 0.05 and scores by 0.07, with identical verdicts. That is small enough that a reworded question is a different question rather than a repeat measurement, so slopcheck asks each thing once. It also means a line at 0.85 will sometimes read 0.83 on the next run. The report shows every reading so you can see when that happened.

**Coverage gaps beat quiet misses.** An early version could be sure a pattern existed and still print nothing because my regex did not enumerate the right line. Now that condition is a named status that sends the file to a human. Fail closed is the only sane default when the model is confident and the code is not.

**It reviewed itself and was right.** slopcheck flagged its own hand-written `unquote` (git's C-style path quoting) and `globToRegExp` as reinvented wheels, reading 0.84 to 0.88 across runs. Both were. jsdiff 9 already handles quoted paths and git's extended headers, and Node has had a stable glob matcher since 22.20. Both hand-rolled versions are gone and the Node floor moved up.

**It is nearly free.** The whole build, from the first commit through every debug session, fixture regeneration, adversarial pre-release review, and CI run:

| Total across the build | |
|---|---|
| Tokens | 25,781,308 |
| Requests | 2,479 |
| Spend | $0.91 |

A 30-file, 2,100-line change on this repo was three requests and about 130k input tokens. Derived: 130,000 × $0.042 / 1,000,000 = $0.0055, about half a cent. At that price you stop asking whether to run it and start asking how many more questions to add.

## Beyond Code Review: Goal Loops and Browser Agents

The pattern in slopcheck is not specific to diffs. It is: code holds the goal and the state, enumerates the legal moves, asks the model to judge them, and acts on the answer. Run that in a loop and you have an agent, without a single generated token in the control path.

**Browser agents.** Browser Use has already shipped `jev-ultrafast`, a minimal MIT-licensed agent built around Jev. Each cycle it indexes the live DOM into a numbered table of interactive elements, then asks Jev two Choice questions in one request: which operation (CLICK, TYPE_TEXT, SELECT, SCROLL, WAIT, with DONE and BLOCKED always on the menu) and which element. "Two decisions, one network round trip." No screenshots in the policy loop, nothing fine-tuned. A small LLM writes text only when the operation is TYPE_TEXT. Their Google Flights search runs in 7,073 ms for $0.0039, with browser protocol calls down from 1,092 to 101 versus their prior approach. The design is the same as the pre-parsed extraction cookbook: enumerate the valid targets from what is actually on the page, and the model can only pick one of them. "Model output never becomes selectors, coordinates, or executable JavaScript."

**Goal-directed loops in general.** Notice what the goal is doing in that browser agent: it is a constant field in the state, exactly like `goal` in slopcheck's request. The agent does not ask the model to remember the goal or plan the next five steps. Code keeps the goal, code keeps the observation history, and each turn is a fresh bounded judgment: given this goal and this state, which move. DONE and BLOCKED as always-offered options mean the model can say "stop," and confidence lets code decide when to escalate to a person or a reasoning model instead of acting. TypeSafe's autoresearch cookbook runs the same loop shape in a different domain: each round, a reasoning model proposes new questions, Jev answers them across 1,200 rows, a gradient-boosted model refits, and code keeps only the questions that lowered cross-validated error.

**Real-time and interactive UI.** At 70 to 500 ms a judgment fits inside a UI interaction. TypeSafe's smart home demo is a React app that fans out "what kind of request, which domain, which devices, which action" in one call and falls back to an LLM only for the conversational cases. The Doom bot is the extreme version. The Wikiracing demo shows Choice at high cardinality: picking one of up to 255 links to reach a target page.

**Verification and guardrails.** The same primitives check other models' work: does this citation appear in the source, does this extraction match the document, does this tool call violate policy. That is where I expect the volume to go. Every agent step that today burns a frontier-model call to decide "is this okay to proceed" is a Noul.

## Where It Falls Down

TypeSafe publishes a jaggedness page for Jev 1.13 and it is worth reading before you design anything:

- **Counting and arithmetic are unreliable.** Tag your lines; do not ask it to count them.
- **Dates read as text**, not ordered quantities. Compare them in code.
- **Indirection hurts.** Double negatives and "property of a property" questions lose accuracy. Split them.
- **Large irrelevant state is a distractor.** Filter before you send.
- **State is not treated as hostile.** Injected instructions in the content can move the answer. If you are judging untrusted input, write explicit criteria and test adversarially.
- **64k tokens** of state plus questions is the ceiling. slopcheck splits a refused change by file, then by hunk, and merges per pattern.

Two broader caveats. A probability is not an explanation, and in a regulated setting "the model read 0.91" may not satisfy an auditor asking why. And TypeSafe is a $40 million startup two days into public availability, hosted in one region, with rate limits their own docs say "can change without notice." I would not put it in a production path today without a fallback. For a CI gate that fails closed and costs a penny, that is a fine trade.

## The Point

For two years the default move for putting AI into software has been: write a prompt, get text, parse the text, hope. Jev removes the text. What is left is a function that takes state and returns numbers, and numbers are something code has always known what to do with.

slopcheck is under 1,900 lines of TypeScript, report formatting included. The model does all the judging and none of the deciding. Every threshold is in a config file. Every reading is on the page. It cost less than a cup of coffee to build and it caught two real problems in its own code before I did. I am going to be building a lot more this way.

Sources: [TypeSafe docs](https://docs.typesafe.ai), [Introducing System One Models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [The Register on the Doom demo](https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711), [InfoWorld](https://www.infoworld.com/article/4223468/typesafe-ais-new-models-work-with-machines-not-humans.html), [Browser Use jev-ultrafast](https://github.com/browser-use/jev-ultrafast), [line-by-line search cookbook](https://docs.typesafe.ai/cookbooks/semantic_find), [pre-parsed value extraction cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
