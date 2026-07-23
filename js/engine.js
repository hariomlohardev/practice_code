/**
 * Pyodide Python Engine & Package Manager
 */
class PythonEngine {
  constructor() { 
    this.pyodide = null; 
    this.micropipReady = false;
  }

  async init() {
    this.pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" });
    
    const testRunnerCode = `
import json, time, io, sys, traceback

def __run_test_suite__(user_code, func_name, tests_json):
    out = io.StringIO(); err = io.StringIO()
    sys.stdout = out; sys.stderr = err

    results = []
    func_found = False

    try:
        namespace = {}
        exec(user_code, namespace)
        
        if func_name in namespace:
            func_found = True
            func = namespace[func_name]
            tests = json.loads(tests_json)

            for i, test in enumerate(tests):
                inputs = test['inputs']
                expected = test['expected']
                start_time = time.perf_counter()
                actual = func(*inputs)
                end_time = time.perf_counter()
                
                exec_time_ms = (end_time - start_time) * 1000
                results.append({
                    "id": i + 1, "passed": (actual == expected),
                    "actual": actual, "expected": expected, "time_ms": round(exec_time_ms, 4)
                })

    except Exception as e:
        traceback.print_exc()

    sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__

    return json.dumps({ 
        "stdout": out.getvalue(), 
        "stderr": err.getvalue(), 
        "results": results,
        "func_found": func_found
    })
`;
    await this.pyodide.runPythonAsync(testRunnerCode);
  }

  async installPackage(pkgName, logCallback) {
    try {
      if (!this.micropipReady) {
        logCallback(`Initializing micropip package manager...`);
        await this.pyodide.loadPackage("micropip");
        this.micropipReady = true;
      }

      logCallback(`Collecting ${pkgName}...`);
      logCallback(`Downloading ${pkgName} wheels...`);

      const pyCode = `
import micropip
await micropip.install('${pkgName}')
`;
      await this.pyodide.runPythonAsync(pyCode);
      logCallback(`Successfully installed ${pkgName}`);
      return true;
    } catch (err) {
      logCallback(`ERROR: Could not install ${pkgName}: ${err.message}`);
      return false;
    }
  }

  async run(userCode, problemConfig) {
    try {
      await this.pyodide.loadPackagesFromImports(userCode);
      const testSuiteRunner = this.pyodide.globals.get("__run_test_suite__");
      const resultJson = testSuiteRunner(userCode, problemConfig.functionName, JSON.stringify(problemConfig.testCases));
      return JSON.parse(resultJson);
    } catch (e) {
      return { stdout: "", stderr: e.message, results: [], func_found: false };
    }
  }
}