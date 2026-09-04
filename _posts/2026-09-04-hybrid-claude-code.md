---
title: Claude Plans, Your Hardware Executes. A Hybrid Claude Code Setup in One Proxy File.
date: 2026-09-04
categories: [Technology, AI, How-To]
tags: [ai, claude-code, agents, local-llm, dgx-spark, how-to]
author: TJ
image: /assets/img/hybrid.png
---

Every serious Claude Code session I run now has two models in it. The conversation itself, the planning, the judgment calls, the code review: that is Claude Opus or Fable, on my Anthropic subscription. Every subagent, every fork, every worker in a dynamic workflow: that is a model running on two DGX Sparks in my office, for free, as many as I want in parallel.

Claude Code has no setting for this. It has one base URL and one API key. What made it work is a Node proxy that is small enough to read over coffee. This post is the how-to.

## Why Split the Work

The reasoning is the same reason you don't staff a project with eight principal engineers. In an agentic session, one model does the thinking that matters and a fleet of others does the sweeping: read these fifty repos, refute this test, summarize this log, apply this mechanical refactor across these files. The orchestrator needs to be the best model you can get. The workers need to be good enough, fast enough, and above all cheap enough that you never hesitate to fan out.

Fanned-out workers are also where the tokens go. A workflow that spawns fifteen agents, each reading a few hundred kilobytes of code, burns through a subscription's rate limit in an afternoon. Pushing that traffic to hardware I already own turns "should I fan out?" into "how wide?"

The local side here is a pair of NVIDIA DGX Sparks running vLLM in tensor-parallel across the two boxes. The model behind it has changed three times in a week (GLM-5.3-Flash, DeepSeek V4 Flash, currently Qwen3.8-Flash-Next) while I chased the right speed-to-intelligence trade-off. The proxy absorbed every swap with a two-line edit, which turned out to be the strongest argument for the design.

## The Shape of It

Claude Code talks to Anthropic through one environment variable, `ANTHROPIC_BASE_URL`. Point that at a loopback proxy, and the proxy gets to see every request before it leaves the machine. It routes on exactly one field, `model`:

```
Claude Code ──► 127.0.0.1:3456 (proxy)
                    │
                    ├── model == local worker name ──► http://spark1.lan:8888/v1/messages  (vLLM)
                    │
                    └── anything else ───────────────► https://api.anthropic.com (headers untouched)
```

Everything else about the session stays stock. Claude Code already has a knob for which model subagents use, `CLAUDE_CODE_SUBAGENT_MODEL`. Set it to the local model's served name and every Agent call, fork, and workflow worker gets routed to the Spark without changing anything about how you work. The main thread never notices.

Three properties fell out of this that I would not give up now:

- **The proxy is the only thing that knows where the local model lives.** Claude Code, my settings, my muscle memory: none of it references the Spark.
- **vLLM speaks the Anthropic Messages API natively** (`/v1/messages`), so the proxy does not translate formats. It forwards bytes and streams the response back. Tool calls, thinking blocks, images in tool results all pass through.
- **Auth never crosses the streams.** Anthropic credentials are stripped before anything goes to the Spark, and the Spark key is never sent to Anthropic.

## Four Files

### 1. The proxy

The whole thing is a single `http.createServer`. Read the body, parse the model, pick an origin, forward. Here is the routing core, condensed:

