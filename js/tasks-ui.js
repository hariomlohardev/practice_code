/**
 * Tasks & Files Library UI Controller
 */
const TasksUI = (() => {
  const modal = document.getElementById('tasks-modal');
  const tasksContainer = document.getElementById('tasks-list-container');
  const searchInput = document.getElementById('task-search-input');

  const btnFilterAll = document.getElementById('filter-task-all');
  const btnFilterIncomplete = document.getElementById('filter-task-incomplete');
  const btnFilterCompleted = document.getElementById('filter-task-completed');

  let activeFilter = 'all'; // 'all' | 'incomplete' | 'completed'
  let activeTaskCallback = null;

  function init(onLoadTaskCallback) {
    activeTaskCallback = onLoadTaskCallback;

    document.getElementById('btn-files-toggle').addEventListener('click', open);
    document.getElementById('btn-close-tasks').addEventListener('click', close);
    document.getElementById('btn-close-tasks-dot').addEventListener('click', close);

    btnFilterAll.addEventListener('click', () => setFilter('all'));
    btnFilterIncomplete.addEventListener('click', () => setFilter('incomplete'));
    btnFilterCompleted.addEventListener('click', () => setFilter('completed'));

    searchInput.addEventListener('input', renderTasksList);
  }

  function open() {
    modal.classList.remove('hidden');
    renderTasksList();
  }

  function close() {
    modal.classList.add('hidden');
  }

  function setFilter(filterType) {
    activeFilter = filterType;
    btnFilterAll.classList.toggle('active', filterType === 'all');
    btnFilterIncomplete.classList.toggle('active', filterType === 'incomplete');
    btnFilterCompleted.classList.toggle('active', filterType === 'completed');
    renderTasksList();
  }

  function renderTasksList() {
    let tasks = AppDB.getTasksHistory();
    const query = searchInput.value.trim().toLowerCase();

    // 1. Filter by Search Query
    if (query) {
      tasks = tasks.filter(t => t.title.toLowerCase().includes(query) || t.functionName.toLowerCase().includes(query));
    }

    // 2. Filter by Category Tab
    if (activeFilter === 'incomplete') {
      tasks = tasks.filter(t => !t.completed);
    } else if (activeFilter === 'completed') {
      tasks = tasks.filter(t => t.completed);
    }

    // 3. Align & Sort: Incomplete tasks first, Completed tasks last
    tasks.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);

    tasksContainer.innerHTML = '';

    if (tasks.length === 0) {
      tasksContainer.innerHTML = `<div class="text-tertiary" style="text-align:center; padding: 40px;">No tasks found.</div>`;
      return;
    }

    tasks.forEach(t => {
      const isCompleted = !!t.completed;
      const row = document.createElement('div');
      row.className = `task-card-row ${isCompleted ? 'completed' : ''}`;

      const statusBadge = isCompleted 
        ? `<span class="badge-status completed-badge">✔ Completed</span>` 
        : `<span class="badge-status incomplete-badge">In Progress</span>`;

      row.innerHTML = `
        <div class="task-row-left">
          <button class="status-toggle-btn" title="${isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}">
            ${isCompleted ? '<i class="ph-bold ph-check"></i>' : ''}
          </button>

          <div class="task-details">
            <span class="task-title">${escapeHtml(t.title)}</span>
            <div class="task-meta">
              <span>fn: <code>${escapeHtml(t.functionName)}</code></span>
              <span>Target: ${t.targetTimeMs}ms</span>
              ${statusBadge}
            </div>
          </div>
        </div>

        <div class="task-row-actions">
          <button class="btn btn-secondary btn-open-task">
            <i class="ph-fill ph-play"></i> Open
          </button>
          <button class="icon-btn btn-delete-task" title="Delete Task">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      `;

      // Status Checkbox Click
      row.querySelector('.status-toggle-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const newState = AppDB.toggleTaskStatus(t.id);
        renderTasksList();
        showToast(newState ? "Task Marked as Completed" : "Task Marked as Incomplete", newState ? "ph-check-circle" : "ph-arrow-counter-clockwise");
      });

      // Open Task in Workspace Click
      row.querySelector('.btn-open-task').addEventListener('click', () => {
        if (activeTaskCallback) activeTaskCallback(t);
        close();
        showToast("Loaded " + t.title, "ph-folder-open");
      });

      // Delete Task Click
      row.querySelector('.btn-delete-task').addEventListener('click', (e) => {
        e.stopPropagation();
        AppDB.deleteTask(t.id);
        renderTasksList();
        showToast("Task Removed", "ph-trash");
      });

      tasksContainer.appendChild(row);
    });
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { init, open, close, renderTasksList };
})();