const input = document.getElementById("input");
const messagesDiv = document.getElementById("messages");
const closeBtn = document.getElementById("closeBtn");

const greetings = [
  "Sup 🔥 Ask me anything. I’m floating and focused.",
  "⚡ I’m your offline desktop AI. What should we tackle?",
  "👋 Hey! Drop a task — code, writing, anything.",
  "🧠 Ready. What do you need help with?"
];

let busy = false;

let chatHistory = [
  {
    role: "system",
    content:
      "You are a helpful, concise desktop assistant. Be friendly, practical, and quick. If user asks for code, provide copy-paste-ready code."
  }
];

function addBubble(text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.textContent = text;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return div;
}

function greet() {
  const g = greetings[Math.floor(Math.random() * greetings.length)];
  addBubble(`AI: ${g}`, "ai");
}

closeBtn.addEventListener("click", async () => {
  await window.api.hide();
});

input.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const userText = input.value.trim();
  if (!userText) return;

  if (busy) {
    addBubble("AI: One sec — I’m still answering the last message 🙂", "ai");
    return;
  }

  busy = true;
  input.value = "";

  addBubble(`You: ${userText}`, "you");
  chatHistory.push({ role: "user", content: userText });

  const typingNode = addBubble("AI: …", "ai");

  try {
    const reply = await window.api.ask(chatHistory);
    typingNode.textContent = `AI: ${reply}`;
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    typingNode.textContent = `AI: Error — ${err.message || err}`;
  } finally {
    busy = false;
    input.focus();
  }
});

greet();
