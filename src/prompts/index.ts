import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'
import type { Note } from '../index.js'

export function setListPrompts(server: Server) {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'summarize_note',
          description: 'Summarize the given note',
        },
        {
          name: 'suggest_refactor',
          description: 'Suggest refactoring the structure of children classification',
        },
        {
          name: 'suggest_fix',
          description: 'Suggest some fixes of the content of the givent note',
        },
        {
          name: 'suggest_enhance',
          description: 'Suggest some enhancements of the content of the givent note',
        },
      ],
    }
  })
}

export function setGetPrompt(server: Server) {
  server.setRequestHandler(GetPromptRequestSchema, async request => {
    const notes: Note[] = []
    if (request.params.name !== 'summarize_note') {
      throw new Error('Unknown prompt')
    }
 
    const embeddedNotes = Object.entries(notes).map(([id, note]) => ({
      type: 'resource' as const,
      resource: {
        uri: `note://${process.env.DOMAIN}/${id}`,
        mimeType: 'text/plain',
        text: note.content,
      },
    }))

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please summarize the following notes:',
          },
        },
        ...embeddedNotes.map(note => ({
          role: 'user' as const,
          content: note,
        })),
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Provide a concise summary of all the notes above.',
          },
        },
      ],
    }
  })
}
