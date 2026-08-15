import { clipboard } from 'electron';

export function readClipboard(): string {
  return clipboard.readText();
}

export function writeClipboard(text: string): void {
  clipboard.writeText(text);
}
