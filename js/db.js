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
    try { 
      const tasks = JSON.parse(localStorage.getItem(KEYS.TASKS_HISTORY)) || []; 
      return tasks.map(t => ({ ...t, completed: !!t.completed }));
    } catch (e) { 
      return []; 
    }
  }

  function saveTask(taskObj) {
    const tasks = getTasksHistory();
    const existingIndex = tasks.findIndex(t => t.id === taskObj.id);
    const newTask = { ...taskObj, completed: taskObj.completed || false };

    if (existingIndex >= 0) {
      tasks[existingIndex] = newTask;
    } else {
      tasks.unshift(newTask);
    }
    localStorage.setItem(KEYS.TASKS_HISTORY, JSON.stringify(tasks));
  }

  /**
   * Toggle task completed/incomplete status
   */
  function toggleTaskStatus(taskId) {
    const tasks = getTasksHistory();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      localStorage.setItem(KEYS.TASKS_HISTORY, JSON.stringify(tasks));
      return task.completed;
    }
    return false;
  }

  /**
   * Delete task from library
   */
  function deleteTask(taskId) {
    let tasks = getTasksHistory();
    tasks = tasks.filter(t => t.id !== taskId);
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
    saveTask,
    toggleTaskStatus,
    deleteTask
  };
})();