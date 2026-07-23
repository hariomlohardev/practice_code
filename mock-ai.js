const MOCK_PROBLEMS = [
  {
    title: "Target Sum Indices",
    description: "Given an array of integers <code>nums</code> and an integer <code>target</code>, return the indices of the two elements that add up to the target.<br><br>You may assume that each input has exactly one solution, and you may not use the same element twice.",
    functionName: "two_sum",
    targetTimeMs: 15.0,
    boilerplate: "def two_sum(nums, target):\n    # Type here. Brackets (), {}, [] auto-close.\n    # Press Ctrl+Space for IntelliSense suggestions.\n    pass\n",
    examples: [
      "Input: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]\nExplanation: nums[0] + nums[1] == 9",
      "Input: nums = [3, 2, 4], target = 6\nOutput: [1, 2]"
    ],
    testCases: [
      { inputs: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { inputs: [[3, 2, 4], 6], expected: [1, 2] },
      { inputs: [[3, 3], 6], expected: [0, 1] }
    ]
  }
];

function getRandomAIProblem() {
  return MOCK_PROBLEMS[Math.floor(Math.random() * MOCK_PROBLEMS.length)];
}