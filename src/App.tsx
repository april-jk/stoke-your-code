import './App.css'

const candles = [
  { day: '05.03', open: 42, close: 68, high: 79, low: 34, volume: 28 },
  { day: '05.06', open: 68, close: 61, high: 82, low: 52, volume: 16 },
  { day: '05.09', open: 61, close: 92, high: 97, low: 58, volume: 31 },
  { day: '05.12', open: 92, close: 88, high: 104, low: 73, volume: 20 },
  { day: '05.15', open: 88, close: 126, high: 132, low: 84, volume: 37 },
  { day: '05.18', open: 126, close: 119, high: 141, low: 110, volume: 24 },
  { day: '05.21', open: 119, close: 151, high: 168, low: 117, volume: 41 },
  { day: '05.24', open: 151, close: 147, high: 176, low: 139, volume: 22 },
]

const metrics = [
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

function App() {
  const scale = 1.6

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

          <div className="chart-stage" aria-hidden="true">
            <div className="chart-grid" />
            <div className="price-scale">
              <span>180k</span>
              <span>140k</span>
              <span>100k</span>
              <span>060k</span>
            </div>

            <div className="candles">
              {candles.map((candle) => {
                const bodyTop = Math.min(candle.open, candle.close) * scale
                const bodyHeight = Math.max(
                  Math.abs(candle.close - candle.open) * scale,
                  10,
                )
                const wickTop = candle.high * scale
                const wickHeight = Math.max((candle.high - candle.low) * scale, 16)
                const volumeHeight = candle.volume * 2.2
                const tone = candle.close >= candle.open ? 'up' : 'down'

                return (
                  <div className="candle-column" key={candle.day}>
                    <div className="price-zone">
                      <div
                        className={`wick ${tone}`}
                        style={{
                          height: `${wickHeight}px`,
                          top: `${288 - wickTop}px`,
                        }}
                      />
                      <div
                        className={`body ${tone}`}
                        style={{
                          height: `${bodyHeight}px`,
                          top: `${288 - bodyTop - bodyHeight}px`,
                        }}
                      />
                    </div>
                    <div
                      className={`volume-bar ${tone}`}
                      style={{ height: `${volumeHeight}px` }}
                    />
                    <span className="day-label">{candle.day}</span>
                  </div>
                )
              })}
            </div>

            <div className="annotation annotation-left">
              <span className="annotation-title">Open</span>
              <span>codebase starts the day here</span>
            </div>
            <div className="annotation annotation-right">
              <span className="annotation-title">Volume</span>
              <span>added + deleted lines</span>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-strip">
        {metrics.map((metric) => (
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

export default App
