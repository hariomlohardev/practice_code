const engine = new PythonEngine();
let editor = null;
let currentProblem = null;

// UI References
const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('app');
const termLogStream = document.getElementById('terminal-log-stream');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next-problem');

async function initializeApp() {
  currentProblem = getRandomAIProblem();
  renderProblem(currentProblem);

  // Initialize CodeMirror with Auto-Close Brackets & Auto-Suggestions
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "dracula",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true, // Auto closes (), {}, "", [], ''
    extraKeys: {
      "Ctrl-Space": "autocomplete", // Manual trigger
      "Tab": function(cm) {
        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          cm.replaceSelection("    ", "end");
        }
      }
    }
  });

  // Auto-trigger suggestions on typing alphanumeric characters or dot
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

  // Action Handlers
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

function clearTerminal() {
  termLogStream.innerHTML = `
    <div class="terminal-line prompt-line">
      <span class="prompt-path">PS C:\\workspace\\python&gt;</span>
      <span class="text-muted">Awaiting code execution...</span>
    </div>
  `;
}

async function handleExecute() {
  const code = editor.getValue();
  btnRun.disabled = true;

  // Render PowerShell execution line
  termLogStream.innerHTML = `
    <div class="terminal-line prompt-line">
      <span class="prompt-path">PS C:\\workspace\\python&gt;</span>
      <span class="log-run">python -m unittest solution.py</span>
    </div>
    <div class="terminal-line text-muted">Executing test harness against Pyodide kernel...</div>
    <div class="terminal-line">&nbsp;</div>
  `;

  const result = await engine.run(code, currentProblem);
  btnRun.disabled = false;

  renderTerminalResults(result);
}

function renderTerminalResults(result) {
  let streamHtml = termLogStream.innerHTML;

  if (result.stderr) {
    streamHtml += `<div class="terminal-line log-fail">${escapeHtml(result.stderr)}</div>`;
  }

  if (result.results && result.results.length > 0) {
    let passedCount = 0;

    result.results.forEach((tc) => {
      const isPassed = tc.passed;
      if (isPassed) passedCount++;

      const dotClass = isPassed ? "dot-green" : "dot-red";
      const statusLabel = isPassed ? `<span class="log-pass">PASSED</span>` : `<span class="log-fail">FAILED</span>`;
      const timeInfo = `<span class="log-warn">${tc.time_ms.toFixed(2)}ms</span>`;

      streamHtml += `
        <div class="terminal-line">
          <span class="status-dot ${dotClass}"></span>
          <span> Test ${tc.id}: </span>
          ${statusLabel}
          <span class="text-muted"> in ${timeInfo}</span>
        </div>
      `;

      if (!isPassed) {
        streamHtml += `
          <div class="terminal-line text-muted" style="padding-left: 18px;">
            Expected: ${JSON.stringify(tc.expected)} | Got: ${JSON.stringify(tc.actual)}
          </div>
        `;
      }
    });

    const isAllPassed = passedCount === result.results.length;
    const summaryDot = isAllPassed ? "dot-green" : "dot-red";
    const summaryStatus = isAllPassed ? `<span class="log-pass">OK (All test cases passed)</span>` : `<span class="log-fail">FAIL (${result.results.length - passedCount} failed)</span>`;

    streamHtml += `
      <div class="terminal-line">&nbsp;</div>
      <div class="terminal-line">--------------------------------------------------</div>
      <div class="terminal-line">
        <span class="status-dot ${summaryDot}"></span>
        <span> Test Summary: ${summaryStatus}</span>
      </div>
    `;
  }

  if (result.stdout) {
    streamHtml += `
      <div class="terminal-line">&nbsp;</div>
      <div class="terminal-line text-muted">[Stdout Logs]:</div>
      <div class="terminal-line">${escapeHtml(result.stdout)}</div>
    `;
  }

  streamHtml += `
    <div class="terminal-line">&nbsp;</div>
    <div class="terminal-line prompt-line">
      <span class="prompt-path">PS C:\\workspace\\python&gt;</span>
      <span class="status-dot dot-blue mini pulsing"></span>
    </div>
  `;

  termLogStream.innerHTML = streamHtml;

  // Auto scroll terminal to bottom
  const termBody = document.getElementById('terminal-screen');
  termBody.scrollTop = termBody.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.addEventListener('DOMContentLoaded', initializeApp);