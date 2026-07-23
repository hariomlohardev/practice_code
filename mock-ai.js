const MOCK_PROBLEMS = [
  {
    title: "1. Two Sum (Target Matching)",
    description: "Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.<br><br>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.",
    functionName: "two_sum",
    targetTimeMs: 15.0,
    boilerplate: "def two_sum(nums, target):\n    # Write your solution below\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n",
    examples: [
      "Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] == 9, return [0, 1].",
      "Input: nums = [3,2,4], target = 6\nOutput: [1,2]"
    ],
    testCases: [
      { inputs: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { inputs: [[3, 2, 4], 6], expected: [1, 2] },
      { inputs: [[3, 3], 6], expected: [0, 1] }
    ]
  },
  {
    title: "2. Valid Palindrome Verification",
    description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.<br><br>Return <code>True</code> if it is a palindrome, or <code>False</code> otherwise.",
    functionName: "is_palindrome",
    targetTimeMs: 10.0,
    boilerplate: "import re\n\ndef is_palindrome(s: str) -> bool:\n    # Clean and check palindrome\n    cleaned = re.sub(r'[^a-zA-Z0-9]', '', s).lower()\n    return cleaned == cleaned[::-1]\n",
    examples: [
      "Input: s = \"A man, a plan, a canal: Panama\"\nOutput: True",
      "Input: s = \"race a car\"\nOutput: False"
    ],
    testCases: [
      { inputs: ["A man, a plan, a canal: Panama"], expected: true },
      { inputs: ["race a car"], expected: false },
      { inputs: [" "], expected: true }
    ]
  }
];

function getRandomAIProblem() {
  const randomIndex = Math.floor(Math.random() * MOCK_PROBLEMS.length);
  return MOCK_PROBLEMS[randomIndex];
}