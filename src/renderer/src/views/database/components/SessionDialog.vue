<template>
  <div v-if="sessionDialog.show" class="dialog-overlay" @click.self="closeSessionDialog">
    <div class="dialog dialog-wide session-dialog">
      <div class="dialog-header">
        <h3>
          会话与锁 ·
          <span class="session-connection">{{ sessionDialog.connectionName }}</span>
        </h3>
        <div class="session-header-meta">
          <span v-if="sessionDialog.version" class="session-version">MySQL {{ sessionDialog.version }}</span>
          <button class="btn-icon btn-sm" title="关闭" @click="closeSessionDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-tabs">
        <div
          :class="['dialog-tab', { active: sessionDialog.tab === 'sessions' }]"
          @click="sessionDialog.tab = 'sessions'"
        >
          会话
          <span class="session-tab-count">{{ sessionDialog.sessions.length }}</span>
        </div>
        <div :class="['dialog-tab', { active: sessionDialog.tab === 'locks' }]" @click="sessionDialog.tab = 'locks'">
          锁与等待
          <span v-if="sessionDialog.waits.length" class="session-tab-count danger">{{
            sessionDialog.waits.length
          }}</span>
        </div>
      </div>

      <div class="dialog-content session-body">
        <div class="session-toolbar">
          <template v-if="sessionDialog.tab === 'sessions'">
            <input
              v-model="sessionDialog.keyword"
              type="text"
              class="input-field session-search"
              placeholder="搜索用户 / 来源 / 数据库 / 语句"
            />
            <select v-model="sessionDialog.command" class="select-field session-command">
              <option value="">全部命令</option>
              <option v-for="command in sessionCommands" :key="command" :value="command">{{ command }}</option>
            </select>
            <label class="checkbox-label-inline">
              <input v-model="sessionDialog.activeOnly" type="checkbox" />
              <span>仅活跃会话</span>
            </label>
          </template>
          <span v-else class="session-hint">锁信息展示 InnoDB 事务、锁等待与最近一次死锁记录</span>
          <div class="session-toolbar-right">
            <span v-if="sessionDialog.loading" class="session-hint">刷新中…</span>
            <button
              :class="['btn btn-sm', sessionDialog.autoRefresh ? 'btn-primary' : 'btn-secondary']"
              @click="toggleAutoRefresh"
            >
              {{ sessionDialog.autoRefresh ? '自动刷新中' : '自动刷新' }}
            </button>
            <button class="btn btn-sm btn-secondary" :disabled="sessionDialog.loading" @click="loadSessions">
              刷新
            </button>
          </div>
        </div>

        <p v-if="sessionDialog.error" class="create-table-error">{{ sessionDialog.error }}</p>

        <template v-if="sessionDialog.tab === 'sessions'">
          <div class="session-table-scroll">
            <table class="result-table session-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户</th>
                  <th>来源</th>
                  <th>数据库</th>
                  <th>命令</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th>当前语句</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="session in filteredSessions"
                  :key="session.id"
                  :class="{ 'session-self-row': session.isSelf }"
                >
                  <td class="session-mono">
                    {{ session.id }}
                    <span v-if="session.isSelf" class="session-self-badge">当前</span>
                  </td>
                  <td>{{ session.user }}</td>
                  <td class="session-mono">{{ session.host }}</td>
                  <td>{{ session.db || '-' }}</td>
                  <td>
                    <span :class="['session-command-chip', session.command === 'Sleep' ? 'idle' : 'active']">
                      {{ session.command }}
                    </span>
                  </td>
                  <td class="session-mono">{{ formatSessionTime(session.time) }}</td>
                  <td>{{ session.state || '-' }}</td>
                  <td class="session-query" :title="session.info">{{ session.info || '-' }}</td>
                  <td class="session-actions">
                    <button
                      v-if="session.command !== 'Sleep'"
                      class="btn btn-xs btn-secondary"
                      :disabled="session.isSelf || sessionDialog.killingId === session.id"
                      @click="killSessionById(session, 'query')"
                    >
                      取消查询
                    </button>
                    <button
                      class="btn btn-xs btn-secondary danger"
                      :disabled="session.isSelf || sessionDialog.killingId === session.id"
                      @click="killSessionById(session, 'connection')"
                    >
                      终止
                    </button>
                  </td>
                </tr>
                <tr v-if="!filteredSessions.length">
                  <td colspan="9" class="session-empty">没有匹配的会话</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else>
          <div class="session-summary">
            <span class="session-summary-chip">事务 {{ sessionDialog.transactions.length }}</span>
            <span :class="['session-summary-chip', { danger: waitingTransactions.length }]">
              锁等待 {{ waitingTransactions.length }}
            </span>
            <span class="session-summary-chip">锁 {{ sessionDialog.locks.length }}</span>
          </div>

          <div class="lock-section">
            <div class="lock-section-title">锁等待</div>
            <div class="session-table-scroll">
              <table class="result-table session-table">
                <thead>
                  <tr>
                    <th>等待会话</th>
                    <th>阻塞会话</th>
                    <th>库表</th>
                    <th>等待锁</th>
                    <th>阻塞锁</th>
                    <th>等待语句</th>
                    <th>阻塞语句</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(wait, index) in sessionDialog.waits" :key="`wait-${index}`">
                    <td class="session-mono">{{ wait.waitingThreadId || wait.waitingTrxId }}</td>
                    <td class="session-mono">{{ wait.blockingThreadId || wait.blockingTrxId }}</td>
                    <td>{{ wait.db ? `${wait.db}.${wait.tableName}` : wait.tableName || '-' }}</td>
                    <td class="session-mono">{{ wait.waitingLockMode || '-' }}</td>
                    <td class="session-mono">{{ wait.blockingLockMode || '-' }}</td>
                    <td class="session-query" :title="wait.waitingQuery">{{ wait.waitingQuery || '-' }}</td>
                    <td class="session-query" :title="wait.blockingQuery">{{ wait.blockingQuery || '-' }}</td>
                    <td class="session-actions">
                      <button
                        v-if="wait.blockingThreadId"
                        class="btn btn-xs btn-secondary danger"
                        :disabled="sessionDialog.killingId === wait.blockingThreadId"
                        @click="killBlockingSession(wait)"
                      >
                        终止阻塞会话
                      </button>
                      <span v-else class="session-hint">-</span>
                    </td>
                  </tr>
                  <tr v-if="!sessionDialog.waits.length">
                    <td colspan="8" class="session-empty">当前没有锁等待</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="lock-section">
            <div class="lock-section-title">事务</div>
            <div class="session-table-scroll">
              <table class="result-table session-table">
                <thead>
                  <tr>
                    <th>事务 ID</th>
                    <th>状态</th>
                    <th>会话</th>
                    <th>开始时间</th>
                    <th>等待开始</th>
                    <th>锁定行</th>
                    <th>修改行</th>
                    <th>当前语句</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="trx in sessionDialog.transactions" :key="trx.trxId">
                    <td class="session-mono">{{ trx.trxId }}</td>
                    <td>
                      <span :class="['session-command-chip', trx.state === 'LOCK WAIT' ? 'danger' : 'active']">
                        {{ trx.state || '-' }}
                      </span>
                    </td>
                    <td class="session-mono">{{ trx.threadId || '-' }}</td>
                    <td class="session-mono">{{ formatDateTime(trx.started) }}</td>
                    <td class="session-mono">{{ trx.waitStarted ? formatDateTime(trx.waitStarted) : '-' }}</td>
                    <td class="session-mono">{{ trx.rowsLocked }}</td>
                    <td class="session-mono">{{ trx.rowsModified }}</td>
                    <td class="session-query" :title="trx.query">{{ trx.query || '-' }}</td>
                    <td class="session-actions">
                      <button
                        v-if="trx.threadId"
                        class="btn btn-xs btn-secondary danger"
                        :disabled="trx.threadId === sessionDialog.selfId || sessionDialog.killingId === trx.threadId"
                        @click="killTrxSession(trx)"
                      >
                        终止会话
                      </button>
                      <span v-else class="session-hint">-</span>
                    </td>
                  </tr>
                  <tr v-if="!sessionDialog.transactions.length">
                    <td colspan="9" class="session-empty">当前没有运行中的事务</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="lock-section">
            <div class="lock-section-title">InnoDB 锁</div>
            <div class="session-table-scroll">
              <table class="result-table session-table">
                <thead>
                  <tr>
                    <th>事务 ID</th>
                    <th>会话</th>
                    <th>库</th>
                    <th>表</th>
                    <th>索引</th>
                    <th>类型</th>
                    <th>模式</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(lock, index) in sessionDialog.locks" :key="`lock-${index}`">
                    <td class="session-mono">{{ lock.trxId || '-' }}</td>
                    <td class="session-mono">{{ lock.processId || '-' }}</td>
                    <td>{{ lock.db || '-' }}</td>
                    <td>{{ lock.tableName || '-' }}</td>
                    <td>{{ lock.indexName || '-' }}</td>
                    <td>{{ lock.lockType || '-' }}</td>
                    <td class="session-mono">{{ lock.lockMode || '-' }}</td>
                    <td>
                      <span :class="['session-command-chip', lock.lockStatus === 'WAITING' ? 'danger' : 'active']">
                        {{ lock.lockStatus }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!sessionDialog.locks.length">
                    <td colspan="8" class="session-empty">当前没有 InnoDB 锁记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="lock-section">
            <div class="lock-section-title">最近一次死锁</div>
            <pre v-if="sessionDialog.deadlockText" class="deadlock-block">{{ sessionDialog.deadlockText }}</pre>
            <div v-else class="session-empty deadlock-empty">未检测到死锁记录</div>
          </div>
        </template>
      </div>

      <div class="dialog-footer">
        <span class="session-hint">终止会话会断开目标连接，请确认不是自身使用的连接</span>
        <button class="btn btn-primary" @click="closeSessionDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  closeSessionDialog,
  filteredSessions,
  killSessionById,
  loadSessions,
  sessionCommands,
  sessionDialog,
  toggleAutoRefresh,
  waitingTransactions
} = databaseStore

function formatSessionTime(seconds) {
  const total = Number(seconds) || 0
  if (total < 60) return `${total}s`
  if (total < 3600) return `${Math.floor(total / 60)}m${total % 60}s`
  return `${Math.floor(total / 3600)}h${Math.floor((total % 3600) / 60)}m`
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

function killBlockingSession(wait) {
  killSessionById({ id: wait.blockingThreadId, isSelf: false }, 'connection')
}

function killTrxSession(trx) {
  killSessionById({ id: trx.threadId, isSelf: trx.threadId === sessionDialog.value.selfId }, 'connection')
}
</script>
