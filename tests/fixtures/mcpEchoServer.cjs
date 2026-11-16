const readline = require('node:readline')

function respond(id, result, error) {
  const message = error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result }
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const interface_ = readline.createInterface({ input: process.stdin })

interface_.on('line', (line) => {
  const text = line.trim()
  if (!text) return

  let message
  try {
    message = JSON.parse(text)
  } catch {
    return
  }

  if (message.id === undefined) return

  if (message.method === 'initialize') {
    respond(message.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'fixture', version: '1.0.0' }
    })
    return
  }

  if (message.method === 'tools/list') {
    respond(message.id, {
      tools: [
        {
          name: 'echo',
          description: 'Echo the given text',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' } },
            required: ['text']
          }
        },
        {
          name: 'fail',
          description: 'Always fails',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    })
    return
  }

  if (message.method === 'tools/call') {
    if (message.params?.name === 'echo') {
      respond(message.id, { content: [{ type: 'text', text: `echo:${message.params.arguments?.text ?? ''}` }] })
    } else {
      respond(message.id, { content: [{ type: 'text', text: 'boom' }], isError: true })
    }
    return
  }

  respond(message.id, null, { code: -32601, message: `Method not found: ${message.method}` })
})
