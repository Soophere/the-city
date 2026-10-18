# The City

**A free-only fleet of AI workers, routed by job instead of by model.**

> **Rule zero:** nothing here may cost money. Free tiers, free software, local ports. Anything that
> would bill needs the owner's explicit yes first.

Most "AI stack" repos pick one model and hard-code it. This one starts from the opposite end: a
job — *run this*, *think about this*, *code this* — is served by a **pool** of measured free workers,
whichever of them is healthy and fast right now. Membership in a pool is earned by answering a probe,
not by appearing on a marketing page.

## How it works

| Piece | Where | What it is |
|---|---|---|
| **Census** (`census.mjs` → `roster.json`) | local | Probes every model the free account lists, records what really answers and how fast. This is the timesheet. |
| **LiteLLM** (city hall) | `127.0.0.1:4000` | Turns the roster into three pools — `runner`, `thinker`, `coder` — with latency-based routing, per-worker timeouts, retries, cooldowns, fallbacks and an answer cache. |
| **Open WebUI** (town square) | `127.0.0.1:3000` | Chat UI where one prompt goes to several pools side by side; **Merge** sends all their answers to a synthesizer (mixture of agents). |
| **Any OpenAI-compatible agent** (workforce) | `http://127.0.0.1:4000/v1` | Point a coding agent at the proxy and it picks `runner` / `thinker` / `coder` by job. |

The two services run as containers with `--restart unless-stopped`, so they survive a reboot and do
not depend on any agent session staying alive.

## The census is the point

The free NVIDIA catalog listed **82 chat models** for this account. Probing all of them at a 10-minute
cap gave:

| Verdict | Count |
|---|---|
| **answers with text** | **17** |
| not entitled (account error from the API itself) | 55 |
| empty answer | 3 |
| transport error | 3 |
| too slow | 2 |
| HTTP error | 2 |

So the catalog is ~4× larger than the account's real entitlement, and the same model can answer in
8.5 s and return an empty 200 minutes later. That is why the roster — not the vendor page — decides
who works.

The 17 survivors were folded into pools by measured latency:

- `runner` — fast general workers (0.4 s – 3.5 s): `poolside/laguna-xs-2.1`, `openai/gpt-oss-20b`,
  `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3-ultra-550b-a55b`, and more.
- `thinker` — patient workers (88 s – 247 s): `deepseek-ai/deepseek-v4-flash-0731`,
  `nvidia/nemotron-3.5-lightning-30b-a3b`, `moonshotai/kimi-k3`, `z-ai/glm-5.3` (flagged flaky —
  that one drops connections but has answered before).
- `coder` — provisional until a tool-use test picks members that can actually call a tool.

Config lives in [`config/litellm.yaml`](config/litellm.yaml); the measured timesheet is committed as
[`data/roster.json`](data/roster.json).

## What the system learned

- **More keys ≠ more capacity.** Every key from the free model pages belongs to the same account and
  lists the identical catalog. Capacity comes from more *providers* and from routing, not from key
  farming.
- **Per-worker patience, never one global timeout.** A worker measured at 88 s gets 600 s of
  patience; a 470 ms worker gets 120 s and is abandoned sooner.
- **A failure must be classified.** "Not entitled" (404 from the API), "silent" (empty 200),
  "transport" (dropped connection) and "slow" are different verdicts — the router treats them
  differently.
- **Specialist models are not workers.** Safety classifiers, parsers and translation models answer,
  but they are not general chat workers; they belong to tools, not pools.
- **The account has a second catalog.** Genomics, 3D and image endpoints live under different API
  hosts and produce artifacts, not chat — they are "workshops", not pool members.

## Reproduce it

1. Get a free NVIDIA NIM API key and put it in your environment:
   ```bash
   export NVIDIA_API_KEY=...
   ```
2. Run the census (resumable; writes `census.jsonl` and `roster.json`):
   ```bash
   CITY_DIR=./data node census.mjs
   ```
3. Start LiteLLM with the committed config and your key (the proxy reads
   `os.environ/NVIDIA_NIM_API_KEY`; nothing is baked into the file):
   ```bash
   docker run -d --name city-litellm -p 4000:4000 \
     -e NVIDIA_NIM_API_KEY="$NVIDIA_API_KEY" \
     -e LITELLM_MASTER_KEY="$LITELLM_MASTER_KEY" \
     -v "$PWD/config/litellm.yaml:/app/config.yaml" \
     ghcr.io/berriai/litellm:main-latest --config /app/config.yaml
   ```
4. (Optional) Add Open WebUI on `:3000` pointed at `http://localhost:4000/v1` and enable compare +
   merge to get the mixture-of-agents view.
5. Point any OpenAI-compatible agent at `http://127.0.0.1:4000/v1` and ask for `runner`, `thinker` or
   `coder`.

## Repo layout

```
census.mjs            probe every model, classify, write the timesheet
config/litellm.yaml   pools, routing, timeouts, fallbacks, cache
data/catalog.json     snapshot: every model id the account listed
data/roster.json      folded results: verdict, first-token ms, total ms per model
docs/api-inventory.md measured endpoint inventory, with verdicts
docs/build-log.md     what was built, learned and broke, session by session
```

## Safety

No API keys, proxy keys or account identifiers are in this repository. The `.env` lives outside the
repo and is never committed. All workers used here are on free tiers.

## License

MIT — see [LICENSE](LICENSE).
