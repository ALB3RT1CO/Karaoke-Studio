# Autonomous Agent Guardrails & Anti-Looping Policies

## 5-Minute Watchdog Protocol
To prevent agent deadlock, repetitive tool looping, and token exhaustion, a watchdog monitors agent tasks every 5 minutes.

### Loop Detection Criteria
1. **Tool Invariance:** The agent executes the exact same tool with identical parameters $\ge 3$ consecutive times without progress.
2. **Diff Invariance:** The working tree git diff remains identical or empty across two consecutive 5-minute ticks while the task claims to be active.
3. **Error Invariance:** The test command produces the exact same error output $\ge 3$ consecutive times without diagnostic code changes.
4. **Task Duration Budget:** Any subtask exceeding 15 minutes of continuous execution without advancing a gate triggers a review.

### Circuit Breaker Actions
1. **Log Flag:** Append a `SPINNING` event to `logs/automation_results.jsonl`.
2. **Interrupt:** Suspend or kill the spinning subagent/task.
3. **Debug Dispatch:** Dispatch the root-cause debugger (`kiro-debug`) to isolate why the agent failed to converge.
4. **Human Notification:** Alert the user with an actionable summary of the stuck state and diagnostic findings.
