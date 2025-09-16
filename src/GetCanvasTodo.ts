import type { Todo } from "./types";


export async function pullTodos(): Promise<Todo> {
  const res = await fetch("http://localhost:3001/api/todos");

  if (!res.ok) {
    throw new Error(`Failed to fetch todos: ${res.status} ${res.statusText}`);
  }

  return res.json();
}