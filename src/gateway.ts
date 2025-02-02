/**
 * This code enables the Claude Desktop App to communicate with the MCP SSE Transport server since Claude Desktop only supports STD in/out Transport only.
 * This source code is from https://github.com/boilingdata/mcp-server-and-gw/blob/main/src/claude_gateway.ts 
 */
// @ts-ignore
import EventSource from 'eventsource'

const MCP_HOST = process.env['MCP_HOST'] ?? 'localhost'
const MCP_PORT = process.env['MCP_PORT'] ?? 3000
const baseUrl = `http://${MCP_HOST}:${MCP_PORT}`
const backendUrlSse = `${baseUrl}/sse`
const backendUrlMsg = `${baseUrl}/message`

const debug = console.error // With stdio transport stderr is the only channel for debugging
const respond = console.log // Message back to Claude Desktop App.

/*
 * Claude MCP has two communications channels.
 * 1. All the responses (and notifications) from the MCP server comes through the
 *    persistent HTTP connection (i.e. Server-Side Events).
 * 2. However, the requests are sent as HTTP POST messages and for which the server
 *    responds HTTP 202 Accept (the "actual" response is sent through the SSE connection)
 */

// 1. Establish persistent MCP server SSE connection and forward received messages to stdin
function connectSSEBackend() {
  return new Promise((resolve, reject) => {
    const source = new EventSource(backendUrlSse)
    source.onopen = (evt: MessageEvent) => resolve(evt)
    source.addEventListener('error', (e: unknown) => reject(e))
    source.addEventListener('open', (e: unknown) => debug(`--- SSE backend connected`))
    source.addEventListener('error', (e: unknown) => debug(`--- SSE backend disc./error: ${(<{message: string}>e)?.message}`))
    source.addEventListener('message', (e: unknown) => debug(`<-- ${(e as {data: string}).data}`))
    source.addEventListener('message', (e: unknown) => respond((e as {data: string}).data)) // forward to Claude Desktop App via stdio transport
  })
}

// 2. Forward received message to the MCP server
async function processMessage(inp: Buffer) {
  const msg = inp.toString()
  debug('-->', msg.trim())
  const [method, body, headers] = ['POST', msg, { 'Content-Type': 'application/json' }]
  await fetch(new URL(backendUrlMsg), { method, body, headers }).catch(e => debug('fetch error:', e))
}

async function runBridge() {
  await connectSSEBackend()
  process.stdin.on('data', processMessage)
  debug('-- MCP stdio to SSE gw running')
}

runBridge().catch(error => {
  debug('Fatal error running server:', error)
  process.exit(1)
})
