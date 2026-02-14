export interface ImportGraph {
  importsOf(filePath: string): readonly string[];
  importersOf(filePath: string): readonly string[];
  areConnected(fileA: string, fileB: string, maxHops?: number): boolean;
}

export class InMemoryImportGraph implements ImportGraph {
  private imports = new Map<string, readonly string[]>();
  private importers = new Map<string, Set<string>>();

  addEdge(fromFile: string, toFile: string): void {
    const existing = this.imports.get(fromFile);
    if (existing) {
      (existing as string[]).push(toFile);
    } else {
      this.imports.set(fromFile, [toFile]);
    }

    let rev = this.importers.get(toFile);
    if (!rev) {
      rev = new Set();
      this.importers.set(toFile, rev);
    }
    rev.add(fromFile);
  }

  freeze(): void {
    for (const [key, value] of this.imports) {
      this.imports.set(key, Object.freeze([...value]));
    }
  }

  importsOf(filePath: string): readonly string[] {
    return this.imports.get(filePath) ?? [];
  }

  importersOf(filePath: string): readonly string[] {
    const set = this.importers.get(filePath);
    return set ? [...set] : [];
  }

  areConnected(fileA: string, fileB: string, maxHops = 2): boolean {
    if (fileA === fileB) return true;

    const visited = new Set<string>();
    let frontier = [fileA];
    visited.add(fileA);

    for (let hop = 0; hop < maxHops; hop++) {
      const next: string[] = [];
      for (const file of frontier) {
        for (const imported of this.importsOf(file)) {
          if (imported === fileB) return true;
          if (!visited.has(imported)) {
            visited.add(imported);
            next.push(imported);
          }
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    return false;
  }
}
