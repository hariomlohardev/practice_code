const engine = new PythonEngine();
let editor = null;
let currentProblem = null;

const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('macos-app');
const termLogStream = document.getElementById('terminal-log-stream');
const toastContainer = document.getElementById('toast-container');

const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');
const btnClearTerm = document.getElementById('btn-clear-term');

document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'});

const PYTHON_INTELLISENSE = [
  { text: "print", type: "function", icon: "ph-function", desc: "Print values to stream" },
  { text: "len", type: "function", icon: "ph-function", desc: "Return length of object" },
  { text: "range", type: "function", icon: "ph-function", desc: "Sequence of numbers" },
  { text: "enumerate", type: "function", icon: "ph-function", desc: "Index, value iterator" },
  { text: "def", type: "keyword", icon: "ph-code", desc: "Define a function" },
  { text: "return", type: "keyword", icon: "ph-code", desc: "Exit and return value" },
  { text: "if", type: "keyword", icon: "ph-git-branch", desc: "Conditional statement" },
  { text: "else", type: "keyword", icon: "ph-git-branch", desc: "Alternative condition" },
  { text: "for", type: "keyword", icon: "ph-arrows-clockwise", desc: "Loop sequence" },
  { text: "while", type: "keyword", icon: "ph-arrows-clockwise", desc: "Loop while true" },
  { text: "import", type: "keyword", icon: "ph-package", desc: "Import a module" }
];

async function initializeApp() {
  currentProblem = getRandomAIProblem();
  renderProblem(currentProblem);

  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "nord",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    extraKeys: {
      "Ctrl-Space": triggerRichIntelliSense,
      "Tab": function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("    ", "end");
      }
    }
  });

  // Global Keyboard Shortcuts (Cmd/Ctrl + Enter)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!btnRun.disabled) triggerRunFromTerminal();
    }
  });

  editor.on("inputRead", function(cm, change) {
    if (change.origin === "+input" && /^[a-zA-Z_]*$/.test(change.text[0])) {
      triggerRichIntelliSense(cm);
    }
  });

  editor.setValue(currentProblem.boilerplate);

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

  btnRun.addEventListener('click', triggerRunFromTerminal);
  
  btnReset.addEventListener('click', () => {
    editor.setValue(currentProblem.boilerplate);
    showToast("Editor Reset", "ph-arrow-counter-clockwise");
  });

  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    termLogStream.innerHTML = '';
    appendPrompt();
    showToast("Loaded Next Problem", "ph-folder-open");
  });

  btnClearTerm.addEventListener('click', () => {
    termLogStream.innerHTML = '';
    appendPrompt();
  });

  document.querySelector('.terminal-content').addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = termLogStream.querySelector('.term-input');
      if (input) input.focus();
    }
  });
}

function triggerRichIntelliSense(cm) {
  const cursor = cm.getCursor();
  const token = cm.getTokenAt(cursor);
  const start = token.string.trim().toLowerCase();
  
  const matches = PYTHON_INTELLISENSE.filter(item => item.text.startsWith(start));
  if (matches.length === 0) return;

  const hintObj = {
    list: matches.map(item => ({
      text: item.text,
      render: function(element) {
        element.innerHTML = `
          <div class="hint-left">
            <i class="ph-fill ${item.icon} hint-icon"></i>
            <span>${item.text}</span>
          </div>
          <div class="hint-desc">${item.desc}</div>
        `;
      }
    })),
    from: CodeMirror.Pos(cursor.line, token.start),
    to: CodeMirror.Pos(cursor.line, token.end)
  };

  cm.showHint({ hint: () => hintObj, completeSingle: false });
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

/* Interactive & Clean Terminal Stream */
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
      
      // Convert active prompt line to static text
      wrapper.innerHTML = `${getZshPrompt()} <span class="log-cmd">${escapeHtml(cmd)}</span>`;
      
      if (cmd === '') {
        appendPrompt();
      } else if (cmd === 'clear') {
        termLogStream.innerHTML = '';
        appendPrompt();
      } else if (/^python3?(?:\s+main\.py)?$/.test(cmd) || cmd === './main.py') {
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

function triggerRunFromTerminal() {
  const activeInput = termLogStream.querySelector('.term-input');
  if (activeInput) {
    activeInput.value = 'python3 main.py';
    activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
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
  // 1. Output print() stdout directly without extra spacing
  if (result.stdout) {
    const cleanStdout = result.stdout.replace(/\n$/, '');
    const div = document.createElement('div');
    div.className = 'term-line';
    div.textContent = cleanStdout;
    termLogStream.appendChild(div);
  }

  // 2. Output python tracebacks
  if (result.stderr) {
    const cleanStderr = result.stderr.replace(/\n$/, '');
    const div = document.createElement('div');
    div.className = 'term-line log-fail';
    div.textContent = cleanStderr;
    termLogStream.appendChild(div);
  }

  // 3. Pytest-Style Structured Test Cases Output
  if (result.func_found === false) {
    const div = document.createElement('div');
    div.className = 'term-line log-fail';
    div.textContent = `pytest: error: function '${currentProblem.functionName}' not defined in main.py`;
    termLogStream.appendChild(div);
  } else if (result.results && result.results.length > 0) {
    let passedCount = 0;
    
    // Header line
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