---
title: 1,500 Regression Tests in Three Days. Here's the Part That Actually Mattered.
date: 2026-07-17
categories: [Technology, AI, Operations]
tags: [ai, claude-code, testing, agents, strategy]
author: TJ
image: /assets/img/fifteen-hundred-tests.png
---

A company has twenty years of code spread across fifty-plus repositories, and not one regression test that runs. There are tests in there somewhere. Dead Selenium suites nobody has executed since 2017. A `__tests__` folder someone built with real care in 2014 and abandoned when they left. Every release is a bet that nothing in two decades of accumulated behavior just silently broke.

Last month I fixed that with Claude Code. Three days of work. 1,500 regression tests, all passing, running in under half an hour. Within the first week the suite blocked a release that would have shipped a breaking change to customers.

The headline number is 1,500 tests. But the tests were the last step, and honestly the easiest one. If I had opened a session and typed "write regression tests for this platform," I would have gotten 1,500 pieces of plausible-looking garbage. The work that mattered happened before a single test was written: giving the agent a map of the platform. Speed came from context, not generation.

Here's how it actually went.

## The Session Lives Above the Repos

The first decision was the least glamorous and the most important: where to start the session.

The instinct is to open Claude Code inside a repo, because that's where code lives. But regressions on a twenty-year-old platform don't live inside repos. They live between them. The orders service emits a payload the billing service parses. The admin app reads a config format three other systems write. The bugs that hurt you in production are almost never "this function broke" — they're "this repo changed something that repo depended on, and nobody knew the dependency existed."

So I cloned all fifty-plus repositories under a single parent folder and started the session there. Not in any repo. Above all of them. The unit of understanding isn't the repository. It's the platform. From that vantage point, the agent could trace a request from the UI through the API gateway into three backend services and out to a queue consumer — across five repos — the same way it would trace a call stack through a single file.

That one folder decision shaped everything that followed. Every workflow, every document, every test was written by an agent that could see the whole system at once.

## Farming Twenty Years of Context

Fifty repos and twenty years of history is far more than any single context window can hold. This is exactly what dynamic workflows are for: fan out a fleet of subagents, each with its own fresh context, each assigned a slice of the platform, each reporting back structured findings.

I pointed Fable at the parent folder and had it orchestrate a sweep. One agent per repo, digging through commit history, dead test directories, abandoned CI configs, and stale README files, and answering a specific set of questions: What did this repo once test? Why was the testing abandoned? What behavior was someone trying to protect?

The orchestration script, condensed:

```javascript
export const meta = {
  name: 'farm-platform-context',
  description: 'Sweep every repo for test history and domain knowledge',
  phases: [{ title: 'Sweep' }],
}
const findings = await pipeline(
  args.repos,
  repo => agent(
    `In ${repo}: find abandoned test suites, dead test directories, and
     test-related commits. For each, report what behavior it asserted,
     when and why it was abandoned, and what it was protecting against.`,
    { phase: 'Sweep', schema: FINDINGS_SCHEMA },
  ),
)
return findings.filter(Boolean)
```

The abandoned tests turned out to be the richest seam in the whole excavation. A dead test is a fossil. Somebody, at some point, cared enough about a behavior to write an assertion for it. The Jasmine suite from 2015 that nobody could run anymore still encoded what the checkout flow was supposed to do. The Selenium scripts rotting in a `qa/` folder were a catalog of the UI paths that once mattered enough to automate. Twenty years of engineers had already told me what to test. They just told me in a format nothing could execute.

The sweep also surfaced the domain language — the vocabulary that twenty years of business logic is written in, where "account," "entity," and "org" mean three different things and two of them are load-bearing. No test generation effort survives contact with a legacy codebase without that glossary.

## The Agent Wiki

The sweep produced a mountain of findings, and a mountain of findings is not a map. The next step was distilling it into something durable: a wiki, sitting in the parent folder above the repos, written by agents, for agents.

That last part is the point. This is not documentation for humans to browse. It's context for future agent sessions to load. Every page is structured to answer the questions an agent asks when it starts work: what is this system, what does it talk to, what must not break.

```
platform-wiki/
├── PLATFORM.md      # the whole system, one page
├── repos/           # one page per repo: purpose, entry points, dependencies
├── contracts/       # every cross-repo contract, one file each
├── graveyard/       # abandoned test suites and what they asserted
├── glossary.md      # twenty years of domain language, decoded
└── specs/           # regression specs derived from all of the above
```

The `contracts/` folder is the crown jewel — every place one repo depends on the shape of another repo's output, written down explicitly, most of them documented for the first time in the platform's existence. The `graveyard/` folder preserves the intent of every dead test the sweep found. And `specs/` is where the wiki turns into ammunition: plain-language regression specs, derived from the contracts, the fossils, and the glossary, describing what the platform must keep doing.

This took most of the first day. It was worth every hour. The wiki is what turns "generate some tests" into "protect these specific behaviors."

## Rails Before Trains

Before generating a single test, I made the agent build the rails: Vitest for contract tests, Playwright for the UI. Fixtures, factories, selector conventions, page objects, CI wiring — all established up front with a handful of hand-reviewed exemplar tests.

