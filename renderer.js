const input = document.getElementById("input");
const messages = document.getElementById("messages");
const closeBtn = document.getElementById("closeBtn");

closeBtn.addEventListener("click", () => window.close());

function addMessage(sender, text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.textContent = `${sender}: ${text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && input.value.trim()) {
    addMessage("You", input.value, "you");
    input.value = "";
  }
});

window.api?.log?.("Renderer loaded.");
