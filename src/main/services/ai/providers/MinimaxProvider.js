import BaseProvider from './BaseProvider.js'

class MinimaxProvider extends BaseProvider {
  constructor(apiKey, groupId, timeout = 60000, connectionTimeout = 10000) {
    const path = groupId ? `/v1/chat/completions?GroupId=${groupId}` : '/v1/chat/completions'
    super({
      name: 'Minimax',
      apiKey,
      hostname: 'api.minimax.chat',
      path,
      validateModel: 'abab6.5s-chat',
      models: [
        { id: 'abab6.5s-chat', name: 'ABAB 6.5S (快速)' },
        { id: 'abab6.5g-chat', name: 'ABAB 6.5G' },
        { id: 'abab6.5-chat', name: 'ABAB 6.5' },
        { id: 'abab5.5-chat', name: 'ABAB 5.5' },
        { id: 'abab5.5s-chat', name: 'ABAB 5.5S' }
      ],
      defaultModel: 'abab6.5s-chat',
      timeout,
      connectionTimeout
    })
    this.groupId = groupId
  }
}

export default MinimaxProvider