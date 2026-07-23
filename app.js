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

  // Global Keyboard Shortcuts (Works from anywhere)
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
        showToast("Engine Warmed Up", "ph-check-circle");
        appendPrompt(); // Initialize interactive terminal
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

  // Focus terminal input when clicking anywhere in the terminal body
  document.querySelector('.terminal-content').addEventListener('click', () => {
    const input = termLogStream.querySelector('.term-input');
    if (input) input.focus();
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
      render: function(element, self, data) {
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
    setTimeout(() => toast.remove(), 400);
  }, 3000);
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
  return `<span class="prompt-host">macbook-pro</span> <span class="prompt-dir">~</span> % `;
}

/* Interactive Terminal Logic */
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
      input.outerHTML = `<span class="log-cmd">${escapeHtml(cmd)}</span>`; // lock text
      
      if (cmd === '') {
        appendPrompt();
      } else if (cmd === 'clear') {
        termLogStream.innerHTML = '';
        appendPrompt();
      } else if (/^python3?(?:\s+main\.py)?$/.test(cmd) || cmd === './main.py') {
        await executeCode();
      } else {
        const cmdName = cmd.split(' ')[0];
        termLogStream.innerHTML += `<div class="term-line text-tertiary">zsh: command not found: ${escapeHtml(cmdName)}</div>`;
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
  let output = "";

  // 1. Always output standard print() logs first
  if (result.stdout) {
    output += `<div class="term-line">${escapeHtml(result.stdout)}</div>`;
  }
  if (result.stderr) {
    output += `<div class="term-line log-fail">${escapeHtml(result.stderr)}</div>`;
  }

  // 2. Output Test Cases OR Graceful Function Warning
  if (result.func_found === false) {
    output += `
      <div class="term-line" style="color: var(--traffic-yellow); margin-top: 8px;">
        <i class="ph-fill ph-warning-circle"></i> Test Evaluation Skipped: Required function '${currentProblem.functionName}' was not defined.
      </div>
    `;
  } else if (result.results && result.results.length > 0) {
    let passedCount = 0;
    
    // Formatting margin
    output += `<div class="term-line text-tertiary" style="margin-top:8px;">--- Test Suite Evaluation ---</div>`;

    result.results.forEach((tc) => {
      if (tc.passed) passedCount++;

      const statusIcon = tc.passed ? `<span class="log-pass">✔ PASS</span>` : `<span class="log-fail">✘ FAIL</span>`;
      const timeInfo = `<span class="text-tertiary">(${tc.time_ms.toFixed(2)}ms)</span>`;
      output += `<div class="term-line">${statusIcon} Case ${tc.id} ${timeInfo}</div>`;

      if (!tc.passed) {
        output += `
          <div class="term-line text-tertiary" style="padding-left: 20px;">
            Expected: ${JSON.stringify(tc.expected)} | Output: ${JSON.stringify(tc.actual)}
          </div>
        `;
      }
    });

    const isAllPassed = passedCount === result.results.length;
    if(isAllPassed) {
        showToast("All Tests Passed", "ph-check-circle");
    } else {
        showToast("Tests Failed", "ph-warning-circle");
    }
  }

  termLogStream.innerHTML += output;
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