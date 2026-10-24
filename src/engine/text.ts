/**
 * C0 controls other than tab, newline and carriage return, plus DEL and the
 * C1 range. ESC and CSI are in here: a page title or robots.txt line carrying
 * them would otherwise rewrite the terminal that prints the report.
 */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

/** Drop control characters from text that came from a fetched page or file. */
export function stripControl(text: string): string {
  return text.replace(CONTROL, "");
}
