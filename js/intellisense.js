/**
 * Python IntelliSense Language Server Engine
 */
const PythonIntelliSense = (() => {
  const BUILTINS = [
    { text: "print", type: "function", sig: "print(*values, sep=' ', end='\\n')", desc: "Prints the values to a stream, or sys.stdout." },
    { text: "len", type: "function", sig: "len(s) -> int", desc: "Return number of items in container." },
    { text: "range", type: "function", sig: "range(start, stop[, step])", desc: "Sequence of integers." },
    { text: "enumerate", type: "function", sig: "enumerate(iterable, start=0)", desc: "Yield (index, item) pairs." },
    { text: "zip", type: "function", sig: "zip(*iterables)", desc: "Tuple iterator from sequences." },
    { text: "sorted", type: "function", sig: "sorted(iterable, key=None)", desc: "New list with sorted items." },
    { text: "sum", type: "function", sig: "sum(iterable, start=0)", desc: "Sum of numbers." },
    { text: "min", type: "function", sig: "min(iterable)", desc: "Smallest item." },
    { text: "max", type: "function", sig: "max(iterable)", desc: "Largest item." },
    { text: "abs", type: "function", sig: "abs(x) -> number", desc: "Absolute value." },
    { text: "str", type: "class", sig: "str(object='') -> str", desc: "Convert to string." },
    { text: "int", type: "class", sig: "int(x=0) -> int", desc: "Convert to integer." },
    { text: "list", type: "class", sig: "list(iterable=()) -> list", desc: "Mutable sequence." },
    { text: "dict", type: "class", sig: "dict(**kwargs) -> dict", desc: "Associative array." }
  ];

  const KEYWORDS = [
    { text: "def", type: "keyword", sig: "def name(args):", desc: "Define function." },
    { text: "return", type: "keyword", sig: "return [expr]", desc: "Return from function." },
    { text: "class", type: "keyword", sig: "class Name:", desc: "Define class." },
    { text: "import", type: "keyword", sig: "import module", desc: "Import module." },
    { text: "if", type: "keyword", sig: "if condition:", desc: "Conditional branch." },
    { text: "for", type: "keyword", sig: "for var in sequence:", desc: "Iterate items." },
    { text: "while", type: "keyword", sig: "while condition:", desc: "Loop while true." }
  ];

  const SNIPPETS = [
    { text: "def", type: "snippet", sig: "def function(): ...", desc: "Function template", template: "def function_name(args):\n    pass" },
    { text: "class", type: "snippet", sig: "class ClassName: ...", desc: "Class template", template: "class ClassName:\n    def __init__(self):\n        pass" },
    { text: "for", type: "snippet", sig: "for i in range(): ...", desc: "Loop template", template: "for i in range(n):\n    pass" }
  ];

  const DOT_METHODS = {
    list: [
      { text: "append", type: "method", sig: ".append(obj)", desc: "Append to list end." },
      { text: "pop", type: "method", sig: ".pop([i]) -> item", desc: "Remove & return item." },
      { text: "sort", type: "method", sig: ".sort()", desc: "Sort list in-place." }
    ],
    string: [
      { text: "split", type: "method", sig: ".split(sep=None)", desc: "Split string to list." },
      { text: "join", type: "method", sig: ".join(iterable)", desc: "Join strings with separator." },
      { text: "strip", type: "method", sig: ".strip() -> str", desc: "Remove whitespace." }
    ],
    dict: [
      { text: "get", type: "method", sig: ".get(key[, default])", desc: "Get dict value." },
      { text: "items", type: "method", sig: ".items()", desc: "(key, value) pairs." }
    ],
    np: [
      { text: "array", type: "function", sig: "np.array(obj)", desc: "Create N-d array." },
      { text: "zeros", type: "function", sig: "np.zeros(shape)", desc: "Array of zeros." }
    ]
  };

  const installedPackages = new Set();

  function registerPackage(pkg) {
    installedPackages.add(pkg.toLowerCase().trim());
  }

  function getHints(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const lineUntilCursor = line.slice(0, cursor.ch);

    const dotMatch = lineUntilCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_]*)$/);
    if (dotMatch) {
      const varName = dotMatch[1].toLowerCase();
      const prefix = dotMatch[2].toLowerCase();
      const dotStart = cursor.ch - prefix.length;

      let methodPool = [];
      if (['nums', 'arr', 'list'].includes(varName) || varName.endsWith('s')) methodPool = DOT_METHODS.list;
      else if (['s', 'str', 'text'].includes(varName)) methodPool = DOT_METHODS.string;
      else if (['d', 'dict'].includes(varName)) methodPool = DOT_METHODS.dict;
      else if (DOT_METHODS[varName]) methodPool = DOT_METHODS[varName];
      else methodPool = [...DOT_METHODS.list, ...DOT_METHODS.string, ...DOT_METHODS.dict];

      const matches = methodPool.filter(m => m.text.startsWith(prefix));
      if (matches.length > 0) return buildHintResult(matches, CodeMirror.Pos(cursor.line, dotStart), cursor);
    }

    const token = cm.getTokenAt(cursor);
    const prefix = token.string.trim().toLowerCase();
    const tokenStart = CodeMirror.Pos(cursor.line, token.start);

    const dynamicPkgs = Array.from(installedPackages).map(p => ({
      text: p, type: "package", sig: `import ${p}`, desc: `Pip package (${p})`
    }));

    const fullPool = [...SNIPPETS, ...BUILTINS, ...KEYWORDS, ...dynamicPkgs];
    const matches = fullPool.filter(item => item.text.startsWith(prefix));

    if (matches.length === 0) return null;
    return buildHintResult(matches, tokenStart, cursor);
  }

  function buildHintResult(list, from, to) {
    return {
      list: list.map(item => ({
        text: item.template || item.text,
        displayText: item.text,
        hint: (cm, data, completion) => cm.replaceRange(completion.text, from, to),
        render: (element) => {
          element.className = "cm-hint-row";
          let badgeClass = "badge-kw"; let badgeLabel = "kw";
          if (item.type === "function") { badgeClass = "badge-fn"; badgeLabel = "fn"; }
          else if (item.type === "method") { badgeClass = "badge-prop"; badgeLabel = "mth"; }
          else if (item.type === "snippet") { badgeClass = "badge-snip"; badgeLabel = "snip"; }
          else if (item.type === "package") { badgeClass = "badge-pkg"; badgeLabel = "pkg"; }

          element.innerHTML = `
            <div class="hint-main">
              <span class="hint-badge ${badgeClass}">${badgeLabel}</span>
              <span class="hint-name">${item.text}</span>
            </div>
            <div class="hint-sig">${item.sig}</div>
          `;
        }
      })),
      from: from, to: to
    };
  }

  return { getHints, registerPackage };
})();