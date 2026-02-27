export interface McpPrompt {
  name: string;
  description: string;
}

export const PROMPTS: readonly McpPrompt[] = [
  {
    name: "check-app",
    description: "Check your running app for security vulnerabilities and performance issues",
  },
  {
    name: "fix-findings",
    description: "Find all open brakit findings and fix them one by one",
  },
];

export const PROMPT_MESSAGES: Readonly<Record<string, string>> = {
  "check-app": [
    "Check my running app for security and performance issues using brakit.",
    "First get all findings, then get the endpoint summary.",
    "For any critical or warning findings, get the request detail to understand the root cause.",
    "Give me a clear report of what's wrong and offer to fix each issue.",
  ].join(" "),
  "fix-findings": [
    "Get all open brakit findings.",
    "For each finding, get the request detail to understand the exact issue.",
    "Then find the source code responsible and fix it.",
    "After fixing, ask me to re-trigger the endpoint so you can verify the fix with brakit.",
  ].join(" "),
};
