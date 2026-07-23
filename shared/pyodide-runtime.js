/**
 * pyodide-runtime.js
 *
 * Thin wrapper around Pyodide that gives every cell/script Jupyter-like
 * execution semantics:
 *   - stdout / stderr are captured per run (not printed to the browser console)
 *   - the repr() of a trailing bare expression is returned, exactly like
 *     IPython's "Out[n]" behavior
 *   - exceptions come back as a formatted traceback string instead of
 *     throwing, so the UI can render them as normal cell output
 *
 * All cells (both in the notebook and in the .py file view) share a single
 * Python global namespace, the same way a single Jupyter kernel does. Call
 * PyRuntime.restart() to wipe it, mirroring Colab's "Restart runtime".
 */
const PyRuntime = (() => {
  const PYODIDE_VERSION = "v314.0.2";
  
  const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

  let pyodide = null;
  let loadingPromise = null;
  let runCellFn = null;

  // Installed once per Pyodide instance, then reinstalled after a restart
  // (restart just re-execs this into a fresh globals dict).
  const BOOTSTRAP_PY = `
import ast, io, traceback
from contextlib import redirect_stdout, redirect_stderr

def __pynb_run_cell__(code, ns):
    out, err = io.StringIO(), io.StringIO()
    result_repr, error_tb = None, None
    try:
        tree = ast.parse(code, mode="exec")
        with redirect_stdout(out), redirect_stderr(err):
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                last = tree.body.pop()
                if tree.body:
                    exec(compile(tree, "<cell>", "exec"), ns)
                expr = ast.Expression(last.value)
                ast.copy_location(expr, last.value)
                value = eval(compile(expr, "<cell>", "eval"), ns)
                if value is not None:
                    result_repr = repr(value)
            else:
                exec(compile(tree, "<cell>", "exec"), ns)
    except SyntaxError as e:
        error_tb = "".join(traceback.format_exception_only(type(e), e))
    except Exception as e:
        tb = e.__traceback__.tb_next  # drop this wrapper's own frame
        error_tb = "".join(traceback.format_exception(type(e), e, tb))
    return out.getvalue(), err.getvalue(), result_repr, error_tb
`;

  function freshNamespace() {
    // A brand new dict that behaves like module globals (__name__ etc).
    return pyodide.runPython("{'__name__': '__main__'}");
  }

  let namespace = null;

  async function init(onProgress) {
    if (pyodide) return pyodide;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      onProgress?.("Fetching Pyodide runtime\u2026");

      // Load via the ESM entry point (pyodide.mjs) using a dynamic import()
      // instead of injecting a classic <script src="pyodide.js"> tag.
      //
      // Why: as of the 314.x release line, Pyodide renamed the internal
      // pyodide.asm.js file to pyodide.asm.mjs (it's a proper ES module now).
      // pyodide.js is supposed to transparently handle this, but it locates
      // its own sibling asm file via document.currentScript — and that
      // detection is unreliable for <script> tags inserted dynamically via
      // createElement (as opposed to tags that are statically present in the
      // HTML). That mismatch is what causes it to request the old, now-
      // nonexistent pyodide.asm.js and 404. Dynamic import() carries its own
      // module URL (import.meta.url) with no such dependency, so it resolves
      // the correct .mjs file every time.
      const { loadPyodide } = await import(PYODIDE_CDN + "pyodide.mjs");
      pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

      onProgress?.("Starting Python\u2026");
      pyodide.runPython(BOOTSTRAP_PY);
      runCellFn = pyodide.globals.get("__pynb_run_cell__");
      namespace = freshNamespace();

      onProgress?.("Ready");
      return pyodide;
    })();

    return loadingPromise;
  }

  /**
   * Run one chunk of Python code against the shared namespace.
   * Returns { stdout, stderr, result, error }.
   */
  function run(code) {
    if (!pyodide || !runCellFn) {
      throw new Error("PyRuntime not initialized yet");
    }
    const proxy = runCellFn(code, namespace);
    const [stdout, stderr, result, error] = proxy.toJs();
    proxy.destroy();
    return { stdout, stderr, result, error };
  }

  /** Wipe all user-defined state, like Colab's "Restart runtime". */
  function restart() {
    if (namespace && namespace.destroy) {
      try {
        namespace.destroy();
      } catch (e) {
        /* already gone, ignore */
      }
    }
    namespace = freshNamespace();
  }

  function isReady() {
    return !!pyodide;
  }

  // ------------------------------------------------------------------
  // Compatibility layer for notebook.js's expected call signatures
  // ------------------------------------------------------------------

  async function getPyodide(onProgress) {
    return init(onProgress);
  }

  async function runCell(pyodideInstance, code, { onStdout, onStderr } = {}) {
    const { stdout, stderr, result, error } = run(code);
    if (stdout) onStdout?.(stdout.replace(/\n$/, ""));
    if (result != null) onStdout?.(result);
    if (stderr) onStderr?.(stderr.replace(/\n$/, ""));
    if (error) onStderr?.(error.replace(/\n$/, ""));
  }

  async function restartKernel(pyodideInstance) {
    restart();
  }

  return { getPyodide, runCell, restartKernel, isReady, init, run, restart };
})();