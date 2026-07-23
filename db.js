/**
 * Database & State Persistence Layer
 * Handles LocalStorage data with Cloud DB abstraction placeholders
 */
const AppDB = (() => {
  const KEYS = {
    CREDENTIALS: 'pystudio_credentials',
    CUSTOMIZATION: 'pystudio_customization',
    ACTIVE_STATE: 'pystudio_active_state',
    TASKS_HISTORY: 'pystudio_tasks_history'
  };

  // --- Credentials ---
  function getCredentials() {
    const defaultData = { model: "gpt-4o", apiKey: "" };
    try {
      return JSON.parse(localStorage.getItem(KEYS.CREDENTIALS)) || defaultData;
    } catch (e) {
      return defaultData;
    }
  }

  function saveCredentials(data) {
    localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(data));
    syncToCloud('credentials', data);
  }

  // --- AI Customization ---
  function getAICustomization() {
    const defaultData = {
      complexity: "intermediate",
      field: "Software Engineering",
      topics: "NumPy, Asyncio, Pandas"
    };
    try {
      return JSON.parse(localStorage.getItem(KEYS.CUSTOMIZATION)) || defaultData;
    } catch (e) {
      return defaultData;
    }
  }

  function saveAICustomization(data) {
    localStorage.setItem(KEYS.CUSTOMIZATION, JSON.stringify(data));
    syncToCloud('customization', data);
  }

  // --- Active Code & Session State ---
  function getActiveState() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.ACTIVE_STATE)) || null;
    } catch (e) {
      return null;
    }
  }

  function saveActiveState(stateObj) {
    localStorage.setItem(KEYS.ACTIVE_STATE, JSON.stringify(stateObj));
    syncToCloud('active_state', stateObj);
  }

  // --- Task History ---
  function getTasksHistory() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.TASKS_HISTORY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveTask(taskObj) {
    const tasks = getTasksHistory();
    const existingIndex = tasks.findIndex(t => t.id === taskObj.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = taskObj;
    } else {
      tasks.unshift(taskObj);
    }
    localStorage.setItem(KEYS.TASKS_HISTORY, JSON.stringify(tasks));
    syncToCloud('tasks_history', tasks);
  }

  // --- Cloud Database Sync Placeholder ---
  async function syncToCloud(table, payload) {
    // PLACEHOLDER: Connect to Supabase, Firebase, or custom Backend REST API here
    // Example:
    // await fetch('/api/db/sync', { method: 'POST', body: JSON.stringify({ table, payload }) });
  }

  return {
    getCredentials,
    saveCredentials,
    getAICustomization,
    saveAICustomization,
    getActiveState,
    saveActiveState,
    getTasksHistory,
    saveTask
  };
})();