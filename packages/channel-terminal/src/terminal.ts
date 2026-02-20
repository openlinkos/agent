/**
 * TerminalChannel — readline-based terminal channel with ANSI colored output.
 */

import * as readline from "node:readline";
import { BaseChannel } from "@openlinkos/channel";
import type { ChannelMessage, BaseChannelConfig } from "@openlinkos/channel";

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const GRAY = "\x1b[90m";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TerminalChannelConfig extends BaseChannelConfig {
  /** Prompt string displayed to the user. Default: "> " */
  prompt?: string;
  /** Readable stream to read input from. Default: process.stdin */
  input?: NodeJS.ReadableStream;
  /** Writable stream to write output to. Default: process.stdout */
  output?: NodeJS.WritableStream;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

let messageCounter = 0;

export class TerminalChannel extends BaseChannel {
  private rl: readline.Interface | null = null;
  private readonly prompt: string;
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;

  constructor(config: TerminalChannelConfig) {
    super(config);
    this.prompt = config.prompt ?? "> ";
    this.input = config.input ?? process.stdin;
    this.output = config.output ?? process.stdout;
  }

  protected async doConnect(): Promise<void> {
    this.rl = readline.createInterface({
      input: this.input,
      output: this.output as NodeJS.WritableStream,
      prompt: `${CYAN}${BOLD}${this.prompt}${RESET}`,
    });

    this.rl.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      const message: ChannelMessage = {
        id: `terminal-${++messageCounter}`,
        role: "user",
        text: trimmed,
        timestamp: new Date().toISOString(),
        metadata: { platform: "terminal" },
      };

      this.emitMessage(message).catch((err) => {
        this.emitError(err instanceof Error ? err : new Error(String(err)));
      });
    });

    this.rl.on("close", () => {
      this.setStatus("disconnected");
    });

    this.rl.prompt();
  }

  protected async doDisconnect(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async send(message: ChannelMessage): Promise<void> {
    const prefix = message.role === "assistant"
      ? `${GREEN}${BOLD}assistant${RESET}`
      : `${GRAY}${message.role}${RESET}`;

    const out = this.output as NodeJS.WritableStream & { write: (s: string) => boolean };
    out.write(`\n${prefix}: ${message.text}\n\n`);

    if (this.rl) {
      this.rl.prompt();
    }
  }

  /** Write a partial token to the output stream (for streaming display). */
  writeToken(token: string): void {
    const out = this.output as NodeJS.WritableStream & { write: (s: string) => boolean };
    out.write(token);
  }

  /** Signal the end of a streaming response. */
  endStream(): void {
    const out = this.output as NodeJS.WritableStream & { write: (s: string) => boolean };
    out.write("\n\n");
    if (this.rl) {
      this.rl.prompt();
    }
  }
}
