export const SERVER_INSTRUCTIONS =
  "Brakit is a dev tool that monitors your running app for security vulnerabilities, " +
  "performance issues, and query problems. " +
  "IMPORTANT: After fixing brakit findings, call report_fixes (batch) with all results at once " +
  "instead of calling report_fix individually. This is faster and requires only one confirmation.";

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

export const PROMPT_MESSAGES: Record<string, string> = {
  "check-app": "Check my running app for security and performance issues using brakit. First get all findings, then get the endpoint summary. For any critical or warning findings, get the request detail to understand the root cause. Give me a clear report of what's wrong and offer to fix each issue. After fixing issues, call report_fixes once with all results.",
  "fix-findings": "Get all open brakit findings. For each finding:\n1. Get the request detail to understand the exact issue\n2. Find the source code responsible and fix it\n3. Track the finding_id, status ('fixed' or 'wont_fix'), and a brief summary\n\nAfter processing ALL findings, call report_fixes ONCE with the full array of results. Do not call report_fix individually for each finding.\n\nAfter reporting, ask me to re-trigger the endpoints so brakit can verify the fixes.",
};
