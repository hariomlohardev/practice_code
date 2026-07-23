const engine = new PythonEngine();
let editor = null;
let currentProblem = null;
let autoSaveTimer = null;

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('macos-app');
const termLogStream = document.getElementById('terminal-log-stream');
const toastContainer = document.getElementById('toast-container');

// Top Bar Action Buttons
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');
const btnClearTerm = document.getElementById('btn-clear-term');

const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const btnAiToggle = document.getElementById('btn-ai-toggle');
const btnFilesToggle = document.getElementById('btn-files-toggle');

// Modal Elements
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');

const tabBtnCreds = document.getElementById('tab-btn-creds');
const tabBtnCustom = document.getElementById('tab-btn-custom');
const secCreds = document.getElementById('sec-creds');
const secCustom = document.getElementById('sec-custom');

// Form Inputs
const inputModel = document.getElementById('setting-model');
const inputApiKey = document.getElementById('setting-api-key');
const inputComplexity = document.getElementById('setting-complexity');
const inputField = document.getElementById('setting-field');
const inputTopics = document.getElementById('setting-topics');

const tabZsh = document.getElementById('tab-zsh');
const tabPytest = document.getElementById('tab-pytest');

document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });

async function initializeApp() {
  // 1. Check DB for previous session state
  const savedState = AppDB.getActiveState();
  if (savedState && savedState.problem) {
    currentProblem = savedState.problem;
  } else {
    currentProblem = getRandomAIProblem();
  }

  renderProblem(currentProblem);

  // 2. Initialize CodeMirror Editor
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "nord",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    extraKeys: {
      "Ctrl-Space": (cm) => cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false }),
      "Tab": function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("    ", "end");
      }
    }
  });

  // Load code from DB if exists
  if (savedState && savedState.code) {
    editor.setValue(savedState.code);
  } else {
    editor.setValue(currentProblem.boilerplate);
  }

  // 3. Auto-save code on typing (Debounced)
  editor.on("change", () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveCurrentStateToDB();
    }, 1000);
  });

  // Global Keyboard Shortcut: Cmd/Ctrl + Enter
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!btnRun.disabled) triggerRunFromTerminal();
    }
  });

  // Trigger IntelliSense automatically on typing
  editor.on("inputRead", function(cm, change) {
    if (change.origin === "+input" && /^[a-zA-Z_.]*$/.test(change.text[0])) {
      cm.showHint({ hint: PythonIntelliSense.getHints, completeSingle: false });
    }
  });

  try {
    await engine.init();
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      appContainer.classList.remove('hidden');
      editor.refresh();
      showToast("System Ready", "ph-check-circle");
      appendPrompt();
    }, 300);
  } catch (err) {
    showToast("Engine Error: " + err.message, "ph-warning-circle");
  }

  // Bind Buttons
  btnRun.addEventListener('click', triggerRunFromTerminal);
  
  btnReset.addEventListener('click', () => {
    editor.setValue(currentProblem.boilerplate);
    saveCurrentStateToDB();
    showToast("Editor Reset", "ph-arrow-counter-clockwise");
  });

  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    termLogStream.innerHTML = '';
    appendPrompt();
    saveCurrentStateToDB();
    showToast("Loaded Next Problem", "ph-folder-open");
  });

  btnClearTerm.addEventListener('click', () => {
    termLogStream.innerHTML = '';
    appendPrompt();
  });

  tabZsh.addEventListener('click', () => switchTerminalTab('zsh'));
  tabPytest.addEventListener('click', () => switchTerminalTab('pytest'));

  // Modal Controls
  btnSettingsToggle.addEventListener('click', openSettingsModal);
  btnCloseSettings.addEventListener('click', closeSettingsModal);
  btnSaveSettings.addEventListener('click', handleSaveSettings);

  btnAiToggle.addEventListener('click', () => showToast("AI Assistant Active", "ph-sparkle"));
  btnFilesToggle.addEventListener('click', () => showToast("Task History Loaded", "ph-folder-open"));

  // Settings Tabs
  tabBtnCreds.addEventListener('click', () => switchModalTab('creds'));
  tabBtnCustom.addEventListener('click', () => switchModalTab('custom'));

  document.querySelector('.terminal-content').addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = termLogStream.querySelector('.term-input');
      if (input) input.focus();
    }
  });
}