```javascript
// ~/.local/share/claude-hybrid/proxy.mjs
const SPARK_ORIGIN = new URL(process.env.SPARK_BASE_URL);
const SPARK_MODELS = new Set(
  [process.env.SPARK_MODEL, ...(process.env.SPARK_MODELS ?? "").split(",")]
    .map((m) => m.trim()).filter(Boolean)
);
// Claude Code appends "[1m]" for its 1M-context option. Route on the bare name.
const stripCtxSuffix = (m) => (typeof m === "string" ? m.replace(/\[1m\]$/i, "") : m);

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") { /* ...report origin + model... */ }

  const body = await readBody(req);
  let parsed = null;
  try { parsed = JSON.parse(body.toString("utf8")); } catch {}

  const model = stripCtxSuffix(parsed?.model ?? null);
  const routeToSpark = SPARK_MODELS.has(model);

  if (routeToSpark) {
    parsed.model = model;
    translateEffort(parsed);                 // see the next section
    const sparkBody = Buffer.from(JSON.stringify(parsed));
    const headers = makeUpstreamHeaders(req.headers, sparkBody, { spark: true });
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} model=${model} route=spark`);
    return proxyRequest({ req, res, origin: SPARK_ORIGIN, body: sparkBody, headers });
  }

  const headers = makeUpstreamHeaders(req.headers, body, { spark: false });
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} model=${model ?? "unknown"} route=anthropic`);
  return proxyRequest({ req, res, origin: new URL("https://api.anthropic.com"), body, headers });
});

server.listen(3456, "127.0.0.1");
```

`makeUpstreamHeaders` copies the incoming headers except the hop-by-hop ones (`host`, `connection`, `content-length`, `transfer-encoding`), drops `authorization` and `x-api-key` when the destination is the Spark, and adds a `Bearer` token for the local server. `proxyRequest` is a plain `http.request` that pipes the upstream response straight back so streaming survives.

Two deliberate omissions. The proxy listens on loopback only, so nothing else on the LAN can ride my Anthropic session through it. And it never buffers responses, because the whole point of the local box is that a 200k-token agent turn streams for minutes.

### 2. The effort translator

This is the part nobody warns you about. Claude Code sends a reasoning effort on every request (`low`, `medium`, `high`, and `none` when you turn thinking off). Anthropic's models accept all of those. Local models do not, and each family speaks its own dialect:

| Model family | Accepts | Unknown value means |
|---|---|---|
| GLM-5.3-Flash | `low`, `high`, `max` | `max` (silently) |
| Qwen3.8-Flash-Next | `low`, `medium`, `xhigh` | template raises → HTTP 400 |
| DeepSeek V4 Flash | `none` … `xhigh`, `max` | `high` |

A subagent that fails with a 400 the instant it spawns is almost always this. The fix is a small map applied only on the Spark route:

```javascript
function translateEffort(parsed) {
  const raw = parsed.output_config?.effort?.toLowerCase() ?? "";
  const off = ["none", "off", "minimal", "disabled"].includes(raw)
           || parsed.thinking?.type === "disabled";

  if (off) {
    // vLLM ignores Anthropic's `thinking: {type: disabled}`; tell the chat template directly.
    parsed.chat_template_kwargs = { ...(parsed.chat_template_kwargs ?? {}), enable_thinking: false };
    if (parsed.output_config) { const { effort, ...rest } = parsed.output_config; parsed.output_config = rest; }
    return;
  }
  if (parsed.output_config?.effort !== undefined) {
    const map = { low: "low", medium: "medium", high: "medium", xhigh: "xhigh", max: "xhigh" };
    parsed.output_config.effort = map[parsed.output_config.effort] ?? "medium";
  }
}
```

When the model behind the Spark changes, this map is the edit. Keep a dated backup of the previous version next to it, because you will swap back.

### 3. The settings overlay

