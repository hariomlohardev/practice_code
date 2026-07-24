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

  const EXAMPLE_STARTER_TASK = {
    id: "two-sum-indices-001",
    title: "Target Sum Indices",
    description: "Given an array of integers <code>nums</code> and an integer <code>target</code>, return the indices of the two elements that add up to the target.<br><br>Assume exactly one valid solution exists. Do not use the same element twice.",
    functionName: "two_sum",
    targetTimeMs: 15.0,
    boilerplate: "def two_sum(nums, target):\n    # Write your optimal solution here\n    pass\n",
    examples: [
      "Input: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]"
    ],
    testCases: [
      { inputs: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { inputs: [[3, 2, 4], 6], expected: [1, 2] },
      { inputs: [[3, 3], 6], expected: [0, 1] }
    ],
    completed: false
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
      const raw = localStorage.getItem(KEYS.TASKS_HISTORY);
      const tasks = JSON.parse(raw) || []; 
      return tasks.map(t => ({ ...t, completed: !!t.completed }));
    } catch (e) { 
      return []; 
    }
  }

  function saveTask(taskObj) {
    const tasks = getTasksHistory();
    const existingIndex = tasks.findIndex(t => t.id === taskObj.id);
    const newTask = { ...taskObj, completed: !!taskObj.completed };

    if (existingIndex >= 0) {
      tasks[existingIndex] = newTask;
    } else {
      tasks.unshift(newTask);
    }
    localStorage.setItem(KEYS.TASKS_HISTORY, JSON.stringify(tasks));
  }

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

  function deleteTask(taskId) {
    let tasks = getTasksHistory();
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(KEYS.TASKS_HISTORY, JSON.stringify(tasks));
  }

  function getNextIncompleteTask(currentTaskId) {
    const tasks = getTasksHistory();
    const remaining = tasks.filter(t => !t.completed && t.id !== currentTaskId);
    return remaining.length > 0 ? remaining[0] : null;
  }

  function getStarterExampleTask() {
    return EXAMPLE_STARTER_TASK;
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
    deleteTask,
    getNextIncompleteTask,
    getStarterExampleTask
  };
})();