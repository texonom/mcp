#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { setReadResource, setListResources } from './resources/index.js'
import { setListTools, setCallTool } from './tools/index.js'
import { setListPrompts, setGetPrompt } from './prompts/index.js'

import { NotionExporter } from '@texonom/cli'

export type Note = { title: string; content: string }

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const exporter = new NotionExporter({ page: process.env.ROOT_PAGE as string, domain: process.env.DOMAIN as string })
  const client = exporter.notion
  const server = new Server(
    {
      name: 'mcp',
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
  setListResources(server)

  // Tools
  setListTools(server)
  setCallTool(server)

  // Prompts
  setListPrompts(server)
  setGetPrompt(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(error => {
  console.error('Server error:', error)
  process.exit(1)
})
