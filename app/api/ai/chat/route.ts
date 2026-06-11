// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { toolExecutor } from "@/lib/agent/toolExecutor";
import { getSystemPrompt } from "@/lib/agent/systemPrompt";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { messages, memoryContext } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  const system = getSystemPrompt(memoryContext);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        let currentMessages = [...messages];
        let loopCount = 0;
        const MAX_LOOPS = 40;

        while (loopCount < MAX_LOOPS) {
          loopCount++;

          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            system,
            messages: currentMessages,
            tools: allTools as Anthropic.Tool[],
          });

          if (response.stop_reason === "tool_use") {
            const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            // Stream any text between tool calls as narration
            const textBlocks = response.content.filter(b => b.type === "text") as Anthropic.TextBlock[];
            if (textBlocks.length > 0) {
              const narration = textBlocks.map(b => b.text).join("\n\n").trim();
              if (narration) send({ type: "thinking", content: narration });
            }

            for (const toolUse of toolUseBlocks) {
              // Handle planner tools — send to UI immediately
              if (toolUse.name === "jarvis_plan") {
                send({ type: "plan", plan: { task_title: (toolUse.input as Record<string,unknown>).task_title, steps: ((toolUse.input as Record<string,string[]>).steps || []).map((s: string) => ({ text: s, status: "pending" })) } });
                toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify({ planned: true, step_count: (toolUse.input as Record<string,string[]>).steps?.length }) });
                continue;
              }

              if (toolUse.name === "jarvis_update_step") {
                send({ type: "plan_update", step_index: (toolUse.input as Record<string,number>).step_index, status: (toolUse.input as Record<string,string>).status, note: (toolUse.input as Record<string,string>).note });
                toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify({ updated: true }) });
                continue;
              }

              // Regular tool — notify UI
              send({ type: "tool_use", id: toolUse.id, name: toolUse.name, input: toolUse.input as Record<string,unknown> });

              // Execute
              const result = await toolExecutor(toolUse.name, toolUse.input as Record<string,unknown>);

              // Send result to UI
              send({ type: "tool_result", id: toolUse.id, content: result });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              });
            }

            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content },
              { role: "user" as const, content: toolResults },
            ];

          } else {
            // End turn — stream final text
            for (const block of response.content) {
              if (block.type === "text") {
                // Stream in small chunks for visual effect
                const text = block.text;
                const chunkSize = 6;
                for (let i = 0; i < text.length; i += chunkSize) {
                  send({ type: "response", content: text.slice(i, i + chunkSize) });
                  await new Promise(r => setTimeout(r, 8));
                }
              }
            }
            send({ type: "done" });
            break;
          }
        }

        if (loopCount >= MAX_LOOPS) {
          send({ type: "response", content: "\n\n⚠️ Limite de iterações atingido." });
          send({ type: "done" });
        }

      } catch (error) {
        send({ type: "error", message: (error as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
