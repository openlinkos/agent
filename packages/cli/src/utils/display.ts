/**
 * Terminal output formatting utilities.
 *
 * Provides colored/styled output for agent responses, streaming text,
 * and status messages without pulling in a heavy dependency.
 */

// ---------------------------------------------------------------------------
// ANSI color codes
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Print an info message in cyan. */
export function info(message: string): void {
  console.log(colorize(message, CYAN));
}

/** Print a success message in green. */
export function success(message: string): void {
  console.log(colorize(message, GREEN));
}

/** Print a warning message in yellow. */
export function warn(message: string): void {
  console.log(colorize(message, YELLOW));
}

/** Print an error message in red. */
export function error(message: string): void {
  console.error(colorize(message, RED));
}

/** Print a label: value line with the label bolded and in magenta. */
export function label(name: string, value: string): void {
  console.log(`${BOLD}${MAGENTA}${name}${RESET} ${value}`);
}

/** Print a dim separator line. */
export function separator(): void {
  console.log(colorize("─".repeat(60), DIM));
}

/** Print a bold header. */
export function header(text: string): void {
  console.log(`\n${BOLD}${text}${RESET}`);
}

/** Write text to stdout without a newline (for streaming). */
export function streamWrite(text: string): void {
  process.stdout.write(text);
}

/** End a streaming line. */
export function streamEnd(): void {
  process.stdout.write("\n");
}

/** Format agent response for display. */
export function formatAgentResponse(agentName: string, text: string): void {
  separator();
  label("Agent:", agentName);
  console.log(text);
  separator();
}

/** Format team result for display. */
export function formatTeamResult(
  teamName: string,
  finalOutput: string,
  rounds: number,
  agentResults: Array<{ agentName: string; text: string }>,
): void {
  separator();
  label("Team:", teamName);
  label("Rounds:", String(rounds));
  console.log();

  for (const result of agentResults) {
    label(`  [${result.agentName}]`, "");
    console.log(`  ${result.text}`);
    console.log();
  }

  header("Final Output:");
  console.log(finalOutput);
  separator();
}

/** Print a prompt indicator for interactive mode. */
export function promptIndicator(): void {
  process.stdout.write(`${BOLD}${CYAN}> ${RESET}`);
}

export { RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED, MAGENTA };
