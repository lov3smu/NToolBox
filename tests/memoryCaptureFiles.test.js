import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'

const state = vi.hoisted(() => ({ userDataDir: '', serverPort: 0 }))

vi.mock('electron', () => ({
  app: { getPath: () => state.userDataDir }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: () => ({
    ai: {
      provider: 'openai',
      keys: { openai: 'sk-verify-local' },
      models: {},
      fallback: { enabled: false, models: [] },
      persona: '',
      temperature: null,
      timeout: 30,
      connection_timeout: 5,
      base_urls: { openai: `http://127.0.0.1:${state.serverPort}` },
      context: { compress_threshold: 70, keep_recent: 6 },
      attachments: { max_count: 5, max_image_mb: 10, max_text_kb: 256 },
      agent: {
        max_iterations: 5,
        timeout_min: 5,
        max_plan_steps: 8,
        max_parallel_tools: 2,
        scenario_models: {},
        tool_policy: 'all'
      },
      tool_result: { max_kb: 24, run_kb: 160, retention_days: 7 }
    },
    database: { connections: [] },
    extensions: { mcp_servers: [], disabled_skills: [], skill_overrides: {} },
    sql_generator: { base_path: '', text_edit_app: '' },
    network: { proxy: { mode: 'direct' }, market_sources: {} },
    update: { auto_update: false, check_interval: 24 },
    appearance: { theme: 'system' },
    memory: { auto_capture: true },
    image_hosting: {},
    notifications: {},
    clipboard_history: {}
  })
}))

function startMockServer() {
  const requests = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}')
      requests.push(body)
      res.setHeader('Content-Type', 'application/json')
      const systemText = String(body.messages?.[0]?.content || '')
      if (systemText.includes('长期记忆整理器')) {
        res.end(
          JSON.stringify({
            id: 'cmpl-extract',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify([
                    { scope: 'global', content: '用户偏好简洁直接的中文回复', tags: ['沟通'] },
                    { scope: 'project', content: '当前项目统一使用 Vite 开发前端', tags: ['技术栈'] }
                  ])
                },
                finish_reason: 'stop'
              }
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
          })
        )
        return
      }
      res.setHeader('Content-Type', 'text/event-stream')
      res.write(
        `data: ${JSON.stringify({
          id: 'cmpl-stream',
          choices: [{ index: 0, delta: { role: 'assistant', content: '好的，已记录你的偏好。' }, finish_reason: null }]
        })}\n\n`
      )
      res.write(
        `data: ${JSON.stringify({ id: 'cmpl-stream', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`
      )
      res.write('data: [DONE]\n\n')
      res.end()
    })
  })
  return { server, requests }
}

const { chatStream } = await import('../src/main/services/chat.js')

async function waitFor(predicate, timeout = 4000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

describe('真实 Provider 链路自动沉淀记忆', () => {
  afterEach(async () => {
    const { closeStorage } = await import('../src/main/services/sqlite/index.js')
    await closeStorage()
    if (state.userDataDir) fs.rmSync(state.userDataDir, { recursive: true, force: true })
  })

  it('流式对话结束后写入全局与项目记忆文件', async () => {
    const { server, requests } = startMockServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    state.serverPort = server.address().port
    state.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-memory-e2e-'))
    const workspace = path.join(state.userDataDir, 'workspace')
    fs.mkdirSync(workspace, { recursive: true })

    try {
      const result = await chatStream(
        [{ role: 'user', content: '记住偏好' }],
        {
          provider: 'openai',
          model: 'gpt-6-sol',
          toolsEnabled: true,
          tools: [],
          workspacePath: workspace
        },
        () => {}
      )
      expect(result.success).toBe(true)

      const globalDir = path.join(state.userDataDir, 'memory', 'global')
      const projectDir = path.join(workspace, '.ntoolbox', 'memory')
      const done = await waitFor(
        () =>
          fs.existsSync(globalDir) &&
          fs.readdirSync(globalDir).some((name) => name.endsWith('.md')) &&
          fs.existsSync(projectDir) &&
          fs.readdirSync(projectDir).some((name) => name.endsWith('.md'))
      )
      expect(done).toBe(true)

      const globalRaw = fs.readFileSync(path.join(globalDir, fs.readdirSync(globalDir)[0]), 'utf8')
      const projectRaw = fs.readFileSync(path.join(projectDir, fs.readdirSync(projectDir)[0]), 'utf8')
      expect(globalRaw).toContain('用户偏好简洁直接的中文回复')
      expect(projectRaw).toContain('当前项目统一使用 Vite 开发前端')
      expect(projectRaw).toContain('source: ai')

      const extractionRequest = requests.find((body) =>
        String(body.messages?.[0]?.content || '').includes('长期记忆整理器')
      )
      expect(extractionRequest).toBeTruthy()
      expect(extractionRequest.messages[1].content).toContain('工作区：')
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })
})
