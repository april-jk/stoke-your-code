import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type MockCandle = {
  day: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

type AnalysisCandle = {
  day: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  commits: number
}

type AnalysisResponse = {
  repoPath: string
  commitCount: number
  authorCount: number
  latestClose: number
  totalVolume: number
  candles: AnalysisCandle[]
}

type AnalysisError = {
  error?: string
}

const landingCandles: MockCandle[] = [
  { day: '05.03', open: 42, close: 68, high: 79, low: 34, volume: 28 },
  { day: '05.06', open: 68, close: 61, high: 82, low: 52, volume: 16 },
  { day: '05.09', open: 61, close: 92, high: 97, low: 58, volume: 31 },
  { day: '05.12', open: 92, close: 88, high: 104, low: 73, volume: 20 },
  { day: '05.15', open: 88, close: 126, high: 132, low: 84, volume: 37 },
  { day: '05.18', open: 126, close: 119, high: 141, low: 110, volume: 24 },
  { day: '05.21', open: 119, close: 151, high: 168, low: 117, volume: 41 },
  { day: '05.24', open: 151, close: 147, high: 176, low: 139, volume: 22 },
]

const landingMetrics = [
  { label: 'Daily candle', value: 'OHLC from LOC', tone: 'neutral' },
  { label: 'Volume', value: 'added + deleted', tone: 'neutral' },
  { label: 'Repo source', value: 'local Git only', tone: 'positive' },
  { label: 'Interaction', value: 'open and understand', tone: 'warning' },
]

const phases = [
  'Import a local repository',
  'Read commit history day by day',
  'Convert churn into candles',
  'Show the project trend at a glance',
]

function formatCompact(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)
}

