const input = document.getElementById("input");
const messagesDiv = document.getElementById("messages");
const closeBtn = document.getElementById("closeBtn");

const greetings = [
  "Hey 👋 I’m your desktop AI. What are we building today?",
  "Yo 😄 What’s up? Drop a task and I’ll jump on it.",
  "Hey! ⚡ Ready when you are — what do you need help with?",
  "Sup 🔥 Ask me anything. I’m floating and focused."
];

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
}

function greet() {
  const g = greetings[Math.floor(Math.random() * greetings.length)];
  addBubble(`AI: ${g}`, "ai");
}

closeBtn.addEventListener("click", async () => {
  // we’ll make this hide the window (not kill the app)
  await window.api.hide();
});

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && input.value.trim()) {
    const userText = input.value.trim();
    input.value = "";

    addBubble(`You: ${userText}`, "you");
    chatHistory.push({ role: "user", content: userText });

    // Show a small "typing" indicator
    addBubble("AI: …", "ai");
    const typingNode = messagesDiv.lastChild;

    try {
      const reply = await window.api.ask(chatHistory);
      typingNode.textContent = `AI: ${reply}`;
      chatHistory.push({ role: "assistant", content: reply });
    } catch (err) {
      typingNode.textContent = `AI: Sorry — error: ${err.message || err}`;
    }
  }
});

// start greeting immediately
greet();
