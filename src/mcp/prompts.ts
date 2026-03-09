export const SERVER_INSTRUCTIONS =
  "Brakit is a dev tool that monitors your running app for security vulnerabilities, " +
  "performance issues, and query problems. " +
  "IMPORTANT: After fixing any brakit finding, always call the report_fix tool with " +
  "the finding_id, status ('fixed' or 'wont_fix'), and a brief summary of what you did. " +
  "This updates the dashboard in real-time so the developer can track AI-driven fixes.";

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
  "check-app": "Check my running app for security and performance issues using brakit. First get all findings, then get the endpoint summary. For any critical or warning findings, get the request detail to understand the root cause. Give me a clear report of what's wrong and offer to fix each issue. After fixing any issue, call report_fix with the finding_id, status, and summary.",
  "fix-findings": "Get all open brakit findings. For each finding:\n1. Get the request detail to understand the exact issue\n2. Find the source code responsible and fix it\n3. Call report_fix with the finding_id, status ('fixed' or 'wont_fix'), and a brief summary of what you did\n4. Move to the next finding\n\nAfter all findings are processed, ask me to re-trigger the endpoints so brakit can verify the fixes.",
};
