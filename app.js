const engine = new PythonEngine();
let editor = null;
let currentProblem = null;

// DOM Handles
const loadingScreen = document.getElementById('loading-screen');
const appContainer = document.getElementById('app');
const terminalStream = document.getElementById('terminal-stream');
const terminalBody = document.getElementById('terminal-body');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const btnNext = document.getElementById('btn-next');

async function initializeApp() {
  currentProblem = getRandomAIProblem();
  renderProblem(currentProblem);

  // Initialize CodeMirror with Auto-Close Brackets & Auto-Suggest
  editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "material-ocean",
    lineNumbers: true,
    autoCloseBrackets: true, // Auto closes (), {}, [], "", ''
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Ctrl-Enter": () => handleRunCode()
    }
  });

  // Enable Auto-suggestions while typing letters
  editor.on("inputRead", function(cm, change) {
    if (change.origin !== "+delete" && /[a-zA-Z_]/.test(change.text[0])) {
      CodeMirror.commands.autocomplete(cm, null, { completeSingle: false });
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
    }, 500);
  } catch (err) {
    alert("Engine setup failed: " + err.message);
  }

  // Bind Listeners
  btnRun.addEventListener('click', handleRunCode);
  btnReset.addEventListener('click', () => editor.setValue(currentProblem.boilerplate));
  btnNext.addEventListener('click', () => {
    currentProblem = getRandomAIProblem();
    renderProblem(currentProblem);
    editor.setValue(currentProblem.boilerplate);
    terminalStream.innerHTML = '';
  });
}

function renderProblem(problem) {
  document.getElementById('problem-title').innerText = problem.title;
  document.getElementById('problem-desc').innerHTML = problem.description;
  document.getElementById('target-time').innerText = problem.targetTimeMs;

  const examplesContainer = document.getElementById('problem-examples');
  examplesContainer.innerHTML = problem.examples.map(ex => 
    `<div class="example-item">${ex.replace(/\n/g, '<br>')}</div>`
  ).join('');
}

async function handleRunCode() {
  const code = editor.getValue();
  
  btnRun.disabled = true;
  btnRun.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Running...`;

  // Write command run prompt to Windows Terminal
  appendTerminalLine(`<span class="ps-prompt">PS C:\\environment\\python&gt;</span> python -m pytest solution.py`);
  appendTerminalLine(`<span style="color:#64748b;">[+] Running test suite execution...</span>`);

  const result = await engine.run(code, currentProblem);

  btnRun.disabled = false;
  btnRun.innerHTML = `<i class="ph ph-play"></i> <span>Run Code</span>`;

  renderTerminalResults(result);
}

function appendTerminalLine(htmlContent) {
  const line = document.createElement('div');
  line.innerHTML = htmlContent;
  terminalStream.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

function renderTerminalResults(result) {
  let streamHtml = `<div class="term-suite">`;

  // Render Stderr Error Tracebacks if any
  if (result.stderr) {
    streamHtml += `<div style="color: var(--status-fail); white-space: pre-wrap;">${result.stderr}</div>`;
  }

  // Render Test Stream
  if (result.results && result.results.length > 0) {
    let passedCount = 0;
    let totalTime = 0;

    result.results.forEach(tc => {
      totalTime += tc.time_ms;
      if (tc.passed) passedCount++;

      const statusDot = tc.passed ? `<span class="dot dot-pass"></span>` : `<span class="dot dot-fail"></span>`;
      const statusTag = tc.passed ? `<span class="tag-pass">PASSED</span>` : `<span class="tag-fail">FAILED</span>`;

      streamHtml += `
        <div class="term-line">
          ${statusDot}
          <span>test_case_${tc.id}</span>
          <span>........................</span>
          ${statusTag}
          <span style="color:#64748b;">(${tc.time_ms}ms)</span>
        </div>
      `;

      if (!tc.passed) {
        streamHtml += `
          <div class="term-detail">
            Input: ${JSON.stringify(tc.inputs)} | Expected: ${JSON.stringify(tc.expected)} | Got: ${JSON.stringify(tc.actual)}
          </div>
        `;
      }
    });

    // Render Stdout prints if any
    if (result.stdout) {
      streamHtml += `<div class="term-stdout"><strong>Standard Output:</strong><br>${result.stdout.trim().replace(/\n/g, '<br>')}</div>`;
    }

    // Summary Line
    const allPassed = passedCount === result.results.length;
    const summaryColor = allPassed ? 'var(--status-pass)' : 'var(--status-fail)';
    
    streamHtml += `
      <div class="term-summary">
        Summary: <strong style="color:${summaryColor}">${passedCount}/${result.results.length} Passed</strong> 
        in <strong>${totalTime.toFixed(2)}ms</strong>
      </div>
    `;
  }

  streamHtml += `</div>`;
  appendTerminalLine(streamHtml);
}

window.addEventListener('DOMContentLoaded', initializeApp);