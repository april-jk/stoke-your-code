import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
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

type AnalyzePayload = {
  repoPath?: string
  source?: 'local' | 'github'
  repoUrl?: string
  branch?: string
}

type BranchListPayload = {
  repoUrl?: string
}

type AnalyzeStage =
  | 'validating-local'
  | 'validating-github'
  | 'cloning-github'
  | 'fetching-github'
  | 'checking-out-branch'
  | 'analyzing-history'

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

function runGit(
  args: string[],
  options: {
    cwd?: string
  } = {},
) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd: options.cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 64,
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.trim() || stdout?.trim() || error.message
          reject(new Error(message))
          return
        }

        resolve(stdout)
      },
    )
  })
}

function parseGitHubUrl(repoUrl: string) {
  let parsed: URL

  try {
    parsed = new URL(repoUrl)
  } catch {
    throw new Error('Please provide a valid GitHub repository URL.')
  }

  if (parsed.hostname !== 'github.com') {
    throw new Error('Only github.com repository URLs are supported in this mode.')
  }

  const segments = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean)

  if (segments.length < 2) {
    throw new Error('GitHub repository URL must look like https://github.com/owner/repo.')
  }

  const owner = segments[0]
  const repo = segments[1].replace(/\.git$/, '')

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  }
}

function ensureRemoteCacheDir() {
  const cacheDir = path.resolve('.cache/remote-repos')
  fs.mkdirSync(cacheDir, { recursive: true })
  return cacheDir
}

async function listGitHubBranches(repoUrl: string) {
  const { cloneUrl } = parseGitHubUrl(repoUrl)
  const output = await runGit(['ls-remote', '--symref', '--heads', cloneUrl])
  const branches = new Set<string>()
  let defaultBranch = ''

  for (const line of output.split('\n')) {
    if (!line.trim()) {
      continue
    }

    if (line.startsWith('ref: ')) {
      const match = line.match(/^ref:\s+refs\/heads\/(.+?)\s+HEAD$/)
      if (match?.[1]) {
        defaultBranch = match[1]
      }
      continue
    }

    const match = line.match(/\s+refs\/heads\/(.+)$/)
    if (match?.[1]) {
      branches.add(match[1])
    }
  }

  const sortedBranches = Array.from(branches).sort((left, right) => {
    if (left === defaultBranch) {
      return -1
    }

    if (right === defaultBranch) {
      return 1
    }

    return left.localeCompare(right)
  })

  return {
    defaultBranch,
    branches: sortedBranches,
  }
}

async function ensureGitHubRepository(
  repoUrl: string,
  branch: string | undefined,
  onStage: (stage: AnalyzeStage) => void,
) {
  const { owner, repo, cloneUrl } = parseGitHubUrl(repoUrl)
  const cacheDir = ensureRemoteCacheDir()
  const repoDir = path.join(cacheDir, `github.com_${owner}_${repo}`)

  if (!fs.existsSync(repoDir)) {
    onStage('cloning-github')
    await runGit(['clone', '--no-tags', cloneUrl, repoDir])
  } else {
    onStage('fetching-github')
    await runGit(['fetch', '--all', '--prune'], {
      cwd: repoDir,
    })
  }

  const requestedBranch = branch?.trim()

  if (requestedBranch) {
    onStage('checking-out-branch')
    await runGit(['checkout', requestedBranch], {
      cwd: repoDir,
    })
    await runGit(['pull', '--ff-only', 'origin', requestedBranch], {
      cwd: repoDir,
    })
  } else {
    const defaultBranch = (await runGit(
      ['rev-parse', '--abbrev-ref', 'origin/HEAD'],
      {
        cwd: repoDir,
      },
    ))
      .trim()
      .replace(/^origin\//, '')

    onStage('checking-out-branch')
    await runGit(['checkout', defaultBranch], {
      cwd: repoDir,
    })
    await runGit(['pull', '--ff-only', 'origin', defaultBranch], {
      cwd: repoDir,
    })
  }

  return {
    repoPath: repoDir,
    displayName: `${owner}/${repo}`,
    source: 'github' as const,
  }
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

async function getGitRows(repoPath: string) {
  const output = await runGit(
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

  const candleList = Array.from(candles.values()).sort((left, right) =>
    left.day.localeCompare(right.day),
  )

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
        server.middlewares.use('/api/github-branches', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed.' })
            return
          }

          try {
            const rawBody = await readBody(request)
            const payload = JSON.parse(rawBody) as BranchListPayload
            const repoUrl = payload.repoUrl?.trim()

            if (!repoUrl) {
              sendJson(response, 400, {
                error: 'Please provide a GitHub repository URL.',
              })
              return
            }

            const branchData = await listGitHubBranches(repoUrl)

            sendJson(response, 200, branchData)
          } catch (error) {
            sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load GitHub branches.',
            })
          }
        })

        server.middlewares.use('/api/analyze', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed.' })
            return
          }

          try {
            const rawBody = await readBody(request)
            const payload = JSON.parse(rawBody) as AnalyzePayload
            const source = payload.source ?? 'local'
            const stages: AnalyzeStage[] = []

            let absolutePath = ''
            let displayName = ''

            if (source === 'github') {
              stages.push('validating-github')
              const repoUrl = payload.repoUrl?.trim()

              if (!repoUrl) {
                sendJson(response, 400, {
                  error: 'Please provide a GitHub repository URL.',
                })
                return
              }

              const remoteRepo = await ensureGitHubRepository(
                repoUrl,
                payload.branch,
                (stage) => stages.push(stage),
              )
              absolutePath = remoteRepo.repoPath
              displayName = remoteRepo.displayName
            } else {
              stages.push('validating-local')
              const repoPath = payload.repoPath?.trim()

              if (!repoPath) {
                sendJson(response, 400, {
                  error: 'Please provide a local repository path.',
                })
                return
              }

              absolutePath = ensureGitRepository(repoPath)
              displayName = absolutePath
            }

            stages.push('analyzing-history')
            const rows = await getGitRows(absolutePath)

            if (rows.length === 0) {
              sendJson(response, 400, {
                error: 'This Git repository has no readable commit history.',
              })
              return
            }

            const analysis = buildCandles(rows)

            sendJson(response, 200, {
              repoPath: absolutePath,
              displayName,
              source,
              stages,
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
