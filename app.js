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

document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'});

/* --- RICH INTELLISENSE DICTIONARY --- */
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
      "Cmd-Enter": handleExecute, 
      "Tab": function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("    ", "end");
      }
    }
  });

  // Trigger Rich Custom Suggestions on type
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
    }, 300);
  } catch (err) {
    showToast("Engine Error: " + err.message, "ph-warning-circle");
  }

  btnRun.addEventListener('click', handleExecute);
  
  btnReset.addEventListener('click', () => {
    editor.setValue(currentProblem.boilerplate);
    showToast("Editor Reset", "ph-arrow-counter-clockwise");
  });

  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    clearTerminal();
    showToast("Loaded Next Problem", "ph-folder-open");
  });
}

/* --- CUSTOM RICH HINT RENDERING --- */
function triggerRichIntelliSense(cm) {
  const cursor = cm.getCursor();
  const token = cm.getTokenAt(cursor);
  const start = token.string.trim().toLowerCase();
  
  // Filter dictionary based on typing
  const matches = PYTHON_INTELLISENSE.filter(item => item.text.startsWith(start));
  if (matches.length === 0) return;

  const hintObj = {
    list: matches.map(item => ({
      text: item.text,
      // Custom Render function injected into CodeMirror Hint DOM
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

window.clearTerminal = function() {
  termLogStream.innerHTML = `
    <div class="term-line prompt-wrap">
      ${getZshPrompt()} <span class="text-tertiary">_</span>
    </div>
  `;
}

async function handleExecute() {
  const code = editor.getValue();
  
  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph-fill ph-spinner-gap" style="animation: spin 1s linear infinite;"></i> Running...`;

  termLogStream.innerHTML += `
    <div class="term-line prompt-wrap">
      ${getZshPrompt()} <span class="log-cmd">python3 main.py</span>
    </div>
  `;
  scrollToBottom();

  const result = await engine.run(code, currentProblem);
  
  btnRun.disabled = false;
  btnRun.innerHTML = `<i class="ph-fill ph-play"></i> Run <span class="kbd">⌘Enter</span>`;
  
  renderTerminalResults(result);
}

function renderTerminalResults(result) {
  let output = "";

  if (result.stderr) {
    output += `<div class="term-line log-fail">${escapeHtml(result.stderr)}</div>`;
  }

  if (result.results && result.results.length > 0) {
    let passedCount = 0;

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
        output += `<div class="term-line log-pass">✨ Execution Success</div>`;
        showToast("All Tests Passed", "ph-check-circle");
    } else {
        output += `<div class="term-line log-fail">⚠ ${result.results.length - passedCount} Tests Failed</div>`;
        showToast("Tests Failed", "ph-warning-circle");
    }
  }

  if (result.stdout) {
    output += `
      <div class="term-line text-tertiary">[stdout]</div>
      <div class="term-line">${escapeHtml(result.stdout)}</div>
    `;
  }

  output += `
    <div class="term-line prompt-wrap" style="margin-top: 8px;">
      ${getZshPrompt()} <span class="text-tertiary">_</span>
    </div>
  `;

  termLogStream.innerHTML += output;
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