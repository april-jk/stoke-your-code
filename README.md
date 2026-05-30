# Stoke Your Code

[中文说明](./README.zh-CN.md)

Stoke Your Code is a trading-terminal style Git history viewer. It turns repository movement into OHLC candles and volume bars so you can read a codebase like a market chart.

Live project page: [https://april-jk.github.io/stoke-your-code/](https://april-jk.github.io/stoke-your-code/)

The project supports:
- Local Git repositories
- GitHub repositories
- Branch selection for both local and GitHub sources
- Multi-timeframe chart aggregation: `5M`, `1H`, `1D`, `1W`, `1M`

## Screenshots

### Landing page

![Landing page preview](./docs/screenshots/landing-page.png)

### Analysis terminal

![Analysis page preview](./docs/screenshots/analysis-page.png)

## What It Does

Instead of browsing commit lists, Stoke Your Code translates repository history into a visual tape:

- `Open / Close`: codebase LOC before and after movement
- `High / Low`: intraperiod extremes during commit activity
- `Volume`: added + deleted lines
- `Timeframes`: aggregate the same commit event stream into multiple chart intervals

The goal is not to mimic finance superficially, but to make software history legible at a glance.

## Features

- Trading-terminal inspired landing page and analysis UI
- Real repository analysis for local Git paths
- Remote GitHub repository analysis through server-side clone/fetch
- Live branch dropdowns for local and GitHub repos
- Hover ticker with OHLC, change, volume, and commit count
- Single-screen analysis layout
- Public-facing product presentation with English by default and Chinese documentation included

## Tech Stack

- React 19
- TypeScript
- Vite
- Lightweight Charts
- Git CLI for repository parsing

## Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL, usually [http://localhost:5173](http://localhost:5173).

## GitHub Pages

The public Pages site is a static presentation build:

- Landing page is fully available online
- Analysis page opens in demo mode with sample repository data
- Real local Git analysis and live GitHub clone/fetch analysis still require the local dev server or a backend runtime

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## How Analysis Works

1. Validate a local path or GitHub repository URL
2. Resolve the branch selection
3. Read commit history from Git
4. Convert commit events into codebase movement
5. Aggregate those events into the selected chart timeframe
6. Render OHLC + volume in a terminal-style chart

## Repository Notes

- GitHub analysis on this branch uses server-side clone/fetch into a local cache
- Multi-timeframe candles are derived from real commit events, not from re-bucketed daily candles
- Sparse `5M` or `1H` views are expected on repositories with low intraday commit frequency

## Documentation

- English: `README.md`
- Chinese: [`README.zh-CN.md`](./README.zh-CN.md)
- Product context: [`PRODUCT.md`](./PRODUCT.md)
- Design context: [`DESIGN.md`](./DESIGN.md)
- Early idea notes: [`docs/idea.md`](./docs/idea.md)

## Status

The current version is a strong prototype with a polished landing page and a functional analysis terminal. It is suitable for demos, iteration, and further productization work.
