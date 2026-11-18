export type Page<T> = { states?: Record<string, number>; items: T[]; total: number; limit: number; offset: number };
export type ListFilter = { search?: string; status?: "all" | "active" | "inactive"; offset?: number };