function saveCurrentStateToDB() {
  if (!editor || !currentProblem) return;
  AppDB.saveActiveState({
    code: editor.getValue(),
    problem: currentProblem,
    updatedAt: new Date().toISOString()
  });
}

/* --- SETTINGS MODAL LOGIC --- */
function openSettingsModal() {
  const creds = AppDB.getCredentials();
  const custom = AppDB.getAICustomization();

  inputModel.value = creds.model || 'gpt-4o';
  inputApiKey.value = creds.apiKey || '';
  inputComplexity.value = custom.complexity || 'intermediate';
  inputField.value = custom.field || '';
  inputTopics.value = custom.topics || '';

  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

function switchModalTab(tab) {
  if (tab === 'creds') {
    tabBtnCreds.classList.add('active');
    tabBtnCustom.classList.remove('active');
    secCreds.classList.remove('hidden');
    secCustom.classList.add('hidden');
  } else {
    tabBtnCustom.classList.add('active');
    tabBtnCreds.classList.remove('active');
    secCustom.classList.remove('hidden');
    secCreds.classList.add('hidden');
  }
}

function handleSaveSettings() {
  AppDB.saveCredentials({
    model: inputModel.value,
    apiKey: inputApiKey.value
  });

  AppDB.saveAICustomization({
    complexity: inputComplexity.value,
    field: inputField.value,
    topics: inputTopics.value
  });

  closeSettingsModal();
  showToast("Settings Saved", "ph-check-circle");
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

  const examplesBlock = document.getElementById('problem-examples');
  examplesBlock.innerHTML = problem.examples.map(ex => 
    `<div class="example-card">${ex.replace(/\n/g, '<br>')}</div>`
  ).join('');
}

function getZshPrompt() {
  return `<span class="prompt-host">macbook-pro</span> <span class="prompt-dir">~</span> %`;
}

function appendPrompt() {
  const wrapper = document.createElement('div');
  wrapper.className = 'term-line prompt-wrap';
  wrapper.innerHTML = `
    ${getZshPrompt()} 
    <input type="text" class="term-input" autocomplete="off" spellcheck="false" autofocus>
  `;
  termLogStream.appendChild(wrapper);
  
  const input = wrapper.querySelector('.term-input');
  input.focus();
  
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      wrapper.innerHTML = `${getZshPrompt()} <span class="log-cmd">${escapeHtml(cmd)}</span>`;
      
      if (cmd === '') {
        appendPrompt();
      } else if (cmd === 'clear') {
        termLogStream.innerHTML = '';
        appendPrompt();
      } else if (/^pip3?\s+install\s+([a-zA-Z0-9_\-]+)$/i.test(cmd)) {
        const match = cmd.match(/^pip3?\s+install\s+([a-zA-Z0-9_\-]+)$/i);
        const pkgName = match[1];
        await handlePipInstall(pkgName);
      } else if (/^(python3?|pytest)(?:\s+main\.py)?$/.test(cmd) || cmd === './main.py') {
        await executeCode();
      } else {
        const cmdName = cmd.split(' ')[0];
        const errorLine = document.createElement('div');
        errorLine.className = 'term-line text-tertiary';
        errorLine.textContent = `zsh: command not found: ${cmdName}`;
        termLogStream.appendChild(errorLine);
        appendPrompt();
      }
      scrollToBottom();
    }
  });
}

async function handlePipInstall(pkgName) {
  const logCallback = (msg) => {
    const div = document.createElement('div');
    div.className = 'term-line log-pip';
    div.textContent = msg;
    termLogStream.appendChild(div);
    scrollToBottom();
  };

  const success = await engine.installPackage(pkgName, logCallback);
  if (success) {
    PythonIntelliSense.registerPackage(pkgName);
    showToast(`Installed ${pkgName}`, "ph-package");
  } else {
    showToast(`Failed to install ${pkgName}`, "ph-warning-circle");
  }

  appendPrompt();
  scrollToBottom();
}

