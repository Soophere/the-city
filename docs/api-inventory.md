# API inventory — everything handed over, with verdicts

Every endpoint below was tested against this account. "Verdict" is measured, not copied from
a marketing page. Links are the build pages the owner supplied (or the NVIDIA catalog page
for models found by the census).

Chat endpoints all share one base: `https://integrate.api.nvidia.com/v1/chat/completions`
with one account key, so no per-model key is needed.

---

## 1. Chat models that work (pool workers — 17)

| Model id | What it is | Link | Measured |
|---|---|---|---|
| `nvidia/nemotron-parse-2.0` | document parsing / extraction | [catalog](https://build.nvidia.com/models) | 371 ms |
| `nvidia/nemotron-3.5-content-safety` | content-safety classifier | [catalog](https://build.nvidia.com/models) | 435 ms |
| `poolside/laguna-xs-2.1` | small code-focused chat model | <https://build.nvidia.com/poolside/laguna-xs-2.1> | 470 ms |
| `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` | safety guardrail | <https://build.nvidia.com/nvidia/llama-3_1-nemotron-safety-guard-8b-v3> | 475 ms |
| `nvidia/riva-translate-4b-instruct-v2` | translation | [catalog](https://build.nvidia.com/models) | 477 ms |
| `nvidia/riva-translate-4b-instruct-v1.1` | translation | [catalog](https://build.nvidia.com/models) | 687 ms |
| `nvidia/nemotron-3-super-120b-a12b` | general reasoning chat | <https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b> | 873 ms |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | omni (text + image in) | <https://build.nvidia.com/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning> | 1 479 ms |
| `openai/gpt-oss-20b` | open-weight GPT chat | <https://build.nvidia.com/openai/gpt-oss-20b> | 1 533 ms |
| `mistralai/mistral-nemotron` | Mistral-based general chat | [catalog](https://build.nvidia.com/models) | 2 163 ms |
| `meta/llama-3.2-11b-vision-instruct` | vision + text | [catalog](https://build.nvidia.com/models) | 3 510 ms |
| `nvidia/nemotron-3-ultra-550b-a55b` | largest Nemotron chat | <https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b> | 6 439 ms |
| `nvidia/ising-calibration-1.5-31b` | quantum qubit calibration (reads plots) | <https://build.nvidia.com/nvidia/ising-calibration-1.5-31b> | 8 328 ms |
| `deepseek-ai/deepseek-v4-flash-0731` | DeepSeek V4 Flash snapshot | <https://build.nvidia.com/deepseek-ai/deepseek-v4-flash-0731> | 88 s |
| `z-ai/glm-5.3-flash` | GLM-5.3 fast variant | [catalog](https://build.nvidia.com/models) | 106 s |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | lightweight reasoning chat | [catalog](https://build.nvidia.com/models) | 144 s |
| `moonshotai/kimi-k3` | Kimi K3 long-context chat | [catalog](https://build.nvidia.com/models) | 247 s |

## 2. Chat models that did not survive probing

| Model id | Verdict | Link |
|---|---|---|
| `z-ai/glm-5.3` | drops the connection (has answered at 88–429 s); kept as a flaky `thinker` | <https://build.nvidia.com/z-ai/glm-5-3> |
| `google/gemma-4-31b-it` | silent past 10 min, then dropped | <https://build.nvidia.com/google/gemma-4-31b-it> |
| `meta/llama-3.2-90b-vision-instruct` | dropped connection | [catalog](https://build.nvidia.com/models) |
| `google/diffusiongemma-26b-a4b-it` | answers with no text | <https://build.nvidia.com/google/diffusiongemma-26b-a4b-it> |
| `nvidia/llama-3.1-nemoguard-8b-topic-control` | answers with no text | [catalog](https://build.nvidia.com/models) |
| `meta/muse-glimmer-30b` | answers with no text | [catalog](https://build.nvidia.com/models) |
| `meta/llama-guard-4-12b`, `nvidia/llama-3.1-nemoguard-8b-content-safety` | silent past 10 min | [catalog](https://build.nvidia.com/models) |
| `nvidia/nemotron-parse` | HTTP 400 — needs a document, not plain text | [catalog](https://build.nvidia.com/models) |
| `nvidia/ai-synthetic-video-detector` | HTTP 500 | [catalog](https://build.nvidia.com/models) |

## 3. Artifact endpoints — the workshops (not chat, they produce files)

Reachability test: a request with an empty body returning **HTTP 422** means entitled and
alive (it names the missing field); **404** means the path is wrong or unavailable.

| Endpoint | Produces | API path | Verdict |
|---|---|---|---|
| `black-forest-labs/flux.1-dev` | images | `https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev` | ✅ needs `prompt` |
| `microsoft/trellis` | 3D meshes | `https://ai.api.nvidia.com/v1/genai/microsoft/trellis` | ✅ needs `image` or `prompt` — <https://build.nvidia.com/microsoft/trellis> |
| `arc/evo2-40b`, `arc/evo2-7b` | DNA sequence completion | `https://health.api.nvidia.com/v1/biology/arc/evo2-40b/generate` | ✅ needs `sequence` — <https://build.nvidia.com/arc/evo2-40b> · <https://build.nvidia.com/arc/evo2-7b-forward> |
| `mit/boltz2` | protein structure (PDB) | `https://health.api.nvidia.com/v1/biology/mit/boltz2/predict` | ✅ needs `polymers` — <https://build.nvidia.com/mit/boltz2> |
| `colabfold/msa-search` | protein MSA search | — | ❌ 404 at the guessed path — <https://build.nvidia.com/colabfold/msa-search> |
| `stabilityai/stable-diffusion-3_5-large` | images | — | ❌ 404 at both spellings — <https://build.nvidia.com/stabilityai/stable-diffusion-3_5-large> |
| `qwen/qwen-image`, `qwen/qwen-image-edit` | images / image editing | — | ❌ 404 at guessed paths — <https://build.nvidia.com/qwen/qwen-image> · <https://build.nvidia.com/qwen/qwen-image-edit> |
| `resembleai/chatterbox-multilingual-tts` | speech audio | — | ❌ 404 at guessed paths — <https://build.nvidia.com/resembleai/chatterbox-multilingual-tts> |
| `nvidia/kumo-relational` | tabular predictions | `https://ai.api.nvidia.com/v1/structured-data/nvidia/kumo-relational/predictions` | ⚠️ not tested (needs a full schema payload) — <https://build.nvidia.com/nvidia/kumo-relational> |

For the ❌ rows, the exact API path comes from the build page's own snippet; rebuild the
request from that snippet and the path is pinned.

## 4. Keys

- Roughly twenty keys were handed over, one per model page.
- **They all belong to one account**: every one lists the identical 82-model catalog, and keys
  used cross-model still answer (verified three separate times, e.g. a genomics key calling
  `openai/gpt-oss-20b` → HTTP 200).
- Therefore **one** key is stored, as `NVIDIA_API_KEY`; the local proxy holds its own
  `CITY_PROXY_KEY`. Copies of the same account key add no capacity.
- More capacity comes from more free *providers* (Groq, Google AI Studio, OpenRouter `:free`,
  Cerebras, Mistral, Cloudflare Workers AI, GitHub Models) — each free, each its own quota.

## 5. The entitlement wall

55 of the 82 listed chat models answer `404 Function '<uuid>': Not found for account '<id>'`.
Listing a model on the catalog page does not mean this account may run it. The roster
(`roster.json`) is the authority; the catalog page is not.
