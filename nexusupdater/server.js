const express = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const util = require('util')

const execAsync = util.promisify(exec)

const PORT = process.env.PORT || 9000
const TOKEN = process.env.UPDATER_TOKEN || ''
const REPO_PATH = process.env.REPO_PATH || '/opt/nexusit'
const COMPOSE_FILE = path.join(REPO_PATH, 'docker-compose.yml')
const CHANGELOG_PATH = path.join(REPO_PATH, 'CHANGELOG.md')

const state = {
  updating: false,
  lastUpdateAt: null,
  lastError: null,
}

const app = express()

app.get('/health', (req, res) => res.json({ ok: true }))

app.use((req, res, next) => {
  if (req.path === '/health') return next()
  if (!TOKEN || req.headers['x-updater-token'] !== TOKEN) {
    return res.status(403).json({ error: 'token invalido' })
  }
  next()
})

function readLatestChangelogSection() {
  try {
    const text = fs.readFileSync(CHANGELOG_PATH, 'utf8')
    const lines = text.split('\n')
    const start = lines.findIndex(l => l.startsWith('## '))
    if (start === -1) return text.trim().slice(0, 2000)
    let end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
    if (end === -1) end = lines.length
    return lines.slice(start, end).join('\n').trim()
  } catch (e) {
    return null
  }
}

app.get('/status', async (req, res) => {
  try {
    await execAsync('git fetch origin main --quiet', { cwd: REPO_PATH, timeout: 30000 })
    const { stdout: current } = await execAsync('git rev-parse HEAD', { cwd: REPO_PATH })
    const { stdout: latest } = await execAsync('git rev-parse origin/main', { cwd: REPO_PATH })
    const currentCommit = current.trim()
    const latestCommit = latest.trim()

    res.json({
      currentCommit,
      latestCommit,
      updateAvailable: currentCommit !== latestCommit,
      changelog: readLatestChangelogSection(),
      updating: state.updating,
      lastUpdateAt: state.lastUpdateAt,
      lastError: state.lastError,
    })
  } catch (e) {
    res.status(500).json({ error: 'falha ao checar atualizacoes: ' + e.message })
  }
})

app.post('/update', (req, res) => {
  if (state.updating) {
    return res.status(409).json({ error: 'ja existe uma atualizacao em andamento' })
  }
  state.updating = true
  state.lastError = null
  res.json({ started: true })

  runUpdate()
    .then(() => {
      state.updating = false
      state.lastUpdateAt = new Date().toISOString()
      state.lastError = null
    })
    .catch((e) => {
      state.updating = false
      state.lastUpdateAt = new Date().toISOString()
      state.lastError = e.message
    })
})

async function runUpdate() {
  const opts = { cwd: REPO_PATH, timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024 * 20 }
  await execAsync('git pull origin main', opts)
  await execAsync(`docker compose -f "${COMPOSE_FILE}" --project-directory "${REPO_PATH}" build`, opts)
  await execAsync(`docker compose -f "${COMPOSE_FILE}" --project-directory "${REPO_PATH}" up -d`, opts)
}

app.listen(PORT, () => {
  console.log(`NexusUpdater ouvindo na porta ${PORT}, repositorio: ${REPO_PATH}`)
})
