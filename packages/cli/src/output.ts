/**
 * Terminal output formatting for @openlinkos/cli.
 *
 * Provides colored output without external dependencies using ANSI codes.
 */

// ---------------------------------------------------------------------------
// ANSI color codes
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";

// ---------------------------------------------------------------------------
// Color functions
// ---------------------------------------------------------------------------

/** Check if color output is supported. */
function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stdout.isTTY === true;
}

function wrap(code: string, text: string): string {
  return supportsColor() ? `${code}${text}${RESET}` : text;
}

export function bold(text: string): string {
  return wrap(BOLD, text);
}

export function dim(text: string): string {
  return wrap(DIM, text);
}

export function red(text: string): string {
  return wrap(RED, text);
}

export function green(text: string): string {
  return wrap(GREEN, text);
}

export function yellow(text: string): string {
  return wrap(YELLOW, text);
}

export function blue(text: string): string {
  return wrap(BLUE, text);
}

export function cyan(text: string): string {
  return wrap(CYAN, text);
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/** Print an informational message. */
export function info(message: string): void {
  console.log(`${blue("ℹ")} ${message}`);
}

/** Print a success message. */
export function success(message: string): void {
  console.log(`${green("✔")} ${message}`);
}

/** Print a warning message. */
export function warn(message: string): void {
  console.error(`${yellow("⚠")} ${message}`);
}

/** Print an error message with optional details. */
export function error(message: string, detail?: string): void {
  console.error(`${red("✖")} ${message}`);
  if (detail) {
    console.error(`  ${dim(detail)}`);
  }
}

/** Print a verbose/debug message (only when verbose is enabled). */
export function debug(message: string, verbose: boolean): void {
  if (verbose) {
    console.error(`${dim("[debug]")} ${dim(message)}`);
  }
}

/** Print a formatted header for a section. */
export function header(text: string): void {
  console.log(`\n${bold(cyan(text))}`);
  console.log(dim("─".repeat(text.length)));
}

/**
 * Format a token usage summary.
 */
export function formatUsage(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): string {
  return `${dim("tokens:")} prompt=${usage.promptTokens} completion=${usage.completionTokens} total=${usage.totalTokens}`;
}
