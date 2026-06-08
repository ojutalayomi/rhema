/**
 * Downloads the Whisper large-v3-turbo Q8_0 GGML model for local speech-to-text.
 *
 * Model: ggml-large-v3-turbo-q8_0.bin (~874MB)
 * Source: https://huggingface.co/ggerganov/whisper.cpp
 *
 * Run: bun run download:whisper
 *
 * Uses `curl` for the actual transfer because it streams directly to disk,
 * resumes interrupted downloads with `-C -`, and retries transient failures —
 * which avoids the in-process buffering issues that crash large fetch() calls.
 */

import { join } from "node:path"
import { existsSync, mkdirSync, renameSync } from "node:fs"

const PROJECT_ROOT = join(import.meta.dir, "..")
const MODELS_DIR = join(PROJECT_ROOT, "models", "whisper")
const MODEL_FILE = "ggml-large-v3-turbo-q8_0.bin"
const MODEL_PATH = join(MODELS_DIR, MODEL_FILE)
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`

async function main() {
  if (existsSync(MODEL_PATH)) {
    console.log(`Whisper model already exists: ${MODEL_PATH}`)
    return
  }

  mkdirSync(MODELS_DIR, { recursive: true })

  const tmpPath = MODEL_PATH + ".tmp"

  console.log(`Downloading Whisper model from ${MODEL_URL}`)
  console.log(`Destination: ${MODEL_PATH}`)

  const args = [
    "--location",
    "--fail",
    "--retry", "10",
    "--retry-delay", "2",
    "--retry-connrefused",
    "--continue-at", "-",
    "--progress-bar",
    "--output", tmpPath,
    MODEL_URL,
  ]

  const proc = Bun.spawn(["curl", ...args], {
    stdout: "inherit",
    stderr: "inherit",
  })

  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`curl exited with code ${code}`)
  }

  renameSync(tmpPath, MODEL_PATH)
  console.log(`\nWhisper model downloaded: ${MODEL_PATH}`)
}

main().catch((e) => {
  console.error("Failed to download Whisper model:", e)
  process.exit(1)
})