function triggerRunFromTerminal(customCmd) {
  const activeInput = termLogStream.querySelector('.term-input');
  if (activeInput) {
    activeInput.value = customCmd || 'python3 main.py';
    activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  } else {
    const wrapper = document.createElement('div');
    wrapper.className = 'term-line prompt-wrap';
    wrapper.innerHTML = `${getZshPrompt()} <span class="log-cmd">${customCmd || 'python3 main.py'}</span>`;
    termLogStream.appendChild(wrapper);
    executeCode();
  }
}

async function executeCode() {
  const code = editor.getValue();
  
  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Running...`;

  const result = await engine.run(code, currentProblem);
  
  btnRun.disabled = false;
  btnRun.innerHTML = `<i class="ph-fill ph-play"></i> Run <span class="kbd">⌘↵</span>`;
  
  renderTerminalResults(result);
}

function renderTerminalResults(result) {
  if (result.stdout) {
    const cleanStdout = result.stdout.replace(/\n$/, '');
    const div = document.createElement('div');
    div.className = 'term-line';
    div.textContent = cleanStdout;
    termLogStream.appendChild(div);
  }

  if (result.stderr) {
    const cleanStderr = result.stderr.replace(/\n$/, '');
    const div = document.createElement('div');
    div.className = 'term-line log-fail';
    div.textContent = cleanStderr;
    termLogStream.appendChild(div);
  }

  if (result.func_found === false) {
    const div = document.createElement('div');
    div.className = 'term-line log-fail';
    div.textContent = `pytest: error: function '${currentProblem.functionName}' not defined in main.py`;
    termLogStream.appendChild(div);
  } else if (result.results && result.results.length > 0) {
    let passedCount = 0;
    
    const header = document.createElement('div');
    header.className = 'term-line text-tertiary';
    header.style.marginTop = '4px';
    header.textContent = 'rootdir: /workspace, configfile: pytest.ini';
    termLogStream.appendChild(header);

    result.results.forEach((tc) => {
      if (tc.passed) passedCount++;

      const statusHtml = tc.passed ? `<span class="log-pass">PASSED</span>` : `<span class="log-fail">FAILED</span>`;
      const timeHtml = `<span class="text-tertiary">[${tc.time_ms.toFixed(2)}ms]</span>`;

      const row = document.createElement('div');
      row.className = 'term-line test-row';
      row.innerHTML = `<span>test_cases.py::case_${tc.id}</span><span class="dots"></span>${statusHtml} ${timeHtml}`;
      termLogStream.appendChild(row);

      if (!tc.passed) {
        const failDetail = document.createElement('div');
        failDetail.className = 'term-line log-fail';
        failDetail.textContent = `  E   AssertionError: expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(tc.actual)}`;
        termLogStream.appendChild(failDetail);
      }
    });

    const total = result.results.length;
    const failedCount = total - passedCount;
    
    const summary = document.createElement('div');
    summary.className = `term-line ${failedCount === 0 ? 'log-pass' : 'log-fail'}`;
    summary.style.marginTop = '4px';
    summary.textContent = failedCount === 0 
      ? `===== ${total} passed in 0.04s =====` 
      : `===== ${failedCount} failed, ${passedCount} passed in 0.05s =====`;
    termLogStream.appendChild(summary);

    if (failedCount === 0) {
      showToast("All Tests Passed", "ph-check-circle");
    } else {
      showToast(`${failedCount} Test(s) Failed`, "ph-warning-circle");
    }
  }

  appendPrompt();
  scrollToBottom();
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scrollToBottom() {
  const termBody = document.getElementById('terminal-screen');
  termBody.scrollTop = termBody.scrollHeight;
}

window.addEventListener('DOMContentLoaded', initializeApp);