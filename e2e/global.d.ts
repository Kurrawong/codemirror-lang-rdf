/**
 * The fixture's API, as the browser exposes it.
 *
 * `e2e/fixture/app.ts` declares this on `window`, but the spec files are
 * compiled separately from the bundle, so they need the shape too.
 */
import type { LanguageName } from './helpers';

declare global {
  interface Window {
    rdfFixture: {
      colours: Record<string, string>;
      mount(id: string, language: LanguageName, doc: string): void;
      tokens(id: string): { text: string; color: string }[];
      colourOf(id: string, token: string): string | null;
      tagOf(id: string, token: string): string | null;
      visibleText(id: string): string;
      lineCount(id: string): number;
      foldGutterMarkers(id: string): number[];
      foldAll(id: string): void;
      unfoldAll(id: string): void;
      foldAt(id: string, line: number): boolean;
      type(id: string, text: string): void;
      setCursor(id: string, pos: number): void;
      completions(id: string): Promise<string[]>;
      docOf(id: string): string;
    };
  }
}
