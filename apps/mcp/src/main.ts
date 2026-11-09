import { handleMcpRequest } from './infrastructure/server/endpoint.ts'
import { createMcpNodeServer } from './infrastructure/server/node-server.ts'

const port = Number(process.env['PORT'] ?? '3001')
const host = process.env['HOST'] ?? '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('LEX MCP: PORT must be an integer between 1 and 65535.\n')
  process.exit(1)
}

const publicUrl = process.env['LEX_MCP_PUBLIC_URL']
const server = createMcpNodeServer({
  handleRequest: handleMcpRequest,
  ...(publicUrl ? { publicUrl } : {}),
})
server.on('error', () => {
  // No raw errors: upstream URLs, credentials and legal/client data must never enter logs.
  process.stderr.write('LEX MCP: HTTP server could not start.\n')
  process.exitCode = 1
})
server.listen(port, host, () => process.stdout.write(`LEX MCP listening on port ${port}.\n`))

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  server.close(() => process.exit(0))
  setTimeout(() => server.closeAllConnections(), 10000).unref()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
