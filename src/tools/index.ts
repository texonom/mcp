import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'
import type { Note } from '../index.js'

export function setListTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_note',
          description: 'Create a new note',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the note',
              },
              content: {
                type: 'string',
                description: 'Text content of the note',
              },
            },
            required: ['title', 'content'],
          },
        },
      ],
    }
  })
}

export function setCallTool(server: Server) {
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const notes: Note[] = []
    switch (request.params.name) {
      case 'find_relevent_notes': {
        const title = String(request.params.arguments?.title)
        const content = String(request.params.arguments?.content)
        if (!title || !content) {
          throw new Error('Title and content are required')
        }

        const id = 0
        notes[id] = { title, content }

        return {
          content: [
            {
              type: 'text',
              text: `Created note ${id}: ${title}`,
            },
          ],
        }
      }

      default:
        throw new Error('Unknown tool')
    }
  })
}
