import { ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { parsePageId } from '@texonom/nutils'

import type { Server } from '@modelcontextprotocol/sdk/server/index.js'
import type { NotionAPI } from '@texonom/nclient'
import type { NotionExporter } from '@texonom/cli'

const prompts = ['summarize_note', 'suggest_refactor', 'suggest_fix', 'suggest_enhance']

export function setListPrompts(server: Server) {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'summarize_note',
          description: 'Summarize the given note',
          arguments: [
            {
              name: 'uri',
              description: 'The URI of the note to summarize',
              required: true,
            },
          ]
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

export function setGetPrompt(server: Server, client: NotionAPI, exporter: NotionExporter) {
  server.setRequestHandler(GetPromptRequestSchema, async request => {
    if (!prompts.includes(request.params.name)) 
      throw new Error('Unknown prompt')
    const uri = String(request.params.arguments?.uri)
    const id = parsePageId(uri)
    if (!id) throw new Error(`Note ${uri} not found`)
    const recordMap = await client.getPage(id)
    if (!recordMap) throw new Error(`Record Map ${id} not found`)
    const md = await exporter.pageToMarkdown(id, recordMap)

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Summarize the given note:',
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: md
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Provide a concise summary of the note above.',
          },
        },
      ],
    }
  })
}
