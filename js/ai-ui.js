/**
 * AI Chat & Task Manager UI Controller
 */
const AIUI = (() => {
  const modal = document.getElementById('ai-modal');
  const chatMessages = document.getElementById('ai-chat-messages');
  const chatInput = document.getElementById('ai-chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  const taskHistoryList = document.getElementById('ai-task-history-list');

  let activeTaskCallback = null;

  function init(onLoadTaskIntoEditor) {
    activeTaskCallback = onLoadTaskIntoEditor;

    // Toggle Modal Controls
    document.getElementById('btn-ai-toggle').addEventListener('click', open);
    document.getElementById('btn-close-ai').addEventListener('click', close);
    document.getElementById('btn-close-ai-dot').addEventListener('click', close);

    btnSend.addEventListener('click', handleSend);
    
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    document.getElementById('btn-clear-chat').addEventListener('click', () => {
      JupyAI.clearHistory();
      chatMessages.innerHTML = '';
      appendWelcomeMessage();
      showToast("Chat Cleared", "ph-note-pencil");
    });

    renderTaskHistory();
  }

  function open() {
    modal.classList.remove('hidden');
    if (chatMessages.children.length === 0) {
      appendWelcomeMessage();
    }
    chatInput.focus();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function appendWelcomeMessage() {
    appendAIMessage({
      type: "chat",
      message: "Hi there! I'm Jupy (˶˃ᆺ˂˶). How can I help you with Python today? You can ask me questions or say **'Give me a task'** to generate a new challenge!",
      task: null
    });
  }

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendUserMessage(text);

    // Show loading typing indicator
    const loadingId = appendTypingIndicator();

    const currentProblem = window.getActiveProblem ? window.getActiveProblem() : null;
    const response = await JupyAI.sendMessage(text, currentProblem);

    // Remove typing indicator
    removeTypingIndicator(loadingId);

    // Render Jupy AI response
    appendAIMessage(response);

    // If response contains a task, save it to DB & update task history list
    if (response.type === "task" && response.task) {
      AppDB.saveTask(response.task);
      renderTaskHistory();
    }
  }

  function appendUserMessage(text) {
    const row = document.createElement('div');
    row.className = 'msg-row user';
    row.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function appendAIMessage(response) {
    const row = document.createElement('div');
    row.className = 'msg-row ai';

    let contentHtml = `<div class="ai-avatar"><i class="ph-fill ph-sparkle"></i></div><div class="ai-flat-content">`;
    contentHtml += formatMarkdownText(response.message);

    // If response includes a Task, append the interactive Apple Task Card!
    if (response.type === "task" && response.task) {
      const t = response.task;
      contentHtml += `
        <div class="inline-task-card">
          <div class="inline-task-header">
            <i class="ph-fill ph-code"></i>
            <span>${escapeHtml(t.title)}</span>
          </div>
          <div class="inline-task-desc">${t.description}</div>
          <button class="btn btn-primary btn-open-task" data-task-json='${encodeURIComponent(JSON.stringify(t))}'>
            <i class="ph-fill ph-play"></i> Open Task in Editor
          </button>
        </div>
      `;
    }

    contentHtml += `</div>`;
    row.innerHTML = contentHtml;
    chatMessages.appendChild(row);

    // Bind "Open Task" click handler
    row.querySelectorAll('.btn-open-task').forEach(btn => {
      btn.addEventListener('click', () => {
        const taskData = JSON.parse(decodeURIComponent(btn.getAttribute('data-task-json')));
        if (activeTaskCallback) activeTaskCallback(taskData);
        close();
        showToast("Task Loaded in Workspace", "ph-check-circle");
      });
    });

    scrollToBottom();
  }

  function renderTaskHistory() {
    const tasks = AppDB.getTasksHistory();
    taskHistoryList.innerHTML = '';

    if (tasks.length === 0) {
      taskHistoryList.innerHTML = `<div class="text-tertiary" style="font-size:11px; padding:10px;">No saved tasks yet.</div>`;
      return;
    }

    tasks.forEach(t => {
      const item = document.createElement('div');
      item.className = 'ai-task-item';
      item.innerHTML = `
        <i class="ph-fill ph-file-code"></i>
        <span class="task-item-title">${escapeHtml(t.title)}</span>
      `;
      item.addEventListener('click', () => {
        if (activeTaskCallback) activeTaskCallback(t);
        close();
        showToast("Loaded " + t.title, "ph-folder-open");
      });
      taskHistoryList.appendChild(item);
    });
  }

  function appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = id;
    row.innerHTML = `
      <div class="ai-avatar"><i class="ph-fill ph-sparkle"></i></div>
      <div class="ai-flat-content text-tertiary">
        <i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Jupy is thinking...
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function formatMarkdownText(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);

    // Format code blocks
    formatted = formatted.replace(/```python\s*([\s\S]*?)\s*```/g, '<div class="ai-code-block">$1</div>');
    formatted = formatted.replace(/```\s*([\s\S]*?)\s*```/g, '<div class="ai-code-block">$1</div>');
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Newlines
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { init, open, close };
})();