/**
 * Main Application Orchestrator
 */
const engine = new PythonEngine();
let editor = null;
let currentProblem = null;
let autoSaveTimer = null;

const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('macos-app');
const toastContainer = document.getElementById('toast-container');

const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');
const btnClearTerm = document.getElementById('btn-clear-term');

const btnNextChallenge = document.getElementById('btn-next-challenge');

const tabZsh = document.getElementById('tab-zsh');
const tabPytest = document.getElementById('tab-pytest');

document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

async function initializeApp() {
  const savedState = AppDB.getActiveState();
  const tasks = AppDB.getTasksHistory();

  if (savedState && savedState.problem) {
    currentProblem = savedState.problem;
  } else if (tasks.length > 0) {
    currentProblem = tasks[0];
  } else {
    currentProblem = null;
  }

  // 1. Initialize CodeMirror Editor FIRST
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python", theme: "nord", lineNumbers: true, indentUnit: 4,
    matchBrackets: true, autoCloseBrackets: true,
    extraKeys: {
      "Ctrl-Space": (cm) => cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false }),
      "Tab": (cm) => cm.somethingSelected() ? cm.indentSelection("add") : cm.replaceSelection("    ", "end")
    }
  });

  const initialCode = (savedState && savedState.code) ? savedState.code : (currentProblem ? currentProblem.boilerplate : "");
  editor.setValue(initialCode);

  editor.on("change", () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (currentProblem) {
        AppDB.saveActiveState({ code: editor.getValue(), problem: currentProblem });
      }
    }, 1000);
  });

  // Global Keyboard Shortcut: Cmd/Ctrl + Enter
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!btnRun.disabled && currentProblem) triggerRunFromTerminal();
    }
  });

  editor.on("inputRead", (cm, change) => {
    if (change.origin === "+input" && /^[a-zA-Z_.]*$/.test(change.text[0])) {
      cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false });
    }
  });

  // Initialize UI Managers
  AIUI.init(loadTaskIntoWorkspace);
  TasksUI.init(loadTaskIntoWorkspace);

  // 2. Render Problem / Welcome View safely
  renderProblem(currentProblem);

  // 3. Initialize Pyodide & Reveal macOS Window
  try {
    await engine.init();
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
      editor.refresh(); // Crucial to prevent blank editor
      showToast("System Ready", "ph-check-circle");
      TerminalManager.appendPrompt(handleTerminalCommand);
    }, 300);
  } catch (err) {
    showToast("Engine Error: " + err.message, "ph-warning-circle");
  }

  // Bind Buttons
  btnRun.addEventListener('click', triggerRunFromTerminal);
  btnReset.addEventListener('click', () => {
    if (currentProblem) editor.setValue(currentProblem.boilerplate);
    showToast("Editor Reset", "ph-arrow-counter-clockwise");
  });
  
  btnNext.addEventListener('click', loadRandomOrNextProblem);
  btnNextChallenge.addEventListener('click', handleNextChallengeClick);

  // Settings Controls
  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    SettingsManager.init();
    document.getElementById('settings-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const success = await SettingsManager.saveSettings(showToast);
    if (success) document.getElementById('settings-modal').classList.add('hidden');
  });

  tabZsh.addEventListener('click', () => switchTerminalTab('zsh'));
  tabPytest.addEventListener('click', () => switchTerminalTab('pytest'));
}

window.getActiveProblem = function() {
  return currentProblem;
};

/**
 * Loads a task directly into the Editor Workspace
 */
function loadTaskIntoWorkspace(taskObj) {
  currentProblem = taskObj;
  AppDB.saveTask(currentProblem);
  renderProblem(currentProblem);
  editor.setValue(currentProblem.boilerplate);
  AppDB.saveActiveState({ code: editor.getValue(), problem: currentProblem });
}

function updateCompletedButtonUI(isCompleted) {
  const statusPill = document.getElementById('status-indicator-completed');
  const statusIcon = document.getElementById('icon-mark-completed');
  const statusText = document.getElementById('text-mark-completed');

  if (!statusPill) return;

  statusPill.classList.toggle('is-completed', isCompleted);
  if (isCompleted) {
    statusIcon.className = 'ph-fill ph-check-circle';
    statusText.innerText = 'Completed';
  } else {
    statusIcon.className = 'ph ph-circle';
    statusText.innerText = 'In Progress';
  }
}

