export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export interface Relationship {
  constraint: string;
  from: { table: string; column: string };
  to: { table: string; column: string };
}

export interface Schema {
  tables: string[];
  columns: Record<string, Column[]>;
  relationships: Relationship[];
}
