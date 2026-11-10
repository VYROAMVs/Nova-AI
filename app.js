
/* =========================================
   NOVA AI — FRONTEND ENGINE
   Version: 1.0
========================================= */

// BACKEND CONFIGURATION
// Add your deployed API URL here when the backend is ready.
// Example: https://your-api.example.com

const API_BASE_URL = "";

// Set true when a compatible backend is deployed.
const USE_LIVE_BACKEND = false;

const STORAGE_KEY = "nova_ai_conversations";
const THEME_KEY = "nova_ai_theme";

// DOM ELEMENTS
const $ = (selector) => document.querySelector(selector);

const elements = {
  sidebar: $("#sidebar"),
  openSidebar: $("#openSidebar"),
  closeSidebar: $("#closeSidebar"),
  overlay: $("#mobileOverlay"),

  newChat: $("#newChat"),
  historyList: $("#historyList"),
  historyCount: $("#historyCount"),

  welcome: $("#welcomeScreen"),
  messages: $("#messagesContainer"),
  viewport: $("#chatViewport"),

  input: $("#messageInput"),
  send: $("#sendButton"),

  modelButton: $("#modelButton"),
  modelDropdown: $("#modelDropdown"),
  selectedModel: $("#selectedModel"),

  themeToggle: $("#themeToggle"),

  attachBtn: $("#attachBtn"),
  fileInput: $("#fileInput"),
  attachmentPreview: $("#attachmentPreview"),
  attachmentName: $("#attachmentName"),
  removeAttachment: $("#removeAttachment"),

  toast: $("#toast")
};

// APP STATE
let conversations = loadConversations();
let activeChatId = null;
let isGenerating = false;
let selectedFile = null;
let generationController = null;
let toastTimeout = null;

// STORAGE
function loadConversations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load conversations:", error);
    return [];
  }
}

function saveConversations() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
  } catch (error) {
    showToast("Storage limit reached. Some chats may not save.");
  }
}

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function getActiveChat() {
  return conversations.find(
    chat => chat.id === activeChatId
  );
}

// TOAST
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2300);
}

// NEW CHAT
function createNewChat() {
  if (isGenerating) {
    stopGeneration();
  }

  activeChatId = null;

  elements.messages.innerHTML = "";
  elements.messages.classList.add("hidden");
  elements.welcome.classList.remove("hidden");

  elements.input.value = "";
  elements.input.style.height = "auto";

  removeSelectedFile();
  renderHistory();

  elements.input.focus();
}

// CONVERSATION MANAGEMENT
function ensureConversation() {
  let chat = getActiveChat();

  if (!chat) {
    chat = {
      id: createId(),
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    conversations.unshift(chat);
    activeChatId = chat.id;
  }

  return chat;
}

function updateChatTitle(chat) {
  if (chat.title !== "New conversation") return;

  const firstUserMessage = chat.messages.find(
    message => message.role === "user"
  );

  if (firstUserMessage) {
    chat.title = firstUserMessage.content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 34);

    if (firstUserMessage.content.length > 34) {
      chat.title += "...";
    }
  }
}

function openConversation(id) {
  if (isGenerating) {
    stopGeneration();
  }

  const chat = conversations.find(item => item.id === id);

  if (!chat) return;

  activeChatId = id;

  elements.welcome.classList.add("hidden");
  elements.messages.classList.remove("hidden");
  elements.messages.innerHTML = "";

  chat.messages.forEach(message => {
    addMessageToDOM(message.role, message.content, false);
  });

  renderHistory();
  closeMobileSidebar();
  scrollToBottom();
}

// HISTORY SIDEBAR
function renderHistory() {
  elements.historyList.innerHTML = "";

  elements.historyCount.textContent = conversations.length;

  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-history";
    empty.textContent = "Your conversations will appear here.";
    elements.historyList.appendChild(empty);
    return;
  }

  conversations
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach(chat => {
      const button = document.createElement("button");
      button.className = "history-item";

      if (chat.id === activeChatId) {
        button.classList.add("active");
      }

      const icon = document.createElement("span");
      icon.textContent = "◈";

      const title = document.createElement("span");
      title.className = "history-title";
      title.textContent = chat.title;

      button.append(icon, title);

      button.addEventListener("click", () => {
        openConversation(chat.id);
      });

      elements.historyList.appendChild(button);
    });
}