/**
 * Next Task button is faded/disabled until ALL test cases pass
 */
function updateNextButtonState(canProceed) {
  if (!btnNextChallenge) return;
  if (canProceed) {
    btnNextChallenge.disabled = false;
    btnNextChallenge.classList.add('all-passed-success');
    btnNextChallenge.innerHTML = `<span>Next Challenge</span> <i class="ph-bold ph-arrow-right"></i>`;
  } else {
    btnNextChallenge.disabled = true;
    btnNextChallenge.classList.remove('all-passed-success');
    btnNextChallenge.innerHTML = `<span>Next Task</span> <i class="ph-bold ph-arrow-right"></i>`;
  }
}

function loadRandomOrNextProblem() {
  const nextIncomplete = AppDB.getNextIncompleteTask(currentProblem ? currentProblem.id : null);
  if (nextIncomplete) {
    loadTaskIntoWorkspace(nextIncomplete);
    showToast("Loaded " + nextIncomplete.title, "ph-folder-open");
  } else {
    AIUI.open();
    showToast("Generating Next Task with Jupy AI...", "ph-sparkle");
  }
}

function handleNextChallengeClick() {
  const nextIncomplete = AppDB.getNextIncompleteTask(currentProblem ? currentProblem.id : null);
  
  if (nextIncomplete) {
    loadTaskIntoWorkspace(nextIncomplete);
    showToast("Loaded " + nextIncomplete.title, "ph-folder-open");
  } else {
    AIUI.open();
    showToast("Generating Next Task with Jupy AI...", "ph-sparkle");
  }
}

async function handleTerminalCommand(cmd) {
  if (/^pip3?\s+install\s+([a-zA-Z0-9_\-]+)$/i.test(cmd)) {
    const pkg = cmd.match(/^pip3?\s+install\s+([a-zA-Z0-9_\-]+)$/i)[1];
    await engine.installPackage(pkg, (msg) => TerminalManager.appendLog(msg, 'log-pip'));
    PythonIntelliSense.registerPackage(pkg);
    showToast(`Installed ${pkg}`, "ph-package");
    TerminalManager.appendPrompt(handleTerminalCommand);
  } else if (/^(python3?|pytest)(?:\s+main\.py)?$/.test(cmd) || cmd === './main.py') {
    await executeCode();
  } else {
    TerminalManager.appendLog(`zsh: command not found: ${cmd.split(' ')[0]}`, 'text-tertiary');
    TerminalManager.appendPrompt(handleTerminalCommand);
  }
}

function switchTerminalTab(tabName) {
  if (tabName === 'zsh') {
    tabZsh.classList.add('active');
    tabPytest.classList.remove('active');
  } else {
    tabPytest.classList.add('active');
    tabZsh.classList.remove('active');
    triggerRunFromTerminal('pytest main.py');
  }
}

function triggerRunFromTerminal(customCmd) {
  const activeInput = document.querySelector('.term-input');
  if (activeInput) {
    activeInput.value = customCmd || 'python3 main.py';
    activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  } else {
    executeCode();
  }
}

