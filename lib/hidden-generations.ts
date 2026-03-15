const STORAGE_KEY = 'sanhub_hidden_generations';

export function getHiddenGenerationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

export function addHiddenGenerationIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const hidden = getHiddenGenerationIds();
    ids.forEach(id => hidden.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
  } catch {
    // ignore storage errors
  }
}

export function isGenerationHidden(id: string): boolean {
  return getHiddenGenerationIds().has(id);
}
