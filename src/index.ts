#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { setReadResource, setListResources } from './resources/index.js'
import { setListTools, setCallTool } from './tools/index.js'
import { setListPrompts, setGetPrompt } from './prompts/index.js'

import { NotionExporter } from '@texonom/cli'

export type Note = { title: string; content: string }
export type Content = { uri: string; mimeType: string; text: string }
export type Resource = { uri: string; mimeType: string; name: string; description: string }

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const domain = process.env.DOMAIN as string
  const root = process.env.ROOT_PAGE as string
  const exporter = new NotionExporter({ page: root, domain, folder: domain, validation: true, recursive: true })
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

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(error => {
  console.error('Server error:', error)
  process.exit(1)
})
