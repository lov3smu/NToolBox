import { dialog } from 'electron'
import { t } from '../../services/i18n.js'
import { getConfig } from '../../services/config.js'
import { chat, chatStream, compressChatContext } from '../../services/agent/chat.js'
import {
  deleteChatSession,
  importChatSessions,
  loadChatMessagePage,
  loadChatSessionSummaries,
  loadChatSessions,
  saveChatSession
} from '../../services/sqlite/chatRepository.js'
import { getWorkspaceInfo, openWorkspaceItem } from '../../services/agent/workspace.js'
import {
  KNOWLEDGE_FILE_EXTENSIONS,
  getMemoryOverview,
  addMemory,
  updateMemory,
  removeMemory,
  clearMemory,
  clearProjectMemory,
  addKnowledgeSource,
  removeKnowledgeSource,
  setKnowledgeSourceEnabled,
  searchKnowledge
} from '../../services/agent/memory.js'
import { createSnapshotStore, restoreSnapshot } from '../../services/agent/snapshots.js'
import { createToolResultStore } from '../../services/agent/toolResults.js'
import {
  countRunTracesByWorkspace,
  createRunTrace,
  listRunTraces,
  readRunTrace,
  writeRunTraceFile
} from '../../services/agent/runTrace.js'
import {
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRetentionDays,
  normalizeAiToolResultRunKb
} from '../../../shared/aiBehavior.js'
import { IPC_CHANNELS, IPC_EVENTS } from '../../../shared/ipc'
import { getDialogParentWindow } from './common'

