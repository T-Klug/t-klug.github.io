---
title: "Steer the System, Not the Session. The AI-DLC Starts at the Help Desk."
date: 2026-11-06
topic: ai-operations
tags: [ai, agents, sdlc, support, process, strategy]
image: ../../assets/img/steer-the-system.png
description: "Many teams use agents only at the build step, with an engineer steering each session. For low-risk support bugs, a ticket-triggered AI-DLC can cost less, and each fix feeds new tests back in."
---

A customer reports that exporting a report fails whenever the report's name has a comma in it. Support can't find a help article for it, so they escalate. It lands on the engineering board and waits for grooming. An engineer picks it up between feature tasks, opens Claude Code, pastes in the ticket and asks for a repro. They watch. They correct course twice. They get a fix, open a pull request and go back to the feature. The PR waits most of a day for a reviewer, who approves it without a comment. It ships with the next deploy. Somebody remembers to tell the customer. Two months later the same class of bug comes back in a different report.

Every engineer in that story had an AI agent. The agent made one step faster: writing the fix. Every other step still waited on a person, and the engineer was the agent's runtime. It started when they started, stopped when they looked away, and nothing it learned outlived the session.

That's the default way teams adopt agents: one engineer, one terminal, steering the session. It's the right way to do hard, ambiguous work. It's an expensive way to fix the hundredth small bug of the quarter. For low-risk bugs that arrive through support, the engineer can get out of the driver's seat, and that's where the cost case for an AI-DLC actually shows up.

This assumes the foundation from [September](/posts/agile-to-agentic/) is in place: tests you trust, a deploy path that's safe to use often, and review tiered by risk.

## Build, Test, Deploy Is the Middle of the Lifecycle

Most AI adoption lives in the build step. It's what vendors demo and what engineers feel. Even AWS's [original AI-DLC](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) treated operations as managing "infrastructure as code and deployments." Support tickets, customer replies and learning from escapes weren't part of the picture.

Look at where the time goes on a support bug and most of it sits outside construction. Before the build, someone has to decide this is a bug and not a how-to question, find the duplicates, work out how many accounts it hits, judge how risky the fix is and reproduce it. After the deploy, someone has to confirm the error actually stopped in production, tell the customer and make sure the same class of bug can't come back. Those steps are usually nobody's job in particular, which is why they're slow.

Here's the same ticket run two ways:

| Step | Engineer steering an agent | Ticket-triggered AI-DLC |
|---|---|---|
| Intake | Ticket waits for grooming; duplicates pile up | A triage agent dedupes, links related tickets, counts affected accounts and proposes a risk tier |
| Reproduce | Engineer reads the ticket and tries to reproduce it locally | A test agent writes a failing test from the ticket and the error trace before anyone touches the code |
| Fix | Engineer prompts, watches and corrects | A fixing agent works until the failing test passes. It can't edit the test |
| Review | A human reviewer, from a queue | Mechanical gates, then specialist review agents, then an adversarial agent whose job is to break the change |
| Release | Whenever someone runs the next deploy | Staged rollout behind a flag, with automatic rollback |
| Confirm | Someone checks, eventually | An ops agent confirms errors are back to baseline and adds an internal note to the ticket |
| Customer | Someone remembers | An agent drafts the reply; a support engineer approves it, sends it and closes the ticket |
| Learn | Fix the bug, move on | The root cause becomes a regression test or a lint rule; a docs gap becomes a help-center draft that support approves |

The right-hand column isn't a faster build step. It's a different shape. The ticket starts the work, the system carries it between steps, and people show up at defined points: a support engineer escalates, the code owner confirms the repro test and owns the merged fix, a support engineer approves the customer reply, and someone audits a sample of merged fixes after the fact.

## Why Steering the Session Is Expensive

When an engineer steers an agent through a ticket, you pay for the engineer's attention for the whole ticket. The model is the cheap part. Four things make that expensive at volume.

**The human is the clock.** In a steered session the agent moves when the engineer is looking. While it runs, the engineer either watches, which wastes the time, or switches to something else, which costs the switch and leaves the agent idle the moment it needs an answer. Either way, the ticket moves at the speed of one person's attention.

