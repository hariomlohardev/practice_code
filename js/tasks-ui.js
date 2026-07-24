/**
 * Notion-Style 2-Column Tasks & Files Board UI Controller
 */
const TasksUI = (() => {
  const modal = document.getElementById('tasks-modal');
  const searchInput = document.getElementById('task-search-input');

  const colListIncomplete = document.getElementById('col-list-incomplete');
  const colListCompleted = document.getElementById('col-list-completed');

  const countIncomplete = document.getElementById('count-incomplete');
  const countCompleted = document.getElementById('count-completed');

  let activeTaskCallback = null;

  function init(onLoadTaskCallback) {
    activeTaskCallback = onLoadTaskCallback;

    document.getElementById('btn-files-toggle').addEventListener('click', open);
    document.getElementById('btn-close-tasks').addEventListener('click', close);
    document.getElementById('btn-close-tasks-dot').addEventListener('click', close);

    if (searchInput) {
      searchInput.addEventListener('input', renderKanbanBoard);
    }
  }

  function open() {
    modal.classList.remove('hidden');
    renderKanbanBoard();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function renderKanbanBoard() {
    let tasks = AppDB.getTasksHistory();
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (query) {
      tasks = tasks.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.functionName.toLowerCase().includes(query)
      );
    }

    if (colListIncomplete) colListIncomplete.innerHTML = '';
    if (colListCompleted) colListCompleted.innerHTML = '';

    // Separate tasks strictly by completion status
    const incompleteTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => !!t.completed);

    if (countIncomplete) countIncomplete.innerText = incompleteTasks.length;
    if (countCompleted) countCompleted.innerText = completedTasks.length;

    if (colListIncomplete) renderColumnCards(incompleteTasks, colListIncomplete, false);
    if (colListCompleted) renderColumnCards(completedTasks, colListCompleted, true);
  }

  function renderColumnCards(taskList, container, isCompletedColumn) {
    if (taskList.length === 0) {
      container.innerHTML = `<div class="text-tertiary" style="font-size:11.5px; padding:20px; text-align:center;">${isCompletedColumn ? 'No completed tasks yet' : 'No incomplete tasks'}</div>`;
      return;
    }

    taskList.forEach(t => {
      const card = document.createElement('div');
      card.className = `notion-card ${isCompletedColumn ? 'completed' : ''}`;

      let priorityPill = `<span class="priority-pill medium">Medium</span>`;
      if (t.targetTimeMs <= 10) priorityPill = `<span class="priority-pill high">High 🔥</span>`;
      else if (t.targetTimeMs >= 20) priorityPill = `<span class="priority-pill easy">Easy ⚡</span>`;

      card.innerHTML = `
        <div class="notion-card-title-row">
          <i class="ph-fill ph-file-code notion-card-icon"></i>
          <span>${escapeHtml(t.title)}</span>
        </div>
        <div class="notion-card-meta">
          <span>fn: <code>${escapeHtml(t.functionName)}</code></span>
          <span>Target: ${t.targetTimeMs}ms</span>
        </div>
        <div class="notion-card-footer">
          ${priorityPill}
          <div class="card-actions-group">
            <button class="card-btn-action btn-open-card" title="Open in Editor">
              <i class="ph-fill ph-play"></i>
            </button>
            <button class="card-btn-action btn-delete-card" title="Delete Task">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </div>
      `;

      // Open in Editor Workspace
      card.querySelector('.btn-open-card').addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeTaskCallback) activeTaskCallback(t);
        close();
        showToast("Loaded " + t.title, "ph-folder-open");
      });

      // Delete Task
      card.querySelector('.btn-delete-card').addEventListener('click', (e) => {
        e.stopPropagation();
        AppDB.deleteTask(t.id);
        renderKanbanBoard();
        showToast("Task Removed", "ph-trash");
      });

      container.appendChild(card);
    });
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { init, open, close, renderKanbanBoard };
})();