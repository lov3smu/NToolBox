import { readToolResult } from '../../../services/toolResults.js'

export default async function handler(params) {
  return await readToolResult(params.result_id, {
    offset: params.offset,
    limit: params.limit
  })
}