export function registerChatHandlers(handle) {
  const activeChatStreams = new Map()
  const pendingApprovals = new Map()

  handle(IPC_CHANNELS.chat, async (_event, messages, options) => {
    return await chat(messages, options)
  })

  handle(IPC_CHANNELS.chatStream, async (event, messages, options = {}) => {
    const requestId = options.requestId || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const controller = { cancelled: false }
    activeChatStreams.set(requestId, controller)

    const sendChunk = (payload) => {
      if (event.sender.isDestroyed()) return
      const eventPayload = typeof payload === 'string' ? { kind: 'content', text: payload } : payload
      event.sender.send(IPC_EVENTS.chatStreamChunk, { requestId, ...eventPayload })
    }

    const snapshots = createSnapshotStore(requestId, { conversationId: options.conversationId })
    const budgetConfig = getConfig()
    const toolResults = createToolResultStore(requestId, {
      maxResultChars: normalizeAiToolResultMaxKb(budgetConfig.ai.tool_result.max_kb) * 1024,
      maxRunChars: normalizeAiToolResultRunKb(budgetConfig.ai.tool_result.run_kb) * 1024,
      retentionMs: normalizeAiToolResultRetentionDays(budgetConfig.ai.tool_result.retention_days) * 24 * 60 * 60 * 1000
    })
    const trace = createRunTrace(requestId, {
      provider: options.provider,
      model: options.model,
      workspacePath: options.workspacePath,
      conversationId: options.conversationId,
      approvalPolicy: options.approvalPolicy,
      toolsEnabled: options.toolsEnabled !== false
    })
    const allowedTools = new Set(Array.isArray(options.allowedTools) ? options.allowedTools.filter(Boolean) : [])
    const approvalsForRequest = new Set()

    const requestApproval = (request) => {
      if (event.sender.isDestroyed()) {
        return Promise.resolve({ approved: false, reason: 'cancelled' })
      }
      if (controller.cancelled) return Promise.resolve({ approved: false, reason: 'cancelled' })

      const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      return new Promise((resolve) => {
        const settle = (decision) => {
          if (!pendingApprovals.has(approvalId)) return
          pendingApprovals.delete(approvalId)
          approvalsForRequest.delete(approvalId)
          clearTimeout(timer)
          if (decision?.always && request?.key) allowedTools.add(request.key)
          resolve(decision)
        }

        const timer = setTimeout(() => {
          settle({ approved: false, reason: 'timeout' })
        }, 120000)
        if (typeof timer.unref === 'function') timer.unref()

        pendingApprovals.set(approvalId, settle)
        approvalsForRequest.add(approvalId)

        try {
          event.sender.send(IPC_EVENTS.chatApprovalRequest, {
            requestId,
            approvalId,
            tool: request?.tool,
            risk: request?.risk,
            key: request?.key,
            summary: request?.summary,
            arguments: request?.arguments,
            preview: request?.preview ?? null,
            allowRemember: request?.allowRemember !== false
          })
        } catch {
          settle({ approved: false, reason: 'cancelled' })
        }
      })
    }

    try {
      const result = await chatStream(
        messages,
        {
          ...options,
          requestId,
          shouldStop: () => controller.cancelled,
          snapshots,
          toolResults,
          trace,
          requestApproval,
          isToolAllowed: (key) => allowedTools.has(key)
        },
        sendChunk
      )

      await trace.finish({
        status: result?.termination || (result?.success ? 'goal_reached' : 'error'),
        termination: result?.termination || null,
        summary: result?.summary || null,
        usage: result?.usage || null,
        error: result?.error || null,
        content: result?.content || ''
      })

      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_EVENTS.chatStreamEnd, { requestId, ...result })
      }
      return result
    } finally {
      await trace.finish({ status: 'error', error: '执行中断' })
      for (const approvalId of approvalsForRequest) {
        const settle = pendingApprovals.get(approvalId)
        if (settle) settle({ approved: false, reason: 'cancelled' })
      }
      activeChatStreams.delete(requestId)
    }
  })

  handle(IPC_CHANNELS.respondChatApproval, async (_event, approvalId, decision) => {
    const settle = pendingApprovals.get(approvalId)
    if (!settle) return false
    const action = decision?.decision || (decision?.approved ? 'allow_once' : 'deny')
    if (action === 'deny') {
      settle({ approved: false, reason: decision?.reason || 'denied' })
      return true
    }
    settle({ approved: true, always: action === 'allow_always' })
    return true
  })

  handle(IPC_CHANNELS.cancelChatStream, async (_event, requestId) => {
    const controller = activeChatStreams.get(requestId)
    if (!controller) return false
    controller.cancelled = true
    return true
  })

  handle(IPC_CHANNELS.isChatStreamActive, async (_event, requestId) => {
    return activeChatStreams.has(requestId)
  })

  handle(IPC_CHANNELS.rollbackChatRun, async (_event, requestId) => {
    if (!requestId || typeof requestId !== 'string') {
      return { success: false, error: '缺少运行标识' }
    }
    return await restoreSnapshot(requestId)
  })

  handle(IPC_CHANNELS.listRunTraces, async (_event, options) => {
    return await listRunTraces(options)
  })

  handle(IPC_CHANNELS.runTraceStats, async () => {
    return await countRunTracesByWorkspace()
  })

  handle(IPC_CHANNELS.readRunTrace, async (_event, runId) => {
    if (!runId || typeof runId !== 'string') {
      return { success: false, error: '缺少运行标识' }
    }
    return await readRunTrace(runId)
  })

  handle(IPC_CHANNELS.exportRunTrace, async (_event, runId) => {
    if (!runId || typeof runId !== 'string') {
      return { canceled: false, success: false, error: t('缺少运行标识') }
    }
    const trace = await readRunTrace(runId)
    if (!trace.success) {
      return { canceled: false, success: false, error: trace.error }
    }
    const result = await dialog.showSaveDialog(getDialogParentWindow(), {
      title: t('导出运行轨迹'),
      defaultPath: `agent-run-${runId}.json`,
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    const written = await writeRunTraceFile(runId, result.filePath)
    return { canceled: false, ...written, filePath: result.filePath }
  })

  handle(IPC_CHANNELS.compressChatContext, async (_event, messages, options) => {
    return await compressChatContext(messages, options)
  })

  handle(IPC_CHANNELS.chatLoadSessions, async () => await loadChatSessions())

  handle(IPC_CHANNELS.chatSessionSummaries, async (_event, options) => await loadChatSessionSummaries(options))

  handle(IPC_CHANNELS.chatImportSessions, async (_event, sessions) => await importChatSessions(sessions))

  handle(IPC_CHANNELS.chatSaveSession, async (_event, session) => await saveChatSession(session))

  handle(IPC_CHANNELS.chatDeleteSession, async (_event, id) => await deleteChatSession(id))

  handle(IPC_CHANNELS.chatMessagePage, async (_event, options) => await loadChatMessagePage(options))

  handle(IPC_CHANNELS.workspaceInfo, async (_event, workspacePath) => {
    return await getWorkspaceInfo(workspacePath)
  })

  handle(IPC_CHANNELS.workspaceOpen, async (_event, workspacePath, targetPath) => {
    return await openWorkspaceItem(workspacePath, targetPath)
  })

  handle(IPC_CHANNELS.memorySelectFiles, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: t('文本与文档'), extensions: KNOWLEDGE_FILE_EXTENSIONS },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    return { canceled: result.canceled, paths: result.filePaths || [] }
  })

  handle(IPC_CHANNELS.memoryOverview, async (_event, workspacePath) => {
    return await getMemoryOverview(workspacePath)
  })

  handle(IPC_CHANNELS.memoryAdd, async (_event, input) => {
    return await addMemory(input)
  })

  handle(IPC_CHANNELS.memoryUpdate, async (_event, input) => {
    return await updateMemory(input)
  })

  handle(IPC_CHANNELS.memoryRemove, async (_event, input) => {
    return await removeMemory(input)
  })

  handle(IPC_CHANNELS.memoryClear, async (_event, input) => {
    return await clearMemory(input)
  })

  handle(IPC_CHANNELS.memoryClearProject, async (_event, workspacePath) => {
    return await clearProjectMemory(workspacePath)
  })

  handle(IPC_CHANNELS.memoryKnowledgeAdd, async (_event, input) => {
    return await addKnowledgeSource(input)
  })

  handle(IPC_CHANNELS.memoryKnowledgeRemove, async (_event, id) => {
    return await removeKnowledgeSource(id)
  })

  handle(IPC_CHANNELS.memoryKnowledgeToggle, async (_event, id, enabled) => {
    return await setKnowledgeSourceEnabled(id, enabled)
  })

  handle(IPC_CHANNELS.memoryKnowledgeSearch, async (_event, input) => {
    return await searchKnowledge(input)
  })
}
