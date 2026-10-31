import readline from "node:readline/promises";
import { stdin as input, stdout as output, loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import path from "node:path";

loadEnvFile(new URL(".env", import.meta.url));

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

const messages = [
    {
        role: "system",
        content: "You are an assistant. Use read_file when you need the contents of a file in this project.",
    },
];

async function callModel(messages) {
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

    const data = await response.json();
    const message = data.choices[0].message;
    console.log("\n--- messages sent ---");
    console.log(JSON.stringify(messages, null, 2));
    return message;
}

async function readProjectFile(filePath) {
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
        return `Error: ${error.message}`;
    }
}

async function runTurn() {
    for (let step = 0; step < 8; step++) {
        const message = await callModel(messages);
        const assistantMessage = {
            role: "assistant",
            content: message.content ?? "",
        };
        if (message.tool_calls) {
            assistantMessage.tool_calls = message.tool_calls;
        }
        messages.push(assistantMessage);

        const toolCalls = message.tool_calls ?? [];
        if (toolCalls.length === 0) {
            console.log(`\nassistant> ${message.content}\n`);
            return;
        }

        for (const toolCall of toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`\ntool> ${toolCall.function.name} ${toolCall.function.arguments}`);
            const result = toolCall.function.name === "read_file"
                ? await readProjectFile(args.path)
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