// MESSAGE UI
function addMessageToDOM(role, content, animate = true) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  if (!animate) {
    row.style.animation = "none";
  }

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "✦";
    row.appendChild(avatar);
  }

  const body = document.createElement("div");
  body.className = "message-body";

  const author = document.createElement("div");
  author.className = "message-author";
  author.textContent = role === "user" ? "You" : "NOVA";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  body.append(author, text);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "message-action";
    copyButton.textContent = "Copy";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text.textContent);
        showToast("Copied to clipboard!");
      } catch {
        showToast("Clipboard access unavailable.");
      }
    });

    actions.appendChild(copyButton);
    body.appendChild(actions);
  }

  row.appendChild(body);
  elements.messages.appendChild(row);

  return text;
}

function addTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message-row";
  row.id = "typingIndicator";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "✦";

  const body = document.createElement("div");
  body.className = "message-body";

  const author = document.createElement("div");
  author.className = "message-author";
  author.textContent = "NOVA";

  const typing = document.createElement("div");
  typing.className = "typing-indicator";

  for (let i = 0; i < 3; i++) {
    typing.appendChild(document.createElement("span"));
  }

  body.append(author, typing);
  row.append(avatar, body);

  elements.messages.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  $("#typingIndicator")?.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.viewport.scrollTop =
      elements.viewport.scrollHeight;
  });
}

// MESSAGE SENDING
async function sendMessage(customMessage = null) {
  if (isGenerating) return;

  const content = (
    customMessage ?? elements.input.value
  ).trim();

  if (!content && !selectedFile) return;

  if (selectedFile) {
    showToast("File uploads will be enabled in a future update.");
    if (!content) return;
  }

  const chat = ensureConversation();

  elements.welcome.classList.add("hidden");
  elements.messages.classList.remove("hidden");

  const userMessage = {
    role: "user",
    content
  };

  chat.messages.push(userMessage);
  chat.updatedAt = Date.now();

  updateChatTitle(chat);

  addMessageToDOM("user", content);

  elements.input.value = "";
  elements.input.style.height = "auto";

  removeSelectedFile();

  saveConversations();
  renderHistory();
  scrollToBottom();

  isGenerating = true;
  elements.send.disabled = true;

  await generateResponse(chat);
}

// AI RESPONSE
async function generateResponse(chat) {
  addTypingIndicator();

  try {
    let reply;

    if (USE_LIVE_BACKEND && API_BASE_URL) {
      reply = await requestBackend(chat);
    } else {
      await wait(1100);
      reply = generateDemoResponse(
        chat.messages[chat.messages.length - 1].content
      );
    }

    removeTypingIndicator();

    const assistantMessage = {
      role: "assistant",
      content: reply
    };

    chat.messages.push(assistantMessage);
    chat.updatedAt = Date.now();

    addMessageToDOM("assistant", reply);

    saveConversations();
    renderHistory();

  } catch (error) {
    removeTypingIndicator();

    if (error.name === "AbortError") {
      showToast("Generation stopped.");
    } else {
      console.error("AI request failed:", error);
      showToast("AI connection failed. Please try again.");
    }

  } finally {
    isGenerating = false;
    generationController = null;
    elements.send.disabled = false;
    scrollToBottom();
  }
}

// FUTURE BACKEND CONNECTION
// Expected endpoint: POST /api/chat
// Expected JSON: { "messages": [...] }
// Expected response: { "reply": "..." }

