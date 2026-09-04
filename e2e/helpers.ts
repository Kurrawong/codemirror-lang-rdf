import type { Page } from '@playwright/test';

export type LanguageName = 'turtle' | 'trig' | 'ntriples' | 'nquads' | 'sparql' | 'srl' | 'srl-no-tuples';

/** Mount a real editor and wait for it to render. */
export async function mount(page: Page, id: string, language: LanguageName, doc: string): Promise<void> {
  await page.evaluate(
    ([id, language, doc]) => window.rdfFixture.mount(id, language as LanguageName, doc),
    [id, language, doc] as const
  );
  await page.locator(`#${id} .cm-content`).waitFor();
}

export function tokens(page: Page, id: string): Promise<{ text: string; color: string }[]> {
  return page.evaluate((id) => window.rdfFixture.tokens(id), id);
}

export function tagOf(page: Page, id: string, token: string): Promise<string | null> {
  return page.evaluate(([id, token]) => window.rdfFixture.tagOf(id, token), [id, token] as const);
}

export function visibleText(page: Page, id: string): Promise<string> {
  return page.evaluate((id) => window.rdfFixture.visibleText(id), id);
}

export function lineCount(page: Page, id: string): Promise<number> {
  return page.evaluate((id) => window.rdfFixture.lineCount(id), id);
}

export function foldGutterMarkers(page: Page, id: string): Promise<number[]> {
  return page.evaluate((id) => window.rdfFixture.foldGutterMarkers(id), id);
}

export function foldAt(page: Page, id: string, line: number): Promise<boolean> {
  return page.evaluate(([id, line]) => window.rdfFixture.foldAt(id as string, line as number), [id, line] as const);
}

export function unfoldAll(page: Page, id: string): Promise<void> {
  return page.evaluate((id) => window.rdfFixture.unfoldAll(id), id);
}

export function setCursor(page: Page, id: string, pos: number): Promise<void> {
  return page.evaluate(([id, pos]) => window.rdfFixture.setCursor(id as string, pos as number), [id, pos] as const);
}

export function completions(page: Page, id: string): Promise<string[]> {
  return page.evaluate((id) => window.rdfFixture.completions(id), id);
}

export function docOf(page: Page, id: string): Promise<string> {
  return page.evaluate((id) => window.rdfFixture.docOf(id), id);
}
