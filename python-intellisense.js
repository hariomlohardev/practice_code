/**
 * Advanced Python IntelliSense Engine for CodeMirror
 * Modeled after PyCharm / VS Code Language Server
 */
const PythonIntelliSense = (() => {
  // 1. Built-in Functions
  const BUILTINS = [
    { text: "print", type: "function", sig: "print(*values, sep=' ', end='\\n')", desc: "Prints the values to a stream, or to sys.stdout by default." },
    { text: "len", type: "function", sig: "len(s) -> int", desc: "Return the number of items in a container or sequence." },
    { text: "range", type: "function", sig: "range(stop) / range(start, stop[, step])", desc: "Return an object that produces a sequence of integers." },
    { text: "enumerate", type: "function", sig: "enumerate(iterable, start=0)", desc: "Return an enumerate object yielding (index, item) pairs." },
    { text: "zip", type: "function", sig: "zip(*iterables)", desc: "Returns an iterator of tuples, where the i-th tuple contains the i-th element from each of the argument sequences." },
    { text: "sorted", type: "function", sig: "sorted(iterable, key=None, reverse=False)", desc: "Return a new list containing all items from the iterable in ascending order." },
    { text: "map", type: "function", sig: "map(func, *iterables)", desc: "Make an iterator that computes the function using arguments from each of the iterables." },
    { text: "filter", type: "function", sig: "filter(function, iterable)", desc: "Return an iterator yielding those items of iterable for which function(item) is true." },
    { text: "sum", type: "function", sig: "sum(iterable, start=0)", desc: "Return the sum of a 'start' value plus an iterable of numbers." },
    { text: "min", type: "function", sig: "min(iterable, *[, key, default])", desc: "Return the smallest item in an iterable or the smallest of two or more arguments." },
    { text: "max", type: "function", sig: "max(iterable, *[, key, default])", desc: "Return the largest item in an iterable or the largest of two or more arguments." },
    { text: "abs", type: "function", sig: "abs(x) -> number", desc: "Return the absolute value of the argument." },
    { text: "isinstance", type: "function", sig: "isinstance(object, classinfo) -> bool", desc: "Return whether an object is an instance of a class or subclass." },
    { text: "type", type: "function", sig: "type(object) -> type", desc: "Return the type of an object." },
    { text: "str", type: "class", sig: "str(object='') -> str", desc: "Create a new string object from the given object." },
    { text: "int", type: "class", sig: "int(x=0) -> int", desc: "Convert a number or string to an integer, or return 0 if no arguments are given." },
    { text: "float", type: "class", sig: "float(x=0.0) -> float", desc: "Convert a string or number to a floating point number, if possible." },
    { text: "list", type: "class", sig: "list(iterable=()) -> list", desc: "Built-in mutable sequence." },
    { text: "dict", type: "class", sig: "dict(**kwargs) -> dict", desc: "Built-in associative array (dictionary)." },
    { text: "set", type: "class", sig: "set(iterable=()) -> set", desc: "Built-in unordered collection of unique elements." }
  ];

  // 2. Control Keywords
  const KEYWORDS = [
    { text: "def", type: "keyword", sig: "def name(args):", desc: "Define a function or method." },
    { text: "return", type: "keyword", sig: "return [expr]", desc: "Return from a function." },
    { text: "class", type: "keyword", sig: "class Name(base):", desc: "Define a new class." },
    { text: "import", type: "keyword", sig: "import module", desc: "Import a module into the current namespace." },
    { text: "from", type: "keyword", sig: "from module import name", desc: "Import specific attributes from a module." },
    { text: "if", type: "keyword", sig: "if condition:", desc: "Conditional execution." },
    { text: "elif", type: "keyword", sig: "elif condition:", desc: "Else-if conditional branch." },
    { text: "else", type: "keyword", sig: "else:", desc: "Alternative conditional branch." },
    { text: "for", type: "keyword", sig: "for var in sequence:", desc: "Iterate over items of a sequence." },
    { text: "while", type: "keyword", sig: "while condition:", desc: "Loop while condition remains true." },
    { text: "try", type: "keyword", sig: "try:", desc: "Begin block for exception handling." },
    { text: "except", type: "keyword", sig: "except Exception as e:", desc: "Catch and handle exceptions." },
    { text: "finally", type: "keyword", sig: "finally:", desc: "Clean-up block executed regardless of exceptions." },
    { text: "with", type: "keyword", sig: "with context_manager as var:", desc: "Wrap execution with context managers." },
    { text: "lambda", type: "keyword", sig: "lambda args: expression", desc: "Anonymous inline function." },
    { text: "pass", type: "keyword", sig: "pass", desc: "Null statement placeholder." }
  ];

  // 3. Code Snippets
  const SNIPPETS = [
    { text: "def", type: "snippet", sig: "def function(): ...", desc: "Function definition template", template: "def function_name(args):\n    \"\"\"Docstring\"\"\"\n    pass" },
    { text: "class", type: "snippet", sig: "class ClassName: ...", desc: "Class definition template", template: "class ClassName:\n    def __init__(self):\n        pass" },
    { text: "for", type: "snippet", sig: "for i in range(): ...", desc: "Loop with range template", template: "for i in range(n):\n    pass" },
    { text: "ifmain", type: "snippet", sig: "if __name__ == '__main__':", desc: "Main entry point block", template: "if __name__ == '__main__':\n    main()" },
    { text: "try", type: "snippet", sig: "try ... except", desc: "Exception handler template", template: "try:\n    pass\nexcept Exception as e:\n    print(f\"Error: {e}\")" }
  ];

  // 4. Dot-Notation Methods
  const DOT_METHODS = {
    // List methods
    list: [
      { text: "append", type: "method", sig: ".append(object)", desc: "Append object to the end of the list." },
      { text: "extend", type: "method", sig: ".extend(iterable)", desc: "Extend list by appending elements from the iterable." },
      { text: "pop", type: "method", sig: ".pop([index]) -> item", desc: "Remove and return item at index (default last)." },
      { text: "remove", type: "method", sig: ".remove(value)", desc: "Remove first occurrence of value." },
      { text: "sort", type: "method", sig: ".sort(key=None, reverse=False)", desc: "Sort the list in ascending order in-place." },
      { text: "reverse", type: "method", sig: ".reverse()", desc: "Reverse *IN PLACE*." },
      { text: "index", type: "method", sig: ".index(value) -> int", desc: "Return first index of value." },
      { text: "count", type: "method", sig: ".count(value) -> int", desc: "Return number of occurrences of value." }
    ],
    // String methods
    string: [
      { text: "split", type: "method", sig: ".split(sep=None, maxsplit=-1)", desc: "Return a list of the substrings in the string using sep as the delimiter." },
      { text: "join", type: "method", sig: ".join(iterable)", desc: "Concatenate any number of strings in iterable with this string as separator." },
      { text: "lower", type: "method", sig: ".lower() -> str", desc: "Return a copy of the string converted to lowercase." },
      { text: "upper", type: "method", sig: ".upper() -> str", desc: "Return a copy of the string converted to uppercase." },
      { text: "strip", type: "method", sig: ".strip([chars]) -> str", desc: "Return a copy of the string with leading and trailing whitespace removed." },
      { text: "replace", type: "method", sig: ".replace(old, new[, count])", desc: "Return a copy with all occurrences of substring old replaced by new." },
      { text: "startswith", type: "method", sig: ".startswith(prefix) -> bool", desc: "Return True if string starts with the specified prefix." },
      { text: "endswith", type: "method", sig: ".endswith(suffix) -> bool", desc: "Return True if string ends with the specified suffix." }
    ],
    // Dict methods
    dict: [
      { text: "get", type: "method", sig: ".get(key[, default])", desc: "Return the value for key if key is in the dictionary, else default." },
      { text: "items", type: "method", sig: ".items() -> dict_items", desc: "a set-like object providing a view on D's items (key, value pairs)." },
      { text: "keys", type: "method", sig: ".keys() -> dict_keys", desc: "a set-like object providing a view on D's keys." },
      { text: "values", type: "method", sig: ".values() -> dict_values", desc: "an object providing a view on D's values." },
      { text: "update", type: "method", sig: ".update([other])", desc: "Update D from dict/iterable E and F." }
    ],
    // Module: math
    math: [
      { text: "sqrt", type: "function", sig: "math.sqrt(x) -> float", desc: "Return the square root of x." },
      { text: "ceil", type: "function", sig: "math.ceil(x) -> int", desc: "Return the ceiling of x as an Integral." },
      { text: "floor", type: "function", sig: "math.floor(x) -> int", desc: "Return the floor of x as an Integral." },
      { text: "pow", type: "function", sig: "math.pow(x, y) -> float", desc: "Return x raised to the power y." },
      { text: "inf", type: "property", sig: "math.inf", desc: "A floating-point positive infinity." }
    ],
    // Module: re
    re: [
      { text: "sub", type: "function", sig: "re.sub(pattern, repl, string)", desc: "Return the string obtained by replacing the leftmost non-overlapping occurrences." },
      { text: "match", type: "function", sig: "re.match(pattern, string)", desc: "Try to apply the pattern at the start of the string." },
      { text: "findall", type: "function", sig: "re.findall(pattern, string)", desc: "Return a list of all non-overlapping matches in the string." }
    ],
    // Module: json
    json: [
      { text: "dumps", type: "function", sig: "json.dumps(obj) -> str", desc: "Serialize obj to a JSON formatted str." },
      { text: "loads", type: "function", sig: "json.loads(s) -> obj", desc: "Deserialize s (a str, bytes or bytearray instance) to a Python object." }
    ]
  };

  /**
   * Main completion handler for CodeMirror
   */
  function getHints(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const lineUntilCursor = line.slice(0, cursor.ch);

    // 1. Check for Dot completion (e.g. nums., s., math.)
    const dotMatch = lineUntilCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_]*)$/);
    if (dotMatch) {
      const varName = dotMatch[1].toLowerCase();
      const prefix = dotMatch[2].toLowerCase();
      const dotStart = cursor.ch - prefix.length;

      let methodPool = [];
      if (['nums', 'arr', 'array', 'list', 'items', 'res', 'ans'].includes(varName) || varName.endsWith('s')) {
        methodPool = DOT_METHODS.list;
      } else if (['s', 'str', 'text', 'line', 'word', 'string'].includes(varName)) {
        methodPool = DOT_METHODS.string;
      } else if (['d', 'dict', 'mapping', 'hash', 'map'].includes(varName)) {
        methodPool = DOT_METHODS.dict;
      } else if (DOT_METHODS[varName]) {
        methodPool = DOT_METHODS[varName];
      } else {
        // Fallback: merge list and string methods
        methodPool = [...DOT_METHODS.list, ...DOT_METHODS.string, ...DOT_METHODS.dict];
      }

      const matches = methodPool.filter(m => m.text.startsWith(prefix));
      if (matches.length > 0) {
        return buildHintResult(matches, CodeMirror.Pos(cursor.line, dotStart), cursor);
      }
    }

    // 2. Standard Word completion
    const token = cm.getTokenAt(cursor);
    const prefix = token.string.trim().toLowerCase();
    const tokenStart = CodeMirror.Pos(cursor.line, token.start);

    // Collect all candidate pools
    const fullPool = [...SNIPPETS, ...BUILTINS, ...KEYWORDS];
    const matches = fullPool.filter(item => item.text.startsWith(prefix));

    if (matches.length === 0) return null;

    return buildHintResult(matches, tokenStart, cursor);
  }

  function buildHintResult(list, from, to) {
    return {
      list: list.map(item => ({
        text: item.template || item.text,
        displayText: item.text,
        hint: (cm, data, completion) => {
          cm.replaceRange(completion.text, from, to);
          // If snippet, position cursor appropriately
          if (item.template && item.template.includes('pass')) {
            const cursor = cm.getCursor();
            cm.setCursor({ line: cursor.line, ch: cursor.ch });
          }
        },
        render: (element) => {
          element.className = "cm-hint-row";
          
          let badgeClass = "badge-kw";
          let badgeLabel = "kw";
          if (item.type === "function") { badgeClass = "badge-fn"; badgeLabel = "fn"; }
          else if (item.type === "method") { badgeClass = "badge-prop"; badgeLabel = "mth"; }
          else if (item.type === "snippet") { badgeClass = "badge-snip"; badgeLabel = "snip"; }
          else if (item.type === "class") { badgeClass = "badge-cls"; badgeLabel = "cls"; }

          element.innerHTML = `
            <div class="hint-main">
              <span class="hint-badge ${badgeClass}">${badgeLabel}</span>
              <span class="hint-name">${item.text}</span>
            </div>
            <div class="hint-sig">${item.sig}</div>
          `;
        }
      })),
      from: from,
      to: to
    };
  }

  return { getHints };
})();