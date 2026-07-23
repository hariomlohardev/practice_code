const engine = new PythonEngine();
let editor = null;
let currentProblem = null;

const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('macos-app');
const termLogStream = document.getElementById('terminal-log-stream');
const toastContainer = document.getElementById('toast-container');

// Controls
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');

// Init Login time
document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'});

async function initializeApp() {
  currentProblem = getRandomAIProblem();
  renderProblem(currentProblem);

  // Setup CodeMirror
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "nord",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Cmd-Enter": handleExecute, 
      "Tab": function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("    ", "end");
      }
    }
  });

  editor.on("inputRead", function(cm, change) {
    if (change.origin === "+input") {
      const text = change.text[0];
      if (/^[a-zA-Z_.]*$/.test(text)) {
        cm.showHint({ completeSingle: false });
      }
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
    }, 250);
  } catch (err) {
    showToast("Engine Error: " + err.message, "ph-warning");
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
    showToast("Problem Loaded", "ph-folder");
  });
}

// MAC OS Optimistic UI Toast Notification
function showToast(message, icon) {
  const toast = document.createElement('div');
  toast.className = 'mac-toast';
  toast.innerHTML = `<i class="ph ${icon}"></i> <span>${message}</span>`;
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
  
  // UX Feedback
  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph ph-spinner"></i> Running...`;

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
        showToast("Tests Failed", "ph-warning");
    }
  }

  if (result.stdout) {
    output += `
      <div class="term-line text-tertiary">[stdout]</div>
      <div class="term-line">${escapeHtml(result.stdout)}</div>
    `;
  }

  // Restore Prompt
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