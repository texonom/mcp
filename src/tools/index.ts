import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'
import type { ExtendedRecordMap } from '@texonom/ntypes'

export function setListTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_notes',
          description: 'Search notes by a query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query to search',
              },
            },
            required: ['query'],
          },
        },
      ],
    }
  })
}

export function setCallTool(server: Server, client: NotionAPI, exporter: NotionExporter) {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    switch (request.params.name) {
      case 'search_notes': {
        const query = String(request.params.arguments?.query)
        if (!query) throw new Error('Query is required')
        const response = await client.search({
          query,
          ancestorId: process.env.ROOT_PAGE as string,
          filters: {
            isDeletedOnly: false,
            excludeTemplates: true,
            navigableBlockContentOnly: true,
            requireEditPermissions: false,
          },
        })
        const { results, recordMap } = response
        const filteredResults = results.filter(result => {
          const block = recordMap.block[result.id]?.value
          return block && block.type === 'page' && !block.is_template
        })
        return {
          content: filteredResults.map(result => {
            return {
              type: 'text',
              // @ts-ignore
              text: result.highlight.title
            }
          }),
        }
      }

      default:
        throw new Error('Unknown tool')
    }
  })
}
