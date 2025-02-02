#!/usr/bin/env node
import express from 'express'
import bodyParser from 'body-parser'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { setReadResource, setListResources } from './resources/index.js'
import { setListTools, setCallTool } from './tools/index.js'
import { setListPrompts, setGetPrompt } from './prompts/index.js'
import { NotionExporter } from '@texonom/cli'
import cors from 'cors'

// Type definitions (if needed)
export type Note = { title: string; content: string }
export type Content = { uri: string; mimeType: string; text: string }
export type Resource = { uri: string; mimeType: string; name: string; description: string }


/**
 * Start the server using SSE transport.
 * This migration is required for remote deployment for shared usage of the server.
 */
async function main() {
  // Retrieve the root page and other configurations from environment variables.
  const root = process.env.ROOT_PAGE as string
  if (!root) {
    console.error('Error: ROOT_PAGE environment variable is not set.')
    process.exit(1)
  }

  // Initialize NotionExporter.
  const exporter = new NotionExporter({
    page: root,
    domain: String(),
    folder: String(),
    validation: true,
    recursive: true,
  })
  const client = exporter.notion

  // Create a server instance
  const server = new Server(
    {
      name: 'notion-texonom',
      version: '0.2.0',
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

  // Configure Express app and SSE transport
  const app = express()
  app.use(cors())
  const BASE_URL = 'http://localhost'
  const PORT = Number(process.env.PORT) || 3000
  const SSE_PATH = '/sse'
  const MESSAGE_PATH = '/message'

  // JSON request parsing middleware (only for POST /message)
  app.use((req, res, next) => {
    if (req.path === MESSAGE_PATH)
      return next()
    return bodyParser.json()(req, res, next)
  })

  // SSE connection setup endpoint
  let sseTransport: SSEServerTransport | null = null

  app.get(SSE_PATH, async (req, res) => {
    req.query.transportType = 'sse'
    console.log(`[notion-texonom] New SSE connection from ${req.ip}`)
    sseTransport = new SSEServerTransport(`${BASE_URL}:${PORT}${MESSAGE_PATH}`, res)
    try {
      await server.connect(sseTransport)
      console.log('[notion-texonom] Server connected via SSE transport.')
    } catch (error) {
      console.error('[notion-texonom] Error connecting server via SSE:', error)
      res.status(500).end()
    }

    // Optionally, define handlers for onmessage, onclose, and onerror.
    sseTransport.onmessage = (msg) => {
      console.log('[notion-texonom] SSE received message:', msg)
      // Additional processing if needed
    }
    sseTransport.onclose = () => {
      console.log('[notion-texonom] SSE connection closed.')
      sseTransport = null
    }
    sseTransport.onerror = (err) => {
      console.error('[notion-texonom] SSE transport error:', err)
    }
  })

  // Endpoint to handle messages sent from the client
  app.post(MESSAGE_PATH, async (req, res) => {
    req.query.transportType = 'sse'
    if (sseTransport && sseTransport.handlePostMessage) {
      console.log(`[notion-texonom] POST ${MESSAGE_PATH} -> processing SSE message`)
      await sseTransport.handlePostMessage(req, res)
    } else {
      res.status(503).send('No SSE connection active')
    }
  })

  // Start the server
  app.listen(PORT, () => {
    console.log(`[notion-texonom] Listening on port ${PORT}`)
    console.log(`  SSE endpoint:   http://localhost:${PORT}${SSE_PATH}`)
    console.log(`  POST messages:  http://localhost:${PORT}${MESSAGE_PATH}`)
  })
}

main().catch(error => {
  console.error('Server error:', error)
  process.exit(1)
})