function Chart({
  candles,
  metricLabel = 'LOC',
  annotate = false,
}: {
  candles: MockCandle[] | AnalysisCandle[]
  metricLabel?: string
  annotate?: boolean
}) {
  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)
  const volumes = candles.map((candle) => candle.volume)
  const top = Math.max(...highs, 1)
  const bottom = Math.min(...lows, 0)
  const range = Math.max(top - bottom, 1)
  const maxVolume = Math.max(...volumes, 1)

  const priceTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    return Math.round(top - ratio * range)
  })

  return (
    <div className="chart-stage">
      <div className="chart-grid" />
      <div className="price-scale">
        {priceTicks.map((tick) => (
          <span key={tick}>
            {formatCompact(tick)}
            {metricLabel}
          </span>
        ))}
      </div>

      <div className="candles">
        {candles.map((candle) => {
          const bodyLow = Math.min(candle.open, candle.close)
          const bodyHigh = Math.max(candle.open, candle.close)
          const bodyBottom = ((bodyLow - bottom) / range) * 100
          const bodyHeight = Math.max(((bodyHigh - bodyLow) / range) * 100, 3.5)
          const wickBottom = ((candle.low - bottom) / range) * 100
          const wickHeight = Math.max(((candle.high - candle.low) / range) * 100, 5)
          const volumeHeight = Math.max((candle.volume / maxVolume) * 100, 5)
          const tone = candle.close >= candle.open ? 'up' : 'down'

          return (
            <div className="candle-column" key={candle.day}>
              <div className="price-zone">
                <div
                  className={`wick ${tone}`}
                  style={{
                    height: `${wickHeight}%`,
                    bottom: `${wickBottom}%`,
                  }}
                />
                <div
                  className={`body ${tone}`}
                  style={{
                    height: `${bodyHeight}%`,
                    bottom: `${bodyBottom}%`,
                  }}
                />
              </div>
              <div className="volume-zone">
                <div
                  className={`volume-bar ${tone}`}
                  style={{ height: `${volumeHeight}%` }}
                />
              </div>
              <span className="day-label">{candle.day}</span>
            </div>
          )
        })}
      </div>

      {annotate ? (
        <>
          <div className="annotation annotation-left">
            <span className="annotation-title">Open</span>
            <span>codebase starts the day here</span>
          </div>
          <div className="annotation annotation-right">
            <span className="annotation-title">Volume</span>
            <span>added + deleted lines</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

function LandingPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <p className="brand">STOKE YOUR CODE</p>
        <p className="status">LOCAL REPO VISUALIZATION / K-LINE PROTOTYPE</p>
      </header>

      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">Read a codebase like a market chart</p>
          <h1>
            Turn Git history into a daily candlestick that makes code change
            obvious.
          </h1>
          <p className="summary">
            Stoke Your Code takes a local repository, extracts its day-by-day
            churn, and renders the project as a K-line. No commit archaeology,
            no dashboard maze, just one glance and the story is there.
          </p>

          <div className="terminal-callout" aria-label="repository input preview">
            <span className="prompt">$</span>
            <span className="command">stoke-your-code ~/projects/my-repo</span>
            <span className="tag">LOCAL</span>
          </div>

          <div className="hero-actions">
            <a className="primary-link" href="/analyze">
              Open analysis page
            </a>
            <p className="action-note">
              Jump straight into a real local Git repository.
            </p>
          </div>

          <div className="hero-note">
            <strong>Core principle:</strong> the page should explain itself
            before the user touches anything.
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-header">
            <div>
              <p className="panel-label">REPOSITORY CANDLE TAPE</p>
              <h2>Daily code movement</h2>
            </div>
            <div className="panel-stats">
              <span>LOC CLOSE 151K</span>
              <span className="positive">+27.1%</span>
            </div>
          </div>

          <Chart candles={landingCandles} annotate metricLabel="k" />
        </div>
      </section>

      <section className="metric-strip">
        {landingMetrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <p className="metric-label">{metric.label}</p>
            <p className={`metric-value ${metric.tone}`}>{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="story-grid">
        <div className="story-block">
          <p className="panel-label">WHY IT CLICKS</p>
          <h3>One chart tells the story faster than a commit list ever can.</h3>
          <p>
            Green candles mean the codebase expanded. Red candles mean it was
            reduced or rewritten. Long wicks show intraday volatility across
            commits. Volume bars show how much work actually moved.
          </p>
        </div>

        <div className="story-block">
          <p className="panel-label">WHAT THE USER DOES</p>
          <h3>Almost nothing.</h3>
          <p>
            Point the tool at a local repository, let it parse Git history, and
            the explanation is already on screen. This first version is designed
            to be legible before it becomes interactive.
          </p>
        </div>
      </section>

      <section className="timeline-panel">
        <p className="panel-label">PIPELINE</p>
        <div className="timeline">
          {phases.map((phase, index) => (
            <div className="timeline-step" key={phase}>
              <span className="timeline-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p>{phase}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function AnalysisPage() {
  const [repoPath, setRepoPath] = useState('/Users/watson/codingProj/stoke-your-code')
  const [data, setData] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const latestCandle = data?.candles.at(-1) ?? null
  const trend =
    latestCandle && latestCandle.open !== 0
      ? ((latestCandle.close - latestCandle.open) / Math.abs(latestCandle.open)) * 100
      : null

  const metricCards = useMemo(() => {
    if (!data || !latestCandle) {
      return []
    }

    return [
      { label: 'Commit days', value: String(data.candles.length), tone: 'neutral' },
      { label: 'Total commits', value: String(data.commitCount), tone: 'neutral' },
      { label: 'Active authors', value: String(data.authorCount), tone: 'neutral' },
      {
        label: 'Latest close',
        value: `${formatCompact(data.latestClose)} LOC`,
        tone: latestCandle.close >= latestCandle.open ? 'positive' : 'negative',
      },
      {
        label: 'Latest session',
        value: trend === null ? 'n/a' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`,
        tone: trend !== null && trend >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Total volume',
        value: formatCompact(data.totalVolume),
        tone: 'warning',
      },
    ]
  }, [data, latestCandle, trend])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath }),
      })

      const payload = (await response.json()) as AnalysisResponse | AnalysisError

      if (!response.ok) {
        throw new Error(
          'error' in payload ? payload.error ?? 'Failed to analyze repository' : 'Failed to analyze repository',
        )
      }

      setData(payload as AnalysisResponse)
    } catch (submitError) {
      setData(null)
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to analyze repository',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell analysis-shell">
      <header className="topbar">
        <p className="brand">STOKE YOUR CODE / ANALYZE</p>
        <a className="back-link" href="/">
          Back to landing page
        </a>
      </header>

      <section className="analysis-hero">
        <div className="analysis-copy">
          <p className="eyebrow">Local Git repository analysis</p>
          <h1>Feed in a repo path, render the real candle tape.</h1>
          <p className="summary">
            This page validates that the directory exists and contains a Git
            repository, then converts commit history into daily open, high, low,
            close, and volume values.
          </p>
        </div>

        <form className="repo-form" onSubmit={handleSubmit}>
          <label className="repo-label" htmlFor="repo-path">
            Local directory path
          </label>
          <input
            id="repo-path"
            className="repo-input"
            type="text"
            value={repoPath}
            onChange={(event) => setRepoPath(event.target.value)}
            placeholder="/absolute/path/to/a/git/repository"
            spellCheck={false}
          />
          <button className="primary-link button-link" type="submit" disabled={loading}>
            {loading ? 'Analyzing repository...' : 'Analyze repository'}
          </button>
          <p className="repo-hint">
            The path must be local and must contain a `.git` directory.
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
        </form>
      </section>

      {data ? (
        <>
          <section className="analysis-summary">
            <div className="summary-panel">
              <p className="panel-label">ANALYZED REPOSITORY</p>
              <h2>{data.repoPath}</h2>
            </div>
            <div className="metric-strip metric-strip-wide">
              {metricCards.map((metric) => (
                <article className="metric" key={metric.label}>
                  <p className="metric-label">{metric.label}</p>
                  <p className={`metric-value ${metric.tone}`}>{metric.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="chart-panel">
            <div className="chart-header">
              <div>
                <p className="panel-label">REAL GIT OUTPUT</p>
                <h2>Daily OHLC from commit history</h2>
              </div>
              <div className="panel-stats">
                <span>{data.candles.length} trading days of code</span>
                <span className={trend !== null && trend >= 0 ? 'positive' : 'negative'}>
                  {trend === null ? 'n/a' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`}
                </span>
              </div>
            </div>

            <Chart candles={data.candles} metricLabel="" />
          </section>
        </>
      ) : (
        <section className="empty-analysis">
          <p className="panel-label">READY</p>
          <h2>No repository loaded yet.</h2>
          <p>
            Enter a local Git path above and this page will replace the placeholder
            story with real daily candles.
          </p>
        </section>
      )}
    </main>
  )
}

function App() {
  return window.location.pathname === '/analyze' ? (
    <AnalysisPage />
  ) : (
    <LandingPage />
  )
}

export default App