Claude Code accepts a `--settings` file that layers over your normal config. Mine contains only what the hybrid mode needs, so plain `claude` stays untouched:

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "",
    "ANTHROPIC_AUTH_TOKEN": "",
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456",
    "CLAUDE_CODE_SUBAGENT_MODEL": "qwen3.8-flash-next",
    "ANTHROPIC_CUSTOM_MODEL_OPTION": "qwen3.8-flash-next",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME": "qwen3.8-flash-next",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION": "qwen3.8-flash-next",
    "API_TIMEOUT_MS": "3600000",
    "CLAUDE_STREAM_IDLE_TIMEOUT_MS": "1800000",
    "CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS": "1800000",
    "CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS": "3600000",
    "CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING": "1",
    "CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK": "1"
  }
}
```

The blank API key lines matter: they force Claude Code to fall back to your normal subscription login for the Anthropic route, and the proxy passes that bearer token through untouched.

The custom model option lines put the local model in the `/model` picker, so you can drop the *whole* session onto the Spark for a task that does not need Opus.

The timeouts are the other lesson learned the hard way. A local 300B-parameter mixture-of-experts model streams reasoning at tens of tokens per second, and a cold 100k-token prefill can take a minute before the first byte arrives. Claude Code's defaults assume Anthropic's latency and will kill a perfectly healthy worker. Thirty-minute idle windows and an hour-long request ceiling sound absurd until you watch a worker finish a 40-minute refactor with no drama.

### 4. The launcher, the rules, and the service

The launcher is three lines:

```zsh
#!/bin/zsh
exec claude \
  --settings "$HOME/.claude/hybrid-settings.json" \
  --append-system-prompt-file "$HOME/.local/share/claude-hybrid/hybrid-rules.md" \
  "$@"
```

The rules file it appends tells the orchestrator how to treat the fleet. Mine is a paragraph: workers are a local model, never run more than eight concurrently, batch bigger stages. That number comes from how many sequences the Spark pair serves at full speed before decode throughput per stream starts to fall. Yours will differ. Put it in the system prompt rather than trusting the model to remember.

The proxy itself runs under `launchd` with `RunAtLoad` and `KeepAlive`, wrapped in a small script that pulls the Spark key out of the macOS Keychain so it never sits in a file:

```zsh
export SPARK_BASE_URL="http://spark1.lan:8888"
export SPARK_MODEL="qwen3.8-flash-next"
export SPARK_MODELS=""          # extra served aliases, comma-separated
export SPARK_API_KEY="$(security find-generic-password -a "$(id -un)" -s claude-hybrid-spark -w)"
exec node "$HOME/.local/share/claude-hybrid/proxy.mjs"
```

## Living With It

```bash
claude-hybrid                              # Opus/Fable main thread, local subagents
claude-hybrid --model qwen3.8-flash-next   # everything local
claude                                     # stock Claude Code, no proxy
```

Inside a session, an Agent call with `model: "opus"` sends that one worker to Anthropic when a task genuinely needs it. Everything else defaults to the Spark. The proxy log is one line per request with the route on it, so `tail -f` tells you exactly where your tokens are going:

```
2026-09-04T13:54:10Z POST /v1/messages?beta=true model=claude-fable-5-1 route=anthropic
2026-09-04T13:54:16Z POST /v1/messages?beta=true model=qwen3.8-flash-next route=spark images=0
2026-09-04T13:54:16Z POST /v1/messages?beta=true model=qwen3.8-flash-next route=spark images=0
2026-09-04T13:54:16Z POST /v1/messages?beta=true model=qwen3.8-flash-next route=spark images=0
```

Failure modes are pleasantly legible. Subagents dying with a 502 and the main thread fine means the Spark is down. Everything dying means the proxy is down, and the fix is `launchctl kickstart -k` on the service. A 400 from a worker means the effort map is for the wrong model family.

## What This Means For You

If you run engineering, the interesting number here is not tokens saved. It is how the fan-out decision changes when workers are free. Fifteen agents sweeping a codebase stops being a budget line and becomes the default first move. The orchestrator stays frontier-grade because that is where judgment lives, and judgment is the part you should never economize on.

If you are evaluating local inference hardware, notice what the proxy made irrelevant. I changed the model behind it three times in seven days and never touched Claude Code. Decouple the client from the model early, or every model swap becomes a client migration.

And if you are wondering whether this is a hack that will break on the next Claude Code release: maybe. It leans on three documented knobs, a base URL, a subagent model variable, and a settings overlay, plus one loopback HTTP server. That is a small surface area to keep working, and every piece of it is a file you can read in full.

The model that plans should be the best you can get. The models that execute should be the ones you already own. One proxy file is all it takes to have both in the same session.
