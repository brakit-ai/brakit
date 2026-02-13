export type FileRole =
  | "api-route"
  | "page"
  | "layout"
  | "middleware"
  | "server-action"
  | "client-component"
  | "server-component"
  | "db-query"
  | "db-schema"
  | "auth-config"
  | "component"
  | "utility"
  | "config"
  | "test"
  | "unknown";

export interface FileAnalysis {
  filePath: string;
  // A file can have multiple roles (e.g., api-route + db-query).
  roles: FileRole[];
  classifiedBy: string[];
  ast: ASTSummary;
}

export interface ASTSummary {
  exports: ExportInfo[];
  imports: ImportInfo[];
  functions: FunctionInfo[];
  // Top-level directives: 'use server', 'use client', etc.
  directives: string[];
}

export interface FunctionInfo {
  name: string | null;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  line: number;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  line: number;
}

export interface ExportInfo {
  name: string;
  isDefault: boolean;
  kind: "function" | "variable" | "class" | "type" | "unknown";
  line: number;
}