**Attention doesn't scale.** An engineer can actively steer a few sessions at once, so throughput tops out at engineers times sessions: a higher ceiling than before, but the same shape. OpenAI's [harness engineering](https://openai.com/index/harness-engineering/) team summed up its model as "Humans steer. Agents execute." Look at what they steer: "We prioritize work, translate user feedback into acceptance criteria, and validate outcomes." When "our bottleneck became human QA capacity," they didn't add supervision. They made the app's UI, logs and metrics readable by the agents so the agents could check their own work. That's steering the system, not the session.

**You pay for uniform review where it adds least.** Steered changes wait in the same review queue as everything else. In September I cited Faros's finding that [PR review time rose 91%](https://www.faros.ai/blog/ai-software-engineering) on high-AI teams, and LinearB's finding that [agentic PRs wait 5.3 times longer](https://linearb.io/resources/engineering-benchmarks) than unassisted ones to be picked up. Review still earns its keep on risky code and on maintainability. A [2015 Microsoft Research paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2015/05/PID3556473.pdf) found that "only about 15% of comments provided by reviewers indicate a possible defect," with maintainability feedback making up a much larger share. And under load, review is already thinning. In a 2026 Carnegie Mellon and Stanford [study of one company's AI mandate](https://arxiv.org/abs/2607.01904), the share of pull requests with a substantive human comment fell from about 39% to about 21%, while about half of non-bot pull requests were approved silently throughout. On small, well-tested changes, uniform human review now costs more in latency than it returns in safety. Spend that attention where it matters.

**Nothing compounds.** What the engineer learned about that bug lives in a chat transcript and in their head. The next engineer starts from zero. OpenAI's team hit the same wall with code quality: they "used to spend every Friday (20% of the week) cleaning up 'AI slop.'" That didn't scale, so they wrote the rules into the repository and set background agents to sweep for violations and open small clean-up pull requests, most of which "can be reviewed in under a minute and automerged." The same idea applies to support. Every bug that reaches production should produce a regression test and a rule in whichever review layer should have caught it, and every how-to ticket support couldn't answer should produce a help-center article. The cheapest ticket is the one that never gets filed.

## The Cost Math

Write the cost of one low-risk ticket like this:

```text
cost per ticket = (human minutes × loaded hourly rate ÷ 60)
                + model spend
                + share of the platform's cost
```

In the steering model, human minutes dominate and scale linearly with ticket volume. In the system model, model spend goes up, because more agents touch each ticket (including an adversary), and you carry a fixed platform cost. In exchange, human minutes collapse to the approval points.

A worked example **[ILLUSTRATIVE]**. These inputs are assumptions, not measurements; plug in your own.

- A steered low-risk bug takes 120 minutes of human time end to end: reading and reproducing, steering the fix, opening the PR, the reviewer's time, the deploy and the customer follow-up.
- The system version takes 15 minutes of human time: the support engineer's escalation and reply approval, an occasional answer from the code owner, and a sampled audit.
- That frees 105 minutes per ticket (derived: 120 − 15 = 105).
- At 100 low-risk tickets a month, that's 175 hours a month (derived: 105 × 100 ÷ 60 = 175), a little more than one engineer's working month at 160 hours (derived: 175 ÷ 160 ≈ 1.1).
- At an assumed loaded rate of $100 an hour, that's $175 of headroom per ticket (derived: 105 ÷ 60 × $100 = $175), or $17,500 a month (derived: $175 × 100). The system pays off only if its added model spend plus its share of the platform's cost stays under that.

Freed hours are capacity, not savings, unless they replace work you'd otherwise hire for. And most of those minutes come from intake, reproduction, confirmation and the customer reply, not from review. Removing the reviewer is the smallest saving and the largest risk, which is why it comes last. Put model spend per merged change on the dashboard from day one, next to human minutes per ticket. At low volume the math may not work.

The formula also leaves out things that cut both ways. Latency and deflection favor the system. When Intercom [piloted AI approval](https://www.intercom.com/blog/ai-is-approving-our-pull-requests-heres-how-we-made-it-safe) of pull requests, time-to-approval at the 75th percentile improved 6 to 16 times, and a help-center article written from one ticket removes future tickets from the queue entirely. Tickets that drop out of the low tier after agents have already spent on them, any bug that escapes, and the people who run the pipeline all count against it.

Be honest about the fixed cost, too. The system needs things a steered session doesn't: the verification floor and safe deploy path from September, agents wired into the help desk, the tracker and error monitoring, preview environments, and off switches. For the first couple of months it runs with humans still reviewing everything, so you pay for both before you save on either.

## What Counts as Low Risk

This only works if the low-risk tier is narrow and the rules for entering it are strict. AWS's [open-source AI-DLC workflows](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/) make the general point: "A simple defect fix doesn't require elaborate requirements analysis and planning." The work is in deciding which fixes are simple.

- **What qualifies:** small bug fixes outside protected paths, copy and styling, non-security configuration, patch-level dependency updates, docs, and code behind a feature flag that's off.
- **What never qualifies:** auth, payments, personal data, tenancy, schema changes and migrations, public APIs and infrastructure. Path rules decide that, not a model. A change that touches a protected path, or a very large diff, goes straight to senior review without consulting a classifier.
- **A classifier proposes the tier for everything else.** When it's unsure, it picks the higher tier. At review time it can raise the tier, never lower it.
- **Up is easy, down is hard.** Anyone can raise a tier. Only the tech lead can lower one.
- **No repro, no low risk.** If the test agent can't write a failing test that reproduces the bug, a person picks it up. When it can, the code owner confirms in one line that the test asserts what the customer expected. That's a check on intent, not a code review.
- **Every low-tier change has a named owner.** The code owner of the touched path is notified at merge, owns the outcome and can hold the release during a short window. Intercom puts it plainly: "The human who ships the code remains accountable for the outcome."
- **Every wrong call becomes a test case** for the classifier.

## Where This Is Heading

The line between "an agent can merge this" and "a person has to read this" is moving, and the teams furthest along are specific about where they've drawn it. In September I pointed to tests, docs and internal tooling as the place to start, because the most-cited examples still kept a person on every merge. What makes a narrower next step possible is detail. Each account below says what qualifies, what gates it, who can still stop it and what happened to reverts.

| Team | What merges without a person reading it | What gates it | What happened |
|---|---|---|---|
| [Spotify](https://engineering.atspotify.com/2023/05/fleet-management-at-spotify-part-3-fleet-wide-refactoring) (2022) | 77% of more than 270,000 automated refactoring and dependency pull requests | All tests and checks pass, and only during the owning team's working hours, "never on weekends and holidays" | Spotify says the rollout "proved both the usefulness and safety of automerging" |
| [Meta](https://arxiv.org/abs/2605.30208) (2026 paper) | Low-risk bot changes, mostly maintenance such as broken-test fixes and migrations | AI-generated changes pass safety checks, a machine-learned risk score and an LLM review; failures go to a person, who can also reject during a delay before landing | Across everything RADAR reviewed, human and bot, reverts ran at one third the rate of other changes and incidents at one fiftieth, which Meta says "is not a causal estimate" |
| [Intercom](https://www.intercom.com/blog/ai-is-approving-our-pull-requests-heres-how-we-made-it-safe) (April 2026) | Over 19% of pull requests, approved by a review agent | Specialist review agents, no large PRs, auditors brought in early, and the engineer who ships stays accountable | Zero reverts in a pilot of more than 100 PRs, then 497 fully autonomous PRs in the first four weeks of rollout |
| [Anthropic's Claude Code team](https://claude.dev/blog/solving-code-review-at-anthropic/) (October 2026) | Docs, copy, internal-only features and additive changes behind a flag, from trusted authors | "Once automated review and security checks are green" | Merged PRs "more than doubled while the share that had to be reverted fell by more than 40 percent" |

Bug reports are starting to flow straight into fixes too, with a person still on the merge. Linear [uses its own agent](https://linear.app/changelog/2026-06-11-coding-sessions) to resolve "roughly 30% of incoming bug reports, mostly on the first pass," and each fix comes back as a diff for review. Stripe's CI [opens tickets for flaky tests](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) "that prompt users to fix the problem with a minion," and more than a thousand minion-produced pull requests merge there each week, all human-reviewed. OpenAI describes a repository where one prompt takes an agent from a reported bug to a validated fix and a merged change, escalating "to a human only when judgment is required."

The honest summary: none of these shows no-human merges on customer-reported bugs at scale. Meta's bot fixes, Intercom's pipeline and OpenAI's bug loop each cover part of it, and none combines them. Several of these sources sell AI products. The Carnegie Mellon and Stanford study found no collapse in revert rates as human review thinned, but says its evidence "cannot rule out quality costs." OpenAI says its end-to-end loop "should not be assumed to generalize without similar investment." So start narrow, and widen the low tier only as your own revert and incident numbers allow.

The human in the loop still isn't optional, the same rule as [January](/posts/ai-dlc-engineering/). What's changing is where the human sits: on the risk rules, the tests, the customer reply and the audit, instead of on every diff.

## Guardrails for Work That Starts in a Help Desk

Support tickets are written by customers, and that changes the threat model.

- **Ticket text is untrusted input.** Anyone can type anything into a support form, including instructions aimed at your agents. Prompt injection isn't a solved problem, so design as if it will sometimes work: agents that read ticket text hold no secrets and have no outbound channel, tests run in a sandbox without CI credentials, and the support engineer's escalation is what authorizes agents to start. The code owner's one-line check on the repro test is the gate before merge. Review agents treat PR descriptions and code comments as untrusted too.
- **Customer data stays in the help desk.** Agents link to tickets instead of copying them, work from IDs and configuration rather than customer records, and nothing customer-identifying goes into a test.
- **No agent message reaches a customer without a person approving it.** That includes help-center articles.
- **Severity rules, not agents, decide what pages on-call.** If the ticket turns out to be an incident, people hold incident command.
- **Least privilege per agent.** The triage agent writes ticket fields. The test agent writes tests. The fixing agent writes application code on a branch. Only the release pipeline touches production. The ops agent reads telemetry and writes internal notes, nothing else.
- **Every loop is bounded.** Turn limits, timeouts, a cap on review rounds, and off switches for auto-merge and auto-release, all set before go-live.

## The Triggers Exist Now

You don't have to write the plumbing from scratch. The major tools can start work from an event instead of a person:

- Claude Code's [GitHub Action](https://code.claude.com/docs/en/github-actions) can run on any GitHub event and "turn issues into pull requests." Its [scheduled tasks](https://code.claude.com/docs/en/routines), in research preview, can start when an issue is labeled.
- Assigning an issue to GitHub's [Copilot cloud agent](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task) "always creates a pull request," and sessions can be [set to start automatically](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/start-copilot-sessions) when an issue is opened.
- Jira's [Coding Agent](https://support.atlassian.com/jira-software-cloud/docs/generate-code-from-a-work-item-in-jira/) takes an assigned work item, can be called from an [automation rule](https://support.atlassian.com/jira-software-cloud/docs/work-with-jira-coding-agent-in-automations/) when a work item meets your conditions, and can open a draft pull request.
- OpenAI's Codex picks up [Linear issues](https://learn.chatgpt.com/docs/third-party/linear) assigned to it, and Linear's own agent can [attempt a first-pass fix](https://linear.app/changelog/2026-06-11-coding-sessions) on new issues. Linear's agent also [turns Intercom and Zendesk tickets into issues](https://linear.app/changelog/2025-12-11-linear-agent-for-intercom-zendesk-gong) "with a single button click."

Zendesk doesn't ship a coding agent, so most teams will build the Zendesk trigger themselves. The parts are standard. A [ticket trigger](https://support.zendesk.com/hc/en-us/articles/4408886797466-Creating-ticket-triggers-for-automatic-ticket-updates-and-notifications) is a business rule that runs "immediately after a ticket is created or updated," and its "Notify webhook" action can [call your intake service](https://support.zendesk.com/hc/en-us/articles/4408839108378-Creating-webhooks-to-interact-with-third-party-systems). If support already escalates through Zendesk's [Jira integration](https://support.zendesk.com/hc/en-us/articles/4408827996058-Using-the-Zendesk-Support-for-Jira-integration), every linked ticket gets a `jira_escalated` tag by default, which makes a clean trigger condition. Send the triage agent the ticket ID and a link, not the ticket body, so customer data stays in Zendesk and the agent reads only what its connector allows. Building this yourself is no loss. That hop is where the triage agent belongs anyway.

None of these tools is the AI-DLC. They're triggers, and most of them stop at a pull request for a person to review. That's the right default, and it's exactly where the risk tier decides what happens next.

## How to Start

Pick one team, one repository and one source of tickets.

1. **Baseline first.** Time from ticket to fix in production, reopened tickets, change fail rate, human minutes per low-risk ticket and model spend per merged change. Two weeks is enough.
2. **Wire the front door.** Escalations from the help desk create tracker items with type, severity, affected accounts and a link back to the ticket. The triage agent starts there.
3. **Classify silently.** Agents run the full path and propose a tier on every ticket, while a person still reviews every change. Compare the agent's tier calls with your senior engineers'. Move on when they match.
4. **Make it visible.** Show reviewers the proposed tier and the review agents' digest: findings resolved, findings open, test evidence.
5. **Enforce, narrowly.** Start no-human merges with the September tier: tests, docs and internal tooling. Add support-bug fixes only after the silent period shows the agents caught what your engineers caught. Everything else keeps today's review. Walk your auditor through the low tier first, and set and test the off switch before any of this starts.
6. **Decide at 90 days.** Judge it against your own baseline, with no target set in advance.

## What This Means For You

If you're a CEO, ask how a low-risk bug gets from the help desk to production and how many people touch it on the way. If the answer is "an engineer picks it up and uses a coding agent," you've bought faster typing. Ask for human minutes per ticket and time from ticket to fix, not seats. And make sure your support leaders know they're now the front door of the engineering system: the quality of an escalation (type, severity, affected accounts) is input an agent acts on.

If you're a CTO, pull the last 20 bugs that came in through support. How many human minutes did each one take, and how many would have qualified for the low tier? That's your business case. Then build the triggers, tiers, tests and off switches before you remove a single reviewer.

If you're a CPO, support tickets are the most direct customer signal you have, and this system turns them into structured intent. Own the routing: bugs go down the fix path, feature requests come to you for ranking, and gaps in the docs become help-center articles. Own the customer reply too. A fix doesn't count until the customer hears about it.

Steering an agent through a hard problem is still good engineering. Steering one through the hundredth comma-in-a-report-name bug is a job for a system. Steer the system.

## Sources

**Practice reports:** [Meta: Automating low-risk code review at Meta (RADAR)](https://arxiv.org/abs/2605.30208) · [Spotify: Fleet Management Part 3, fleet-wide refactoring](https://engineering.atspotify.com/2023/05/fleet-management-at-spotify-part-3-fleet-wide-refactoring) · [Intercom: AI is approving our pull requests](https://www.intercom.com/blog/ai-is-approving-our-pull-requests-heres-how-we-made-it-safe) · [Anthropic: How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) · [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) · [Stripe: Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) · [Linear: Coding sessions](https://linear.app/changelog/2026-06-11-coding-sessions)

**Research:** [He et al.: AI writes faster than humans can review, a longitudinal study of an enterprise 2x mandate](https://arxiv.org/abs/2607.01904) · [Czerwonka, Greiler and Tilford: Code reviews do not find bugs](https://www.microsoft.com/en-us/research/wp-content/uploads/2015/05/PID3556473.pdf)

**Vendor telemetry:** [Faros AI: The AI Productivity Paradox](https://www.faros.ai/blog/ai-software-engineering) · [LinearB Software Engineering Benchmarks](https://linearb.io/resources/engineering-benchmarks)

**Methods:** [AWS: AI-Driven Development Life Cycle](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) · [AWS: Open-sourcing adaptive workflows for AI-DLC](https://aws.amazon.com/blogs/devops/open-sourcing-adaptive-workflows-for-ai-driven-development-life-cycle-ai-dlc/)

**Tooling:** [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) · [Claude Code scheduled tasks](https://code.claude.com/docs/en/routines) · [GitHub Copilot: Kick off a task](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/kick-off-a-task) · [GitHub Copilot: Start sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/start-copilot-sessions) · [Jira Coding Agent](https://support.atlassian.com/jira-software-cloud/docs/generate-code-from-a-work-item-in-jira/) · [Jira Coding Agent in automations](https://support.atlassian.com/jira-software-cloud/docs/work-with-jira-coding-agent-in-automations/) · [Codex in Linear](https://learn.chatgpt.com/docs/third-party/linear) · [Linear agent for Intercom and Zendesk](https://linear.app/changelog/2025-12-11-linear-agent-for-intercom-zendesk-gong) · [Zendesk: Ticket triggers](https://support.zendesk.com/hc/en-us/articles/4408886797466-Creating-ticket-triggers-for-automatic-ticket-updates-and-notifications) · [Zendesk: Webhooks](https://support.zendesk.com/hc/en-us/articles/4408839108378-Creating-webhooks-to-interact-with-third-party-systems) · [Zendesk Support for Jira](https://support.zendesk.com/hc/en-us/articles/4408827996058-Using-the-Zendesk-Support-for-Jira-integration)
