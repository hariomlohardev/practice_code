/**
 * Terminal Controller & Command Processing Engine
 */
const TerminalManager = (() => {
  const termLogStream = document.getElementById('terminal-log-stream');
  
  function getPrompt() {
    return `<span class="prompt-host">macbook-pro</span> <span class="prompt-dir">~</span> %`;
  }

  function appendPrompt(onCommandExecute) {
    const wrapper = document.createElement('div');
    wrapper.className = 'term-line prompt-wrap';
    wrapper.innerHTML = `
      ${getPrompt()} 
      <input type="text" class="term-input" autocomplete="off" spellcheck="false">
    `;
    termLogStream.appendChild(wrapper);
    
    const input = wrapper.querySelector('.term-input');
    
    // Smooth input focus without forcing autofocus attribute
    setTimeout(() => {
      if (document.activeElement !== input && document.activeElement.tagName !== 'TEXTAREA') {
        input.focus();
      }
    }, 50);
    
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        wrapper.innerHTML = `${getPrompt()} <span class="log-cmd">${escapeHtml(cmd)}</span>`;
        
        if (cmd === '') {
          appendPrompt(onCommandExecute);
        } else if (cmd === 'clear') {
          termLogStream.innerHTML = '';
          appendPrompt(onCommandExecute);
        } else if (onCommandExecute) {
          await onCommandExecute(cmd);
        }
        scrollToBottom();
      }
    });
  }

  function appendLog(message, className = '') {
    const div = document.createElement('div');
    div.className = `term-line ${className}`;
    div.textContent = message;
    termLogStream.appendChild(div);
    scrollToBottom();
  }

  function renderTestResults(result, problemName) {
    if (result.stdout) appendLog(result.stdout.replace(/\n$/, ''));
    if (result.stderr) appendLog(result.stderr.replace(/\n$/, ''), 'log-fail');

    if (result.func_found === false) {
      appendLog(`pytest: error: function '${problemName}' not defined in main.py`, 'log-fail');
    } else if (result.results && result.results.length > 0) {
      let passedCount = 0;
      appendLog('rootdir: /workspace, configfile: pytest.ini', 'text-tertiary');

      result.results.forEach((tc) => {
        if (tc.passed) passedCount++;
        const statusHtml = tc.passed ? `<span class="log-pass">PASSED</span>` : `<span class="log-fail">FAILED</span>`;
        const timeHtml = `<span class="text-tertiary">[${tc.time_ms.toFixed(2)}ms]</span>`;

        const row = document.createElement('div');
        row.className = 'term-line test-row';
        row.innerHTML = `<span>test_cases.py::case_${tc.id}</span><span class="dots"></span>${statusHtml} ${timeHtml}`;
        termLogStream.appendChild(row);

        if (!tc.passed) {
          appendLog(`  E   AssertionError: expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(tc.actual)}`, 'log-fail');
        }
      });

      const failedCount = result.results.length - passedCount;
      const summaryText = failedCount === 0 
        ? `===== ${result.results.length} passed in 0.04s =====` 
        : `===== ${failedCount} failed, ${passedCount} passed in 0.05s =====`;
      
      appendLog(summaryText, failedCount === 0 ? 'log-pass' : 'log-fail');
    }
  }

  function scrollToBottom() {
    const termBody = document.getElementById('terminal-screen');
    termBody.scrollTop = termBody.scrollHeight;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  return { appendPrompt, appendLog, renderTestResults, scrollToBottom };
})();