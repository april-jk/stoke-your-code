import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  type BusinessDay,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
} from 'lightweight-charts'
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
  displayName: string
  source: 'local' | 'github'
  stages?: string[]
  commitCount: number
  authorCount: number
  latestClose: number
  totalVolume: number
  candles: AnalysisCandle[]
}

type AnalysisError = {
  error?: string
}

type HoverSnapshot = {
  day: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  commits: number
}

type RepoSourceMode = 'local' | 'github'

function describeAnalyzeStage(stage: string, sourceMode: RepoSourceMode) {
  switch (stage) {
    case 'validating-local':
      return 'Validating local repository path...'
    case 'validating-github':
      return 'Validating GitHub repository URL...'
    case 'cloning-github':
      return 'Cloning GitHub repository into local cache...'
    case 'fetching-github':
      return 'Fetching latest changes from GitHub...'
    case 'checking-out-branch':
      return 'Checking out target branch...'
    case 'analyzing-history':
      return sourceMode === 'github'
        ? 'Analyzing cloned repository history...'
        : 'Analyzing local repository history...'
    default:
      return 'Analyzing repository...'
  }
}

function toBusinessDay(day: string): BusinessDay {
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10))

  return {
    year,
    month,
    day: date,
  }
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

function formatChartTime(
  time: string | number | { year: number; month: number; day: number } | undefined,
) {
  if (!time) {
    return null
  }

  if (typeof time === 'string') {
    return time
  }

  if (typeof time === 'number') {
    return new Date(time * 1000).toISOString().slice(0, 10)
  }

  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
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

function GitChart({
  candles,
  onHover,
  overlay,
}: {
  candles: AnalysisCandle[]
  onHover: (snapshot: HoverSnapshot | null) => void
  overlay: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container || candles.length === 0) {
      return
    }

    const chart = createChart(container, {
      width: Math.max(container.clientWidth, 320),
      height: Math.max(container.clientHeight, 320),
      layout: {
        background: { type: ColorType.Solid, color: '#0b1117' },
        textColor: '#8f9aa5',
      },
      grid: {
        vertLines: { color: 'rgba(143, 154, 165, 0.09)' },
        horzLines: { color: 'rgba(143, 154, 165, 0.09)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(143, 154, 165, 0.18)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(143, 154, 165, 0.18)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: 'rgba(197, 161, 96, 0.35)',
          labelBackgroundColor: '#5f4a1f',
        },
        horzLine: {
          color: 'rgba(197, 161, 96, 0.35)',
          labelBackgroundColor: '#5f4a1f',
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#37c978',
      downColor: '#e05a57',
      wickUpColor: '#37c978',
      wickDownColor: '#e05a57',
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      },
    )

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.78,
        bottom: 0,
      },
    })

    candleSeries.setData(
      candles.map((candle) => ({
        time: toBusinessDay(candle.day),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    )

    volumeSeries.setData(
      candles.map((candle) => ({
        time: toBusinessDay(candle.day),
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? 'rgba(55, 201, 120, 0.45)'
            : 'rgba(224, 90, 87, 0.45)',
      })),
    )

    const candleByDay = new Map(candles.map((candle) => [candle.day, candle]))
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry || !chartRef.current) {
        return
      }

      chartRef.current.resize(
        Math.max(entry.contentRect.width, 320),
        Math.max(entry.contentRect.height, 320),
      )
    })
    resizeObserver.observe(container)

    const handleCrosshairMove = (param: {
      time?: string | number | { year: number; month: number; day: number }
      point?: { x: number; y: number }
    }) => {
      const timeKey = formatChartTime(param.time)

      if (!timeKey) {
        onHover(null)
        return
      }

      const candle = candleByDay.get(timeKey)
      onHover(candle ?? null)
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)
    chart.timeScale().fitContent()

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [candles, onHover])

  return (
    <div className="git-chart-wrap">
      <div className="git-chart-overlay">{overlay}</div>
      <div className="git-chart" ref={containerRef} />
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
  const [sourceMode, setSourceMode] = useState<RepoSourceMode>('local')
  const [repoPath, setRepoPath] = useState('/Users/watson/codingProj/stoke-your-code')
  const [repoUrl, setRepoUrl] = useState('https://github.com/openai/openai-node')
  const [branch, setBranch] = useState('')
  const [data, setData] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hoveredCandle, setHoveredCandle] = useState<HoverSnapshot | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusKind, setStatusKind] = useState<'idle' | 'loading' | 'success'>('idle')

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

  const infoCandle = hoveredCandle ?? latestCandle
  const infoDelta = infoCandle ? infoCandle.close - infoCandle.open : null
  const infoPercent =
    infoCandle && infoCandle.open !== 0
      ? (infoDelta! / Math.abs(infoCandle.open)) * 100
      : null

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: 'local',
            repoPath: '/Users/watson/codingProj/stoke-your-code',
          }),
        })

        const payload = (await response.json()) as AnalysisResponse | AnalysisError

        if (response.ok) {
          setData(payload as AnalysisResponse)
          setHoveredCandle(((payload as AnalysisResponse).candles.at(-1) as HoverSnapshot | undefined) ?? null)
          setRepoPath('/Users/watson/codingProj/stoke-your-code')
          setStatusKind('success')
          setStatusMessage('Local repository loaded and chart updated.')
        }
      } catch {
        // Keep the page usable even if the initial sample load fails.
      }
    })()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setStatusKind('loading')
    setStatusMessage(
      sourceMode === 'github'
        ? 'Validating GitHub repository URL...'
        : 'Validating local repository path...',
    )

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          sourceMode === 'github'
            ? {
                source: 'github',
                repoUrl,
                branch,
              }
            : {
                source: 'local',
                repoPath,
              },
        ),
      })

      const payload = (await response.json()) as AnalysisResponse | AnalysisError

      if (!response.ok) {
        throw new Error(
          'error' in payload ? payload.error ?? 'Failed to analyze repository' : 'Failed to analyze repository',
        )
      }

      const stageList = (payload as AnalysisResponse).stages ?? []
      const latestStage = stageList.at(-1)
      setData(payload as AnalysisResponse)
      setHoveredCandle(((payload as AnalysisResponse).candles.at(-1) as HoverSnapshot | undefined) ?? null)
      setStatusKind('success')
      setStatusMessage(
        latestStage
          ? `${describeAnalyzeStage(latestStage, sourceMode).replace(/\.\.\.$/, '')}. Chart updated.`
          : 'Repository analyzed successfully.',
      )
    } catch (submitError) {
      setData(null)
      setHoveredCandle(null)
      setStatusKind('idle')
      setStatusMessage('')
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to analyze repository',
      )
    } finally {
      setLoading(false)
    }
  }

  function switchSourceMode(nextMode: RepoSourceMode) {
    if (nextMode === sourceMode) {
      return
    }

    setSourceMode(nextMode)
    setError('')
    setStatusMessage('')
    setStatusKind('idle')
  }

  return (
    <main className="app-shell analysis-shell">
      <header className="topbar">
        <p className="brand">STOKE YOUR CODE / ANALYZE</p>
        <a className="back-link" href="/">
          Back to landing page
        </a>
      </header>

      <section
        className={`analysis-board ${sidebarCollapsed ? 'analysis-board-collapsed' : ''}`}
      >
        <aside
          className={`analysis-sidebar ${sidebarCollapsed ? 'analysis-sidebar-collapsed' : ''}`}
        >
          <div className="analysis-copy">
            <p className="eyebrow">
              {sourceMode === 'github'
                ? 'GitHub repository analysis'
                : 'Local Git repository analysis'}
            </p>
            <h1>Professional candle tape for code history.</h1>
            <p className="summary">
              {sourceMode === 'github'
                ? 'Point the analyzer at a GitHub repository URL. The service clones or refreshes the remote repository, reads commit history, and renders daily OHLC candles plus volume in one screen.'
                : 'Feed in a local Git repository. The page validates the path, reads real commit history, and renders daily OHLC candles plus volume in one screen.'}
            </p>
          </div>

          <form className="repo-form" onSubmit={handleSubmit}>
            <div className="source-tabs" role="tablist" aria-label="Repository source mode">
              <button
                type="button"
                className={`source-tab ${sourceMode === 'local' ? 'source-tab-active' : ''}`}
                onClick={() => switchSourceMode('local')}
              >
                Local
              </button>
              <button
                type="button"
                className={`source-tab ${sourceMode === 'github' ? 'source-tab-active' : ''}`}
                onClick={() => switchSourceMode('github')}
              >
                GitHub
              </button>
            </div>

            {sourceMode === 'github' ? (
              <>
                <label className="repo-label" htmlFor="repo-url">
                  GitHub repository URL
                </label>
                <input
                  id="repo-url"
                  className="repo-input"
                  type="text"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                  spellCheck={false}
                />
                <label className="repo-label" htmlFor="repo-branch">
                  Branch, optional
                </label>
                <input
                  id="repo-branch"
                  className="repo-input"
                  type="text"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder="Leave empty for the default branch"
                  spellCheck={false}
                />
              </>
            ) : (
              <>
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
              </>
            )}
            <button className="primary-link button-link" type="submit" disabled={loading}>
              {loading
                ? sourceMode === 'github'
                  ? 'Cloning and analyzing repository...'
                  : 'Analyzing repository...'
                : 'Analyze repository'}
            </button>
            <p className="repo-hint">
              {sourceMode === 'github'
                ? 'Public GitHub repository URL, or a private repository if your server has credentials configured.'
                : 'Path must be local and include a `.git` directory.'}
            </p>
            {loading || statusMessage ? (
              <p className={`status-banner status-banner-${statusKind}`}>
                {statusKind === 'loading' ? <span className="status-spinner" aria-hidden="true" /> : null}
                {loading
                  ? statusMessage ||
                    (sourceMode === 'github'
                      ? 'Cloning and analyzing repository...'
                      : 'Analyzing local repository...')
                  : statusMessage}
              </p>
            ) : null}
            {error ? <p className="error-banner">{error}</p> : null}
          </form>

          <div className="analysis-metrics">
            {metricCards.length > 0 ? (
              metricCards.map((metric) => (
                <article className="analysis-metric" key={metric.label}>
                  <p className="metric-label">{metric.label}</p>
                  <p className={`metric-value ${metric.tone}`}>{metric.value}</p>
                </article>
              ))
            ) : (
              <div className="empty-analysis">
                <p className="panel-label">READY</p>
                <h2>No repository loaded yet.</h2>
                <p>
                  Load a local Git repo to replace this placeholder with a real
                  chart and metrics.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="analysis-chart-panel">
          <div className="chart-header chart-header-tight">
            <div className="chart-header-main">
              <button
                type="button"
                className="collapse-toggle"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                aria-label={sidebarCollapsed ? 'Expand left panel' : 'Collapse left panel'}
                title={sidebarCollapsed ? 'Expand left panel' : 'Collapse left panel'}
              >
                {sidebarCollapsed ? '>' : '<'}
              </button>
              <p className="panel-label">
                {data ? `REAL ${data.source.toUpperCase()} OUTPUT` : 'REAL GIT OUTPUT'}
              </p>
              <h2>{data ? data.displayName : 'Awaiting repository input'}</h2>
            </div>
            <div className="panel-stats">
              <span>{data ? `${data.candles.length} trading days of code` : 'No data loaded'}</span>
              <span
                className={`panel-stats-focus ${infoPercent !== null && infoPercent >= 0 ? 'positive' : 'negative'}`}
              >
                {infoPercent !== null
                  ? `${infoPercent >= 0 ? '+' : ''}${infoPercent.toFixed(2)}%`
                  : 'n/a'}
              </span>
            </div>
          </div>

          <div className="analysis-chart-shell">
            {data ? <GitChart candles={data.candles} onHover={setHoveredCandle} overlay={<div className="floating-ticker">
              <div className="ticker-strip">
                {infoCandle ? (
                  <>
                    <div className="ticker-main">
                      <span className="ticker-label">DATE</span>
                      <span className="ticker-value">{infoCandle.day}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">O</span>
                      <span className="ticker-value">{formatCompact(infoCandle.open)}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">H</span>
                      <span className="ticker-value">{formatCompact(infoCandle.high)}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">L</span>
                      <span className="ticker-value">{formatCompact(infoCandle.low)}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">C</span>
                      <span className="ticker-value">{formatCompact(infoCandle.close)}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">CHG</span>
                      <span className={`ticker-value ${infoDelta !== null && infoDelta >= 0 ? 'positive' : 'negative'}`}>
                        {infoDelta !== null ? `${infoDelta >= 0 ? '+' : ''}${formatCompact(infoDelta)}` : 'n/a'}
                      </span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">VOL</span>
                      <span className="ticker-value">{formatCompact(infoCandle.volume)}</span>
                    </div>
                    <div className="ticker-item">
                      <span className="ticker-label">N</span>
                      <span className="ticker-value">{infoCandle.commits}</span>
                    </div>
                  </>
                ) : (
                  <div className="ticker-main">
                    <span className="ticker-label">STATUS</span>
                    <span className="ticker-value">Load a repository to view session data</span>
                  </div>
                )}
              </div>
            </div>} /> : <div className="analysis-chart-placeholder">
              <p className="panel-label">CHART STANDBY</p>
              <p>Enter a valid Git repository path to render the candle tape.</p>
            </div>}
          </div>
        </section>
      </section>
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
