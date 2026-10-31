import readline from "node:readline/promises";
import { stdin as input, stdout as output, loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import path from "node:path";

loadEnvFile(new URL(".env", import.meta.url));

type ToolCall = {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
};

type ChatMessage =
    | { role: "system" | "user"; content: string }
    | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };

type ModelMessage = {
    content: string | null;
    tool_calls?: ToolCall[];
};

type CompletionResponse = {
    choices: Array<{ message: ModelMessage }>;
};

const READ_FILE = {
    type: "function",
    function: {
        name: "read_file",
        description: "Read a UTF-8 text file from the project directory.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Path to the file, relative to the project directory.",
                },
            },
            required: ["path"],
        },
    },
};

const messages: ChatMessage[] = [
    {
        role: "system",
        content: "You are an assistant. Use read_file when you need the contents of a file in this project.",
    },
];

async function callModel(messages: ChatMessage[]): Promise<ModelMessage> {
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-type": "application/json",
        },
        body: JSON.stringify({
            model: process.env.MODEL ?? "gpt-4o-mini",
            messages,
            tools: [READ_FILE],
        }),
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as CompletionResponse;
    const message = data.choices[0].message;
    console.log("\n--- messages sent ---");
    console.log(JSON.stringify(messages, null, 2));
    return message;
}

async function readProjectFile(filePath: string): Promise<string> {
    const root = process.cwd();
    const resolved = path.resolve(root, filePath);
    const insideProject = resolved === root || resolved.startsWith(root + path.sep);
    if (!insideProject) {
        return "Error: path is outside the project directory.";
    }
    if (path.basename(resolved) === ".env") {
        return "Error: refusing to read .env.";
    }

    try {
        return await readFile(resolved, "utf8");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `Error: ${message}`;
    }
}

function filePathFromArgs(raw: string): string {
    const parsed: unknown = JSON.parse(raw);
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("path" in parsed) ||
        typeof parsed.path !== "string"
    ) {
        throw new Error("read_file requires a path string");
    }
    return parsed.path;
}

async function runTurn(): Promise<void> {
    for (let step = 0; step < 8; step++) {
        const message = await callModel(messages);
        const assistantMessage: ChatMessage = {
            role: "assistant",
            content: message.content ?? "",
            ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
        };
        messages.push(assistantMessage);

        const toolCalls = message.tool_calls ?? [];
        if (toolCalls.length === 0) {
            console.log(`\nassistant> ${message.content}\n`);
            return;
        }

        for (const toolCall of toolCalls) {
            console.log(`\ntool> ${toolCall.function.name} ${toolCall.function.arguments}`);
            const result = toolCall.function.name === "read_file"
                ? await readProjectFile(filePathFromArgs(toolCall.function.arguments))
                : `Error: unknown tool ${toolCall.function.name}`;
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
            });
        }
    }

    console.log("\nassistant> stopped after 8 steps\n");
}

const rl = readline.createInterface({ input, output });

while (true) {
    const text = await rl.question("you> ");
    if (text === "exit") break;

    messages.push({ role: "user", content: text });
    await runTurn();
}

rl.close();
