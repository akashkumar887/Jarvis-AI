import { env, MODEL, SYSTEM_PROMPT } from '../config'

export type Msg = {
  role: 'user' | 'model' | 'assistant'
  content: string
}

export type AskHandlers = {
  /** Fires for each chunk of the spoken answer. */
  onText: (delta: string) => void
  /** Fires when a tool begins. */
  onTool: (name: string) => void
}

let activeAbortController: AbortController | null = null
let cancelled = false

export function cancel(): void {
  cancelled = true
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

/**
 * One turn of conversation with Google Gemini via streaming API.
 */
export async function ask(
  history: Msg[],
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  cancelled = false
  const key = env.geminiKey
  if (!key) {
    throw new Error('No Gemini API key available.')
  }

  const usedTools: string[] = []
  let fullText = ''

  activeAbortController = new AbortController()

  // Format contents for Gemini REST API
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const candidateModels = Array.from(new Set([MODEL, 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']))
  let response: Response | null = null
  let lastErrText = ''

  for (const m of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${key}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
        signal: activeAbortController.signal,
      })
      if (res.ok) {
        response = res
        break
      } else {
        lastErrText = await res.text()
      }
    } catch (fetchErr: any) {
      if (cancelled) return { text: fullText.trim(), tools: usedTools }
      lastErrText = fetchErr.message
    }
  }

  if (!response) {
    throw new Error(`Gemini API connection error: ${lastErrText || 'All models failed.'}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get streaming response body from Gemini.')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (!cancelled) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6)
          try {
            const data = JSON.parse(jsonStr)
            const candidate = data.candidates?.[0]
            const parts = candidate?.content?.parts || []
            for (const part of parts) {
              if (part.text) {
                fullText += part.text
                handlers.onText(part.text)
              }
              if (part.functionCall) {
                usedTools.push(part.functionCall.name)
                handlers.onTool(part.functionCall.name)
              }
            }
          } catch {
            // ignore non-json chunk
          }
        }
      }
    }
  } catch (err) {
    if (cancelled) return { text: fullText.trim(), tools: usedTools }
    throw err
  } finally {
    activeAbortController = null
  }

  return { text: fullText.trim(), tools: usedTools }
}

export function connectedLabels(): string[] {
  return ['Gemini Brain']
}
