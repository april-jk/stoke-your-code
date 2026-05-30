import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'

const base = process.env.GITHUB_PAGES === 'true' ? '/stoke-your-code/' : '/'

type GitCommitRow = {
  timestamp: number
  isoTime: string
  author: string
  added: number
  deleted: number
}

type Candle = {
  timestamp: number
  isoTime: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  commits: number
}

type AnalysisSummary = {
  authorCount: number
  latestClose: number
  totalVolume: number
  commitEvents: Candle[]
}

type AnalyzePayload = {
  repoPath?: string
  source?: 'local' | 'github'
  repoUrl?: string
  branch?: string
}

type BranchListPayload = {
  repoPath?: string
  source?: 'local' | 'github'
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

async function listLocalBranches(repoPath: string) {
  const absolutePath = ensureGitRepository(repoPath)
  const branchOutput = await runGit(
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
    {
      cwd: absolutePath,
    },
  )
  const currentBranch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: absolutePath,
  })).trim()

  const branches = branchOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const sortedBranches = Array.from(new Set(branches)).sort((left, right) => {
    if (left === currentBranch) {
      return -1
    }

    if (right === currentBranch) {
      return 1
    }

    return left.localeCompare(right)
  })

  return {
    defaultBranch: currentBranch === 'HEAD' ? '' : currentBranch,
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
    branch: requestedBranch,
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

async function getGitRows(repoPath: string, branch?: string) {
  const args = [
    'log',
    '--reverse',
    '--date=iso-strict',
    '--pretty=format:__COMMIT__%x09%ct%x09%cI%x09%an',
    '--numstat',
    '--no-renames',
  ]

  if (branch?.trim()) {
    args.push(branch.trim())
  } else {
    args.splice(1, 0, '--all')
  }

  const output = await runGit(args, {
    cwd: repoPath,
  })

  const lines = output.split('\n')
  const rows: GitCommitRow[] = []
  let currentTimestamp = 0
  let currentIsoTime = ''
  let currentAuthor = ''
  let currentAdded = 0
  let currentDeleted = 0

  function pushCurrent() {
    if (!currentTimestamp || !currentIsoTime) {
      return
    }

    rows.push({
      timestamp: currentTimestamp,
      isoTime: currentIsoTime,
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
      const [, timestampText = '0', isoTime = '', author = ''] = line.split('\t')
      currentTimestamp = Number.parseInt(timestampText, 10)
      currentIsoTime = isoTime
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

function buildAnalysis(rows: GitCommitRow[]): AnalysisSummary {
  const authors = new Set<string>()
  const commitEvents: Candle[] = []
  let currentLoc = 0

  for (const row of rows) {
    authors.add(row.author)
    const before = currentLoc
    const delta = row.added - row.deleted
    const after = Math.max(0, before + delta)
    currentLoc = after
    commitEvents.push({
      timestamp: row.timestamp,
      isoTime: row.isoTime,
      open: before,
      close: after,
      high: Math.max(before, after),
      low: Math.min(before, after),
      volume: row.added + row.deleted,
      commits: 1,
    })
  }

  return {
    authorCount: authors.size,
    latestClose: commitEvents.at(-1)?.close ?? 0,
    totalVolume: commitEvents.reduce((sum, candle) => sum + candle.volume, 0),
    commitEvents,
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  server: {
    middlewareMode: false,
  },
  appType: 'spa',
  plugins: [
    react(),
    {
      name: 'local-git-analysis-api',
      configureServer(server) {
        server.middlewares.use('/api/repo-branches', async (request, response) => {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed.' })
            return
          }

          try {
            const rawBody = await readBody(request)
            const payload = JSON.parse(rawBody) as BranchListPayload
            const source = payload.source ?? 'local'
            const branchData =
              source === 'github'
                ? await listGitHubBranches(payload.repoUrl?.trim() ?? '')
                : await listLocalBranches(payload.repoPath?.trim() ?? '')

            sendJson(response, 200, branchData)
          } catch (error) {
            sendJson(response, 400, {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to load repository branches.',
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
            let selectedBranch = payload.branch?.trim() ?? ''
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
              selectedBranch = remoteRepo.branch ?? selectedBranch
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
            const rows = await getGitRows(absolutePath, selectedBranch)

            if (rows.length === 0) {
              sendJson(response, 400, {
                error: 'This Git repository has no readable commit history.',
              })
              return
            }

            const analysis = buildAnalysis(rows)

            sendJson(response, 200, {
              repoPath: absolutePath,
              displayName,
              source,
              stages,
              commitCount: rows.length,
              authorCount: analysis.authorCount,
              latestClose: analysis.latestClose,
              totalVolume: analysis.totalVolume,
              commitEvents: analysis.commitEvents,
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
