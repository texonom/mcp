#!/usr/bin/env node

import express from 'express'
import bodyParser from 'body-parser'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { setReadResource, setListResources } from './resources/index.js'
import { setListTools, setCallTool } from './tools/index.js'
import { setListPrompts, setGetPrompt } from './prompts/index.js'
import { NotionExporter } from '@texonom/cli'

export type Note = { title: string; content: string }
export type Content = { uri: string; mimeType: string; text: string }
export type Resource = { uri: string; mimeType: string; name: string; description: string }

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('port', {
      type: 'number',
      default: 8000,
      description: 'Port to run on (default: 8000)'
    })
    .option('stdio', {
      type: 'string',
      demandOption: true,
      description: 'Command that runs an MCP server over stdio'
    })
    .option('baseUrl', {
      type: 'string',
      default: '',
      description: 'Base URL for the server'
    })
    .help()
    .parseSync()

  const PORT = argv.port
  const STDIO_CMD = argv.stdio
  const BASE_URL = argv.baseUrl

  console.log('[supergateway] Starting...')
  console.log('[supergateway] Supergateway is supported by Superinterface - https://superinterface.ai')
  console.log(`[supergateway]  - port: ${PORT}`)
  console.log(`[supergateway]  - stdio: ${STDIO_CMD}`)

  if (BASE_URL) {
    console.log(`[supergateway]  - baseUrl: ${BASE_URL}`)
  }

  const child: ChildProcessWithoutNullStreams = spawn(STDIO_CMD, { shell: true })

  child.on('exit', (code, signal) => {
    console.error(`[supergateway] Child process exited with code=${code}, signal=${signal}`)
    process.exit(code ?? 1)
  })

  const root = process.env.ROOT_PAGE as string
  const exporter = new NotionExporter({ page: root, domain: String(), folder: String(), validation: true, recursive: true })
  const client = exporter.notion
  const server = new Server(
    {
      name: 'notion-texonom',
      version: '0.1.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    },
  )

  // Resources
  setReadResource(server, client, exporter)
  setListResources(server, client, exporter)

  // Tools
  setListTools(server)
  setCallTool(server, client, exporter)

  // Prompts
  setListPrompts(server)
  setGetPrompt(server, client, exporter)

  let sseTransport: SSEServerTransport | undefined

  const app = express()

  app.use((req, res, next) => {
    if (req.path === '/message') {
      return next()
    }

    return bodyParser.json()(req, res, next)
  })

  app.get('/sse', async (req, res) => {
    console.log(`[supergateway] New SSE connection from ${req.ip}`)

    sseTransport = new SSEServerTransport(`${BASE_URL}/message`, res)
    await server.connect(sseTransport)

    sseTransport.onmessage = (msg: JSONRPCMessage) => {
      const line = JSON.stringify(msg)
      console.log('[supergateway] SSE -> Child:', line)
      child.stdin.write(line + '\n')
    }

    sseTransport.onclose = () => {
      console.log('[supergateway] SSE connection closed.')
    }

    sseTransport.onerror = err => {
      console.error('[supergateway] SSE transport error:', err)
    }
  })

  app.post('/message', async (req, res) => {
    if (sseTransport?.handlePostMessage) {
      console.log('[supergateway] POST /message -> SSE transport')
      await sseTransport.handlePostMessage(req, res)
    } else {
      res.status(503).send('No SSE connection active')
    }
  })

  let buffer = ''

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8')

    let lines = buffer.split(/\r?\n/)

    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const jsonMsg = JSON.parse(line)
        console.log('[supergateway] Child -> SSE:', jsonMsg)
        sseTransport?.send(jsonMsg)
      } catch {
        console.error('[supergateway] Child produced non-JSON line:', line)
      }
    }
  })

  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8')
    console.log('[supergateway] [child stderr]', text)
  })

  app.listen(PORT, () => {
    console.log(`[supergateway] Listening on port ${PORT}`)
    console.log(`  SSE endpoint:   http://localhost:${PORT}/sse`)
    console.log(`  POST messages:  http://localhost:${PORT}/message`)
  })
}

main().catch(err => {
  console.error('[supergateway] Fatal error:', err)
  process.exit(1)
})
