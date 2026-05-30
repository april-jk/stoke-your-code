import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

type GitCommitRow = {
  day: string
  author: string
  added: number
  deleted: number
}

type Candle = {
  day: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  commits: number
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let data = ''

    request.on('data', (chunk) => {
      data += chunk
    })
    request.on('end', () => resolve(data))
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

function ensureGitRepository(repoPath: string) {
  const absolutePath = path.resolve(repoPath)

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    throw new Error('The provided path does not exist or is not a directory.')
  }

  if (!fs.existsSync(path.join(absolutePath, '.git'))) {
    throw new Error('The provided directory is not a Git repository.')
  }

  return absolutePath
}

function getGitRows(repoPath: string) {
  const output = execFileSync(
    'git',
    [
      'log',
      '--all',
      '--reverse',
      '--date=short',
      '--pretty=format:__COMMIT__%x09%cs%x09%an',
      '--numstat',
      '--no-renames',
    ],
    {
      cwd: repoPath,
      encoding: 'utf8',
    },
  )

  const lines = output.split('\n')
  const rows: GitCommitRow[] = []
  let currentDay = ''
  let currentAuthor = ''
  let currentAdded = 0
  let currentDeleted = 0

  function pushCurrent() {
    if (!currentDay) {
      return
    }

    rows.push({
      day: currentDay,
      author: currentAuthor,
      added: currentAdded,
      deleted: currentDeleted,
    })
  }

  for (const line of lines) {
    if (!line.trim()) {
      continue
    }

    if (line.startsWith('__COMMIT__')) {
      pushCurrent()
      const [, day = '', author = ''] = line.split('\t')
      currentDay = day
      currentAuthor = author
      currentAdded = 0
      currentDeleted = 0
      continue
    }

    const [addedText, deletedText] = line.split('\t')
    const added = Number.parseInt(addedText, 10)
    const deleted = Number.parseInt(deletedText, 10)

    if (Number.isNaN(added) || Number.isNaN(deleted)) {
      continue
    }

    currentAdded += added
    currentDeleted += deleted
  }

  pushCurrent()
  return rows
}

function buildCandles(rows: GitCommitRow[]) {
  const authors = new Set<string>()
  const candles = new Map<string, Candle>()
  let currentLoc = 0

  for (const row of rows) {
    authors.add(row.author)
    const before = currentLoc
    const delta = row.added - row.deleted
    const after = Math.max(0, before + delta)
    currentLoc = after

    const existing = candles.get(row.day)

    if (!existing) {
      candles.set(row.day, {
        day: row.day,
        open: before,
        close: after,
        high: Math.max(before, after),
        low: Math.min(before, after),
        volume: row.added + row.deleted,
        commits: 1,
      })
      continue
    }

    existing.close = after
    existing.high = Math.max(existing.high, before, after)
    existing.low = Math.min(existing.low, before, after)
    existing.volume += row.added + row.deleted
    existing.commits += 1
  }

  const candleList = Array.from(candles.values())

  return {
    authorCount: authors.size,
    latestClose: candleList.at(-1)?.close ?? 0,
    totalVolume: candleList.reduce((sum, candle) => sum + candle.volume, 0),
    candles: candleList,
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    middlewareMode: false,
  },
  appType: 'spa',
  plugins: [
    react(),
    {
      name: 'local-git-analysis-api',
      configureServer(server) {
        server.middlewares.use('/api/analyze', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed.' })
            return
          }

          try {
            const rawBody = await readBody(request)
            const payload = JSON.parse(rawBody) as { repoPath?: string }
            const repoPath = payload.repoPath?.trim()

            if (!repoPath) {
              sendJson(response, 400, {
                error: 'Please provide a local repository path.',
              })
              return
            }

            const absolutePath = ensureGitRepository(repoPath)
            const rows = getGitRows(absolutePath)

            if (rows.length === 0) {
              sendJson(response, 400, {
                error: 'This Git repository has no readable commit history.',
              })
              return
            }

            const analysis = buildCandles(rows)

            sendJson(response, 200, {
              repoPath: absolutePath,
              commitCount: rows.length,
              authorCount: analysis.authorCount,
              latestClose: analysis.latestClose,
              totalVolume: analysis.totalVolume,
              candles: analysis.candles,
            })
          } catch (error) {
            sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to analyze repository.',
            })
          }
        })
      },
    },
  ],
})
