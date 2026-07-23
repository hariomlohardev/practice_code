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

const tabZsh = document.getElementById('tab-zsh');
const tabPytest = document.getElementById('tab-pytest');

document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

async function initializeApp() {
  const savedState = AppDB.getActiveState();
  currentProblem = (savedState && savedState.problem) ? savedState.problem : getRandomAIProblem();
  renderProblem(currentProblem);

  // Initialize CodeMirror Editor
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python", theme: "nord", lineNumbers: true, indentUnit: 4,
    matchBrackets: true, autoCloseBrackets: true,
    extraKeys: {
      "Ctrl-Space": (cm) => cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false }),
      "Tab": (cm) => cm.somethingSelected() ? cm.indentSelection("add") : cm.replaceSelection("    ", "end")
    }
  });

  editor.setValue((savedState && savedState.code) ? savedState.code : currentProblem.boilerplate);

  editor.on("change", () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      AppDB.saveActiveState({ code: editor.getValue(), problem: currentProblem });
    }, 1000);
  });

  // Global Keyboard Shortcut: Cmd/Ctrl + Enter
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!btnRun.disabled) triggerRunFromTerminal();
    }
  });

  editor.on("inputRead", (cm, change) => {
    if (change.origin === "+input" && /^[a-zA-Z_.]*$/.test(change.text[0])) {
      cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false });
    }
  });

  // Initialize AI UI & Tasks Library UI
  AIUI.init(loadTaskIntoWorkspace);
  TasksUI.init(loadTaskIntoWorkspace);

  try {
    await engine.init();
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
      editor.refresh();
      showToast("System Ready", "ph-check-circle");
      TerminalManager.appendPrompt(handleTerminalCommand);
    }, 300);
  } catch (err) {
    showToast("Engine Error: " + err.message, "ph-warning-circle");
  }

  // Bind Buttons
  btnRun.addEventListener('click', triggerRunFromTerminal);
  btnReset.addEventListener('click', () => {
    editor.setValue(currentProblem.boilerplate);
    showToast("Editor Reset", "ph-arrow-counter-clockwise");
  });
  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    showToast("Loaded Next Problem", "ph-folder-open");
  });

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
  renderProblem(currentProblem);
  editor.setValue(currentProblem.boilerplate);
  AppDB.saveActiveState({ code: editor.getValue(), problem: currentProblem });
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
  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Running...`;

  const result = await engine.run(editor.getValue(), currentProblem);
  
  btnRun.disabled = false;
  btnRun.innerHTML = `<i class="ph-fill ph-play"></i> Run <span class="kbd">⌘↵</span>`;

  TerminalManager.renderTestResults(result, currentProblem.functionName);

  // If all tests passed, auto-mark task as completed!
  if (result.results && result.results.length > 0 && result.results.every(r => r.passed)) {
    if (currentProblem.id) {
      currentProblem.completed = true;
      AppDB.saveTask(currentProblem);
      showToast("Challenge Completed! Marked in Library", "ph-check-circle");
    }
  }

  TerminalManager.appendPrompt(handleTerminalCommand);
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
  document.getElementById('problem-title').innerText = problem.title;
  document.getElementById('problem-desc').innerHTML = problem.description;
  document.getElementById('target-time').innerText = problem.targetTimeMs;
  document.getElementById('problem-examples').innerHTML = problem.examples.map(ex => `<div class="example-card">${ex.replace(/\n/g, '<br>')}</div>`).join('');
}

window.addEventListener('DOMContentLoaded', initializeApp);