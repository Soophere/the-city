/**
 * NVIDIA model census — the city's timesheet.
 *
 * Probes every model the account lists and records, per model: whether it is
 * alive, whether it answers with text, how long it takes to the first word and
 * to the last, and how much it thinks before answering. Results are appended to
 * census.jsonl as they arrive (so a long run is resumable) and folded into
 * roster.json for dispatchers to read.
 *
 * Usage:  NVIDIA_API_KEY=... CITY_DIR=... node census.mjs
 * Env:    CENSUS_CAP_MS   per-model patience in ms (default 300000)
 *         CENSUS_ONLY     comma-separated model ids to probe (default: all)
 *         CENSUS_GAP_MS   pause between models in ms (default 1200)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const cityDir = process.env.CITY_DIR ?? '.'
const key = process.env.NVIDIA_API_KEY
if (key === undefined || key.length === 0) throw new Error('NVIDIA_API_KEY is required')
if (!existsSync(cityDir)) mkdirSync(cityDir, { recursive: true })

const base = 'https://integrate.api.nvidia.com/v1'
const capMs = Number(process.env.CENSUS_CAP_MS ?? 300_000)
const gapMs = Number(process.env.CENSUS_GAP_MS ?? 1_200)
const censusPath = join(cityDir, 'census.jsonl')
const rosterPath = join(cityDir, 'roster.json')
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'NVCF-POLL-SECONDS': '3600' }

/** Every model id the account's catalog lists. */
async function listModels() {
  const response = await fetch(`${base}/models`, { headers })
  if (!response.ok) throw new Error(`model list failed: HTTP ${response.status}`)
  const body = await response.json()
  return body.data.map(entry => entry.id).sort()
}

/** Classify a failure so the roster can tell "gone" from "not yours" from "busy". */
function classify(status, body) {
  const text = body.replace(/\s+/g, ' ')
  if (status === 410) return { status: 'end-of-life', detail: text.slice(0, 140) }
  if (status === 404) return { status: 'not-entitled', detail: text.slice(0, 140) }
  if (status === 429 || /ResourceExhausted|rate limit/i.test(text)) return { status: 'throttled', detail: text.slice(0, 140) }
  if (status === 401 || status === 403) return { status: 'unauthorized', detail: text.slice(0, 140) }
  return { status: 'http-error', detail: `HTTP ${status} ${text.slice(0, 120)}` }
}

/** One probe: trivial prompt, streaming, measured to the millisecond. */
async function probe(model) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), capMs)
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 64, stream: true }),
    })
    const headersMs = Date.now() - started
    if (!response.ok) return { model, ...classify(response.status, await response.text()), headersMs, probedAt: Date.now() }

    let firstTextMs = null, totalMs = null, content = '', reasoning = 0
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') continue
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta
          if (delta?.reasoning_content) reasoning += delta.reasoning_content.length
          if (delta?.content) { firstTextMs ??= Date.now() - started; content += delta.content }
        } catch { /* a keep-alive or partial line: nothing to record */ }
      }
    }
    totalMs = Date.now() - started
    const status = content.trim().length === 0 ? 'empty-answer' : 'ok'
    return { model, status, headersMs, firstTextMs, totalMs, reasoningChars: reasoning, sample: content.trim().slice(0, 60), probedAt: Date.now() }
  } catch (error) {
    const message = error?.message ?? String(error)
    const timedOut = controller.signal.aborted
    return { model, status: timedOut ? 'slow' : 'transport-error', headersMs: Date.now() - started, detail: `${message}${timedOut ? ` (still silent after ${capMs}ms)` : ''}`, probedAt: Date.now() }
  } finally { clearTimeout(timer) }
}

/** Probe once, and once more after a pause when the account was merely busy. */
async function probeWithRetry(model) {
  const first = await probe(model)
  if (first.status !== 'throttled') return first
  process.stdout.write(`${model}: throttled, waiting 20s\n`)
  await new Promise(resolve => setTimeout(resolve, 20_000))
  return await probe(model)
}

const alreadyProbed = new Set()
if (existsSync(censusPath)) {
  for (const line of readFileSync(censusPath, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue
    try { alreadyProbed.add(JSON.parse(line).model) } catch { /* an interrupted write: probe it again */ }
  }
}

const only = process.env.CENSUS_ONLY?.split(',').map(id => id.trim()).filter(Boolean)
const force = process.env.CENSUS_FORCE === '1'
const listed = await listModels()
const queue = (only ?? listed).filter(id => force || !alreadyProbed.has(id))
process.stdout.write(`city census: ${listed.length} models listed, ${queue.length} to probe, patience ${capMs}ms each\n`)
writeFileSync(join(cityDir, 'catalog.json'), `${JSON.stringify(listed, null, 2)}\n`)

for (const [index, model] of queue.entries()) {
  const result = await probeWithRetry(model)
  appendFileSync(censusPath, `${JSON.stringify(result)}\n`)
  const timing = result.status === 'ok' ? `first=${result.firstTextMs}ms total=${result.totalMs}ms` : (result.detail ?? '')
  process.stdout.write(`[${index + 1}/${queue.length}] ${model}: ${result.status} ${timing}\n`)

  const all = readFileSync(censusPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
  // A re-probe appends, so the newest verdict for a model is the one that counts.
  const latest = new Map()
  for (const entry of all) latest.set(entry.model, entry)
  const folded = [...latest.values()]
  const byStatus = {}
  for (const entry of folded) byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1
  writeFileSync(rosterPath, `${JSON.stringify({
    updatedAt: new Date().toISOString(),
    patienceMs: capMs,
    listed: listed.length,
    probed: folded.length,
    byStatus,
    workers: folded.map(entry => ({
      id: entry.model,
      status: entry.status,
      firstTextMs: entry.firstTextMs ?? null,
      totalMs: entry.totalMs ?? null,
      reasoningChars: entry.reasoningChars ?? 0,
      detail: entry.detail ?? null,
    })).sort((a, b) => (a.totalMs ?? Number.MAX_SAFE_INTEGER) - (b.totalMs ?? Number.MAX_SAFE_INTEGER)),
  }, null, 2)}\n`)

  await new Promise(resolve => setTimeout(resolve, gapMs))
}

process.stdout.write('city census: done\n')