This step is easy to skip and fatal to skip. If you let an agent generate 1,500 tests without conventions, you get 1,500 individually-styled snowflakes: every file inventing its own setup, its own selectors, its own mocking strategy. That's not a test suite, it's a maintenance bomb. With the rails laid first, every generated test lands in the same idiom, and a human can review test number 1,400 as quickly as test number 4.

The contract tests assert the seams the wiki uncovered:

```typescript
// contracts/orders-to-billing.test.ts
it('order completion emits a payload billing can parse', async () => {
  const order = await ordersClient.complete(fixtureOrder());
  const parsed = billingPayloadSchema.safeParse(order.invoicePayload);
  expect(parsed.success).toBe(true);
});
```

And the Playwright specs assert the user-facing behaviors, many resurrected straight from the graveyard:

```typescript
// ui/renewal-flow.spec.ts
test('a lapsed account sees the renewal banner, not upgrade', async ({ page }) => {
  await loginAs(page, accounts.lapsed);
  await expect(page.getByRole('banner')).toContainText('Renew');
});
```

## Goal Loops to 1,500

With the wiki's specs as input and the frameworks as rails, the generation phase was dynamic workflows again — but this time wrapped in goal loops. Not "write N tests." A convergence loop per spec area:

```
for each spec area:
  generate tests from the spec, in the house idiom
  run the suite
  fix real failures; delete flaky or wrong tests
  repeat until nothing new worth writing and two clean consecutive runs
```

The delete step matters as much as the generate step. A generated test that asserts the wrong thing is worse than no test — it's false confidence with a maintenance cost. The loop's job was to converge on tests that are correct, stable, and worth keeping, not to inflate a number. 1,500 is where the loops ran dry, not a target anyone set.

The whole generation phase — all of it, across contract and UI suites — took the remaining two days, mostly unattended. I reviewed convergence reports, spot-checked batches, and settled the judgment calls the agents escalated. Creator to reviewer, which is exactly where a human belongs in this loop.

One honest note about the pass rate: 100% passing is a convergence criterion, not a discovery. The loop runs until the suite is green, so green is table stakes. The suite's value is not that it passes today. It's what it catches tomorrow.

## Tests That Survive Cross-Examination

A green suite proves the tests pass. It proves nothing about whether they're worth having. A test can pass forever while asserting something no customer cares about — or worse, pass on a build that's genuinely broken. So before any batch of tests earned a permanent place in the suite, it had to survive cross-examination.

For each generated test, the workflow spawned adversarial reviewer agents whose only job was to refute it. Not to improve it, not to praise it — to kill it. Would this test still pass if the behavior it claims to protect were broken? Is it asserting behavior, or accidentally pinning an implementation detail? Would it flake under parallel runs? Each reviewer votes independently, and a test that can't win the vote gets deleted:

```javascript
const votes = await parallel([1, 2, 3].map(() => () =>
  agent(
    `Try to refute this test: would it still pass if the behavior it
     claims to protect were broken? Default to refuted if uncertain.`,
    { schema: VERDICT },
  )))
const survives = votes.filter(v => !v.refuted).length >= 2
```

The reviewers killed tests the goal loops never would have. The loops optimize for green; the skeptics optimize for teeth. You need both, and they need to be different agents — an agent grading its own homework will always find a reason to keep it.

The survivors then went through one more dynamic loop, this time running the simplify skill over the test files: collapse duplicated setup into shared fixtures, flatten abstractions that only one test used, cut anything the test didn't need to say. The loop reran until a full pass produced no changes. This is the unglamorous step that makes the number sustainable — 1,500 tests you keep is a maintenance surface, and every line of ceremony you leave in gets multiplied fifteen hundred times. The suite that came out the other side reads like one engineer wrote it on a very good week.

## What It Caught

The suite as it stands: roughly 1,500 tests. The contract suite runs in five minutes. The full UI suite runs in twenty-six minutes against a genuinely robust frontend. Both run on every release candidate.

Tomorrow came fast. In the suite's first week, a release candidate went red: a change in one service had altered a payload shape that another repo depended on — precisely the kind of cross-repo, undocumented-contract break that had been shipping to production unchallenged for twenty years. It was caught in five minutes of CI instead of by a customer. On a platform where every release used to be a bet, one prevented incident in week one is the entire business case, paid in full.

## What This Means For You

If you're a CEO or an operating partner, recalibrate what "untestable legacy platform" costs to fix. Regression coverage on a twenty-year-old system used to be a multi-quarter QA initiative that died in planning. It's now a days-long exercise, which changes both the diligence conversation and the first-hundred-days plan for every software asset you hold. A platform with no safety net is carrying silent risk you no longer have to accept.

If you're a CTO, notice where the three days actually went. Test generation was the cheap part at the end. The investment was the map: the session positioned above the repos, the historical sweep, the agent wiki with its contracts and glossary. That map now compounds — every future agent session on this platform starts with twenty years of context preloaded. Build the map first, and everything after it gets cheaper.

If you're a CPO or you run product, understand what a trustworthy thirty-minute suite does to your release calendar. Releases that were quarterly because every one was a risk event can become weekly because every one is verified. The suite isn't a QA artifact. It's release velocity.

Twenty years of engineers left behind everything needed to protect this platform — in dead test folders, in commit messages, in vocabulary scattered across fifty repos. It just needed to be excavated, organized, and handed to something that could act on all of it at once.

The tests were never the hard part. The map was. Build the map.
