const engine = new PythonEngine();
let editor = null;
let currentProblem = null;

const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('mac-window');
const termLogStream = document.getElementById('terminal-log-stream');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');

// Format current time for Mac Terminal Login string
document.getElementById('login-time').innerText = new Date().toLocaleTimeString([], {weekday: 'short', hour: '2-digit', minute:'2-digit'});

async function initializeApp() {
  currentProblem = getRandomAIProblem();
  renderProblem(currentProblem);

  // Initialize VS Code / CodeMirror Editor
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "dracula",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true, // Enables VS Code like () {} "" auto-close
    extraKeys: {
      "Ctrl-Space": "autocomplete", // IntelliSense trigger
      "Tab": function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("    ", "end");
      }
    }
  });

  // Auto-trigger IntelliSense popups as user types
  editor.on("inputRead", function(cm, change) {
    if (change.origin === "+input") {
      const text = change.text[0];
      if (/^[a-zA-Z_.]*$/.test(text) && text.length > 0) {
        cm.showHint({ completeSingle: false });
      }
    }
  });

  editor.setValue(currentProblem.boilerplate);

  try {
    await engine.init();
    loadingScreen.style.display = 'none';
    appContainer.classList.remove('hidden');
    editor.refresh();
  } catch (err) {
    alert("Error loading Python Kernel: " + err.message);
  }

  btnRun.addEventListener('click', handleExecute);
  btnReset.addEventListener('click', () => editor.setValue(currentProblem.boilerplate));
  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    clearTerminal();
  });
}

function renderProblem(problem) {
  document.getElementById('problem-title').innerText = problem.title;
  document.getElementById('problem-desc').innerHTML = problem.description;
  document.getElementById('target-time').innerText = problem.targetTimeMs;

  const examplesBlock = document.getElementById('problem-examples');
  examplesBlock.innerHTML = problem.examples.map(ex => 
    `<div class="example-box">${ex.replace(/\n/g, '<br>')}</div>`
  ).join('');
}

function getZshPrompt() {
  return `<span class="prompt-user">dev@macbook-pro</span> <span class="prompt-dir">python-practice</span> % `;
}

function clearTerminal() {
  termLogStream.innerHTML = `
    <div class="terminal-line prompt-line">
      ${getZshPrompt()} <span class="text-muted">_</span>
    </div>
  `;
}

async function handleExecute() {
  const code = editor.getValue();
  btnRun.disabled = true;

  // Render Mac zsh execution line
  termLogStream.innerHTML = `
    <div class="terminal-line prompt-line">
      ${getZshPrompt()} <span class="log-run">python3 solution.py</span>
    </div>
    <div class="terminal-line text-muted">Running test harness...</div>
  `;

  const result = await engine.run(code, currentProblem);
  btnRun.disabled = false;
  renderTerminalResults(result);
}

function renderTerminalResults(result) {
  let streamHtml = termLogStream.innerHTML;

  // Python Exception / Traceback
  if (result.stderr) {
    streamHtml += `<div class="terminal-line log-fail">${escapeHtml(result.stderr)}</div>`;
  }

  // Test Results Output
  if (result.results && result.results.length > 0) {
    let passedCount = 0;

    result.results.forEach((tc) => {
      if (tc.passed) passedCount++;

      const statusIcon = tc.passed ? `<span class="log-pass">✔ PASS</span>` : `<span class="log-fail">✘ FAIL</span>`;
      const timeInfo = `<span class="text-muted">(${tc.time_ms.toFixed(2)}ms)</span>`;

      streamHtml += `
        <div class="terminal-line">
          ${statusIcon} Test Case ${tc.id} ${timeInfo}
        </div>
      `;

      if (!tc.passed) {
        streamHtml += `
          <div class="terminal-line text-muted" style="padding-left: 20px;">
            ↳ Expected: ${JSON.stringify(tc.expected)} | Output: ${JSON.stringify(tc.actual)}
          </div>
        `;
      }
    });

    const isAllPassed = passedCount === result.results.length;
    const summaryStatus = isAllPassed 
      ? `<span class="log-pass">✨ All tests passed.</span>` 
      : `<span class="log-fail">⚠ ${result.results.length - passedCount} test(s) failed.</span>`;

    streamHtml += `
      <div class="terminal-line">&nbsp;</div>
      <div class="terminal-line">${summaryStatus}</div>
    `;
  }

  // Raw Stdout
  if (result.stdout) {
    streamHtml += `
      <div class="terminal-line text-muted">[stdout]</div>
      <div class="terminal-line">${escapeHtml(result.stdout)}</div>
    `;
  }

  // Return to prompt
  streamHtml += `
    <div class="terminal-line">&nbsp;</div>
    <div class="terminal-line prompt-line">
      ${getZshPrompt()} <span class="text-muted">_</span>
    </div>
  `;

  termLogStream.innerHTML = streamHtml;

  // Auto scroll terminal
  const termBody = document.getElementById('terminal-screen');
  termBody.scrollTop = termBody.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.addEventListener('DOMContentLoaded', initializeApp);