async function requestBackend(chat) {
  generationController = new AbortController();

  const response = await fetch(
    `${API_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chat.messages
      }),
      signal: generationController.signal
    }
  );

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const data = await response.json();

  if (typeof data.reply !== "string") {
    throw new Error("Invalid backend response.");
  }

  return data.reply;
}

// DEMO RESPONSES
// This is only a temporary frontend preview.
// It is NOT a real language model.

function generateDemoResponse(message) {
  const text = message.toLowerCase();

  if (text.includes("hello") || text.includes("hi")) {
    return "Hey! Welcome to NOVA AI. ✨\n\nI'm currently running in preview mode. Once the AI backend is connected, you'll be able to have real conversations with me.";
  }

  if (text.includes("who are you") || text.includes("your name")) {
    return "I'm NOVA, your AI workspace.\n\nMy real intelligence engine is still being developed. For now, you're exploring the frontend preview!";
  }

  if (text.includes("website") || text.includes("code")) {
    return "That's an interesting project!\n\nNOVA's real coding capabilities will become available after we connect the language model backend.\n\nFor now, we are building the foundation of the platform.";
  }

  return "Thanks for your message! ✨\n\nNOVA is currently in preview mode. The actual AI model hasn't been connected yet.\n\nOnce our backend is ready, I'll be able to understand your question and generate intelligent responses.";
}

// STOP GENERATION
function stopGeneration() {
  if (generationController) {
    generationController.abort();
  }

  removeTypingIndicator();

  isGenerating = false;
  generationController = null;
  elements.send.disabled = false;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// INPUT EVENTS
elements.send.addEventListener("click", () => {
  sendMessage();
});

elements.input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

elements.input.addEventListener("input", () => {
  elements.input.style.height = "auto";

  elements.input.style.height =
    Math.min(elements.input.scrollHeight, 180) + "px";
});

// SUGGESTION CARDS
document.querySelectorAll(".suggestion-card").forEach(card => {
  card.addEventListener("click", () => {
    sendMessage(card.dataset.prompt);
  });
});

// NEW CHAT
elements.newChat.addEventListener("click", createNewChat);

// MODEL SELECTOR
elements.modelButton.addEventListener("click", () => {
  elements.modelDropdown.classList.toggle("hidden");
});

document.querySelectorAll(".model-option").forEach(option => {
  option.addEventListener("click", () => {
    const model = option.dataset.model;

    elements.selectedModel.textContent = model;

    document.querySelectorAll(".model-option").forEach(item => {
      item.classList.remove("selected");
      item.querySelector(".option-check")?.remove();
    });

    option.classList.add("selected");

    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = "✓";
    option.appendChild(check);

    elements.modelDropdown.classList.add("hidden");

    if (model === "NOVA Reasoning") {
      showToast("This model is planned for a future release.");
      elements.selectedModel.textContent = "NOVA Smart";
    }
  });
});

document.addEventListener("click", event => {
  if (!event.target.closest(".model-selector-wrap")) {
    elements.modelDropdown.classList.add("hidden");
  }
});

// THEME
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  elements.themeToggle.textContent =
    theme === "light" ? "☾" : "☼";

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("light")
    ? "dark"
    : "light";

  applyTheme(nextTheme);
});

// FILE PREVIEW
elements.attachBtn.addEventListener("click", () => {
  elements.fileInput.click();
});

elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files?.[0];

  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast("Maximum preview file size is 10 MB.");
    elements.fileInput.value = "";
    return;
  }

  selectedFile = file;

  elements.attachmentName.textContent = file.name;
  elements.attachmentPreview.classList.remove("hidden");
});

function removeSelectedFile() {
  selectedFile = null;
  elements.fileInput.value = "";
  elements.attachmentPreview.classList.add("hidden");
  elements.attachmentName.textContent = "";
}

elements.removeAttachment.addEventListener(
  "click",
  removeSelectedFile
);

// VOICE INPUT PLACEHOLDER
$("#voiceBtn").addEventListener("click", () => {
  showToast("Voice input is coming soon.");
});

// EXPLORE PLACEHOLDER
$("#exploreBtn").addEventListener("click", () => {
  showToast("Explore is coming in a future update.");
});

$("#profileBtn").addEventListener("click", () => {
  showToast("User accounts are coming soon.");
});

// MOBILE SIDEBAR
function openMobileSidebar() {
  elements.sidebar.classList.add("open");
  elements.overlay.classList.add("show");
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove("open");
  elements.overlay.classList.remove("show");
}

elements.openSidebar.addEventListener(
  "click",
  openMobileSidebar
);

elements.closeSidebar.addEventListener(
  "click",
  closeMobileSidebar
);

elements.overlay.addEventListener(
  "click",
  closeMobileSidebar
);

// KEYBOARD SHORTCUTS
document.addEventListener("keydown", event => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k"
  ) {
    event.preventDefault();
    createNewChat();
  }

  if (event.key === "Escape") {
    elements.modelDropdown.classList.add("hidden");
    closeMobileSidebar();
  }
});

// INITIALIZATION
function initializeApp() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";

  applyTheme(savedTheme);
  renderHistory();

  createNewChat();

  console.log("NOVA AI Frontend initialized successfully.");
}

initializeApp();
