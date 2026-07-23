/**
 * Database & LocalStorage Persistence Manager
 */
const AppDB = (() => {
  const KEYS = {
    CREDENTIALS: 'pystudio_credentials',
    CUSTOMIZATION: 'pystudio_customization',
    ACTIVE_STATE: 'pystudio_active_state',
    TASKS_HISTORY: 'pystudio_tasks_history'
  };

  function getCredentials() {
    const defaultData = { model: "gemini-3.6-flash", apiKey: "" };
    try { return JSON.parse(localStorage.getItem(KEYS.CREDENTIALS)) || defaultData; } 
    catch (e) { return defaultData; }
  }

  function saveCredentials(data) {
    localStorage.setItem(KEYS.CREDENTIALS, JSON.stringify(data));
  }

  function getAICustomization() {
    const defaultData = { complexity: "intermediate", field: "Software Engineering", topics: "NumPy, Asyncio, Pandas" };
    try { return JSON.parse(localStorage.getItem(KEYS.CUSTOMIZATION)) || defaultData; } 
    catch (e) { return defaultData; }
  }

  function saveAICustomization(data) {
    localStorage.setItem(KEYS.CUSTOMIZATION, JSON.stringify(data));
  }

  function getActiveState() {
    try { return JSON.parse(localStorage.getItem(KEYS.ACTIVE_STATE)) || null; } 
    catch (e) { return null; }
  }

  function saveActiveState(stateObj) {
    localStorage.setItem(KEYS.ACTIVE_STATE, JSON.stringify(stateObj));
  }

  function getTasksHistory() {
    try { return JSON.parse(localStorage.getItem(KEYS.TASKS_HISTORY)) || []; } 
    catch (e) { return []; }
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