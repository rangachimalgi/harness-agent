import readline from "node:readline/promises";
import { stdin as input, stdout as output, loadEnvFile } from "node:process";

loadEnvFile(new URL(".env", import.meta.url));

const messages = [
    { role: "system", content: "You are an assistant" },
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
        }),
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    console.log("\n--- messages sent ---");
    console.log(JSON.stringify(messages, null, 2));
    return reply;
}
    const rl = readline.createInterface({ input, output });

    while (true) {
        const text = await rl.question("you> ");
        if (text === "exit") break;

        messages.push({ role: "user", content: text });
        const reply = await callModel(messages);
        messages.push({ role: "assistant", content: reply });
        console.log(`\nassistant> ${reply}\n`);
    }

    rl.close();
