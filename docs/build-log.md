# Journal

Append-only. Newest entry last. One entry per working session: what was done, what was learned, what broke.

## 2026-09-19 — night session: the city gets its front door

**Built**

- Census of the whole NVIDIA catalog: 82 models listed, all 82 probed. Result: **17 answer, 54 not entitled** (`Function … not found for account …`), 5 silent past 300 s, 5 answered with no text, 3 HTTP errors. The catalog is far larger than the account's entitlement — the roster, not the marketing page, decides who works.
- `city-litellm` container: three pools (`runner`, `thinker`, `coder`), workers taken from the census, per-worker timeouts from measured latency, `latency-based-routing`, cooldowns, fallbacks from `runner`/`coder` to `thinker`, and a local answer cache. Verified: `coder` answered in 850 ms, `runner` in 6.3 s.
- `city-openwebui` container: multi-model chat + **Merge (Mixture of Agents)**, pointed at the proxy. Verified healthy and able to fetch the pool list over the Docker network.
- DSH wired to the city: a `city` provider route (`http://127.0.0.1:4000/v1`) exposing `runner`/`coder`/`thinker`, the proxy key stored as `CITY_PROXY_KEY`, and the pools added to the delegation allowlist.
- Project memory switched on: the SQLite FTS session index is enabled in the profile patch, so sessions can search their own history once the tools are mounted.

**Learned**

- All API keys handed out by the model pages belong to one account: every key lists the identical catalog and calls work across keys. Harvesting more of them adds no capacity; capacity comes from *more free providers* and from routing, not from more keys.
- The catalog page is not scrapable (`/models.json` and `/api/models` are HTML; scripted fetches get an empty 202). The API (`/v1/models`) and models.dev (provider `nvidia`, 105 models) are the scriptable sources.
- Free workers are variable: the same model can answer in 8.5 s and return an empty 200 minutes later; several sit just under or over a 5-minute probe cap. Hence per-worker patience derived from measurement, retries, and hedging — never one global timeout.
- `build.nvidia.com` free tier is rate-limited in bursts (`ResourceExhausted: Worker local total request limit reached`), which is what made a bot panel look broken when the models were fine.
- Windows specifics: LiteLLM's startup banner crashes on a cp1252 console (`PYTHONUTF8=1` fixes it); Docker Desktop must be running before container work; services attached to an agent session die with it, so anything that must live 24/7 belongs in a container with a restart policy.

**Broke / fixed**

- LiteLLM's first start failed on the banner encoding → restarted with `PYTHONUTF8=1` and logs redirected to `litellm/proxy.log`.
- An interrupted tool call killed every background job (proxy, census pull). Containers with `--restart unless-stopped` replaced the job-based start.

**Open**

- Six models mislabeled by the 5-minute cap are being re-probed with a 10-minute cap (GLM-5.3 needs ~295 s).
- `coder` membership is provisional until a tool-use test runs.
- The five session-history tools still need the package declared for the profile.

## 2026-09-19 — re-probe at a 10-minute cap, and the specialist catalog

**Done**

- Re-probed the six models the 5-minute pass had mislabeled. Final roster: **17 answer, 55 not entitled, 3 empty, 3 transport-error, 2 slow, 2 http-error** (82 probed).
- `nvidia/nemotron-3-ultra-550b-a55b` → **ok at 6.4 s**; promoted into `runner` and `coder`, proxy reloaded, re-verified (`POOLS_OK`).
- `z-ai/glm-5.3` → transport error: NVIDIA drops the connection. It has answered before (88 s–429 s), so it stays in `thinker` with a 900 s budget and is treated as flaky rather than dead.
- `gemma-4-31b-it` and `llama-3.2-90b-vision-instruct` → transport errors; dropped. `nemoguard-topic-control` and `muse-glimmer-30b` → empty answers; these are specialised classifiers, not general workers.

**Learned — the account has a second, separate catalog**

- Genomics, protein, 3D and image models do **not** appear in `/v1/models`; they live on `health.api.nvidia.com/v1/biology/…` and `ai.api.nvidia.com/v1/genai/…`. Probing with an empty body distinguishes them: HTTP 422 means "entitled, needs a proper payload", 404 means "not at this path".
- Entitled and reachable today: **FLUX.1-dev** (images), **microsoft/trellis** (3D), **arc/evo2-40b** and **evo2-7b** (DNA), **mit/boltz2** (protein). Not reachable at the guessed paths: SD 3.5, qwen-image, qwen-image-edit, chatterbox TTS, colabfold MSA — their exact API paths have to come from each build page's snippet.
- These endpoints produce **artifacts, not chat**, so they cannot be pool workers. They are the city's workshops: DSH tool plugins the bots call to produce a PNG, a mesh, a structure.
- Third confirmation that the page's keys are one account: a pasted genomics key answered a chat model normally.