async function executeCode() {
  if (!currentProblem) {
    showToast("No active problem selected", "ph-warning-circle");
    return;
  }

  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Running...`;

  const result = await engine.run(editor.getValue(), currentProblem);
  
  btnRun.disabled = false;
  btnRun.innerHTML = `<i class="ph-fill ph-play"></i> Run <span class="kbd">⌘↵</span>`;

  TerminalManager.renderTestResults(result, currentProblem.functionName);

  // STRICT RULE: Completed IF AND ONLY IF ALL test cases pass
  const allPassed = result.results && result.results.length > 0 && result.results.every(r => r.passed);

  if (currentProblem && currentProblem.id) {
    currentProblem.completed = allPassed;
    AppDB.saveTask(currentProblem);
    if (window.TasksUI) TasksUI.renderKanbanBoard();
  }

  // Update Status Indicator & Next Task Button state based on test outcome
  updateCompletedButtonUI(allPassed);
  updateNextButtonState(allPassed);

  if (allPassed) {
    showToast("All Tests Passed! Task Unlocked", "ph-check-circle");
    checkAllTasksCompletedState();
  } else {
    showToast("Tests Failed. Correct code to unlock Next Task", "ph-warning-circle");
  }

  TerminalManager.appendPrompt(handleTerminalCommand);
}

function checkAllTasksCompletedState() {
  const tasks = AppDB.getTasksHistory();
  if (tasks.length > 0 && tasks.every(t => t.completed)) {
    renderAllCompletedView();
  }
}

function showToast(message, icon) {
  const toast = document.createElement('div');
  toast.className = 'mac-toast';
  toast.innerHTML = `<i class="ph-fill ${icon}"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function renderProblem(problem) {
  const tasks = AppDB.getTasksHistory();
  const sidebarContent = document.querySelector('.sidebar-content');

  // Case 1: First Come / No Tasks Exist -> Render Welcome Onboarding State
  if (tasks.length === 0 && !problem) {
    sidebarContent.innerHTML = `
      <div class="welcome-state-card">
        <div class="welcome-hero-icon"><i class="ph-fill ph-hand-waving"></i></div>
        <h2 class="title-1">Welcome to Python Studio</h2>
        <p class="body-text">Choose how you'd like to begin your coding session:</p>
        
        <div class="welcome-actions-group">
          <button id="btn-load-example-task" class="btn btn-primary" style="width: 100%; justify-content: center;">
            <i class="ph-fill ph-file-code"></i> Load Example Challenge
          </button>
          <button id="btn-ask-jupy-task" class="btn btn-secondary" style="width: 100%; justify-content: center;">
            <i class="ph-fill ph-sparkle" style="color: var(--accent);"></i> Ask Jupy for a Task
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-load-example-task').addEventListener('click', () => {
      const exampleTask = AppDB.getStarterExampleTask();
      loadTaskIntoWorkspace(exampleTask);
      showToast("Loaded Example Challenge", "ph-folder-open");
    });

    document.getElementById('btn-ask-jupy-task').addEventListener('click', () => AIUI.open());
    return;
  }

  // Case 2: All Tasks Completed!
  if (tasks.length > 0 && tasks.every(t => t.completed)) {
    renderAllCompletedView();
    return;
  }

  // Case 3: Standard Problem View
  if (!problem) return;

  sidebarContent.innerHTML = `
    <h1 id="problem-title" class="title-1">${escapeHtml(problem.title)}</h1>
    <p id="problem-desc" class="body-text">${problem.description}</p>
    <div class="divider"></div>
    <span class="section-caps">TEST CASES</span>
    <div id="problem-examples" class="examples-grid">
      ${problem.examples.map(ex => `<div class="example-card">${ex.replace(/\n/g, '<br>')}</div>`).join('')}
    </div>
    <div class="info-callout">
      <i class="ph-fill ph-timer"></i> 
      <span>Target: &le; <span id="target-time">${problem.targetTimeMs}</span>ms</span>
    </div>
  `;

  const isCompleted = !!problem.completed;
  updateCompletedButtonUI(isCompleted);
  updateNextButtonState(isCompleted);
}

function renderAllCompletedView() {
  const sidebarContent = document.querySelector('.sidebar-content');
  sidebarContent.innerHTML = `
    <div class="all-completed-state">
      <div class="completed-hero-icon"><i class="ph-fill ph-check-circle"></i></div>
      <h2 class="title-1">All Tasks Completed!</h2>
      <p class="body-text">Awesome work! You've solved every challenge in your library 🎉. Ask Jupy AI to generate your next personalized task!</p>
      <button id="btn-ask-jupy-task" class="btn btn-primary" style="margin-top: 16px;">
        <i class="ph-fill ph-sparkle"></i> Ask Jupy for Next Task
      </button>
    </div>
  `;
  document.getElementById('btn-ask-jupy-task').addEventListener('click', () => AIUI.open());
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.addEventListener('DOMContentLoaded', initializeApp);