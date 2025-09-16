import type { FormEventHandler } from 'react';
import type { TodoItem } from '../types';

interface TodoListProps {
  todos: TodoItem[];
  newTodo: string;
  newDueDate: string;
  deletingId: number | null;
  onNewTodoChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onAddTodo: FormEventHandler<HTMLFormElement>;
  onToggleTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
}

const TodoList = ({
  todos,
  newTodo,
  newDueDate,
  deletingId,
  onNewTodoChange,
  onDueDateChange,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}: TodoListProps) => {
  const completedCount = todos.filter((todo) => todo.completed).length;

  const formatTodoDate = (todo: TodoItem) => {
    const rawDate = todo.due_at ?? todo.created_at;
    if (!rawDate) return 'No due date set';

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return 'No due date set';

    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="animate-fadeIn">
      <form onSubmit={onAddTodo} className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => onNewTodoChange(e.target.value)}
              placeholder="Add a new task..."
              aria-label="Task description"
              className="w-full rounded-xl border border-white/20 bg-white/10 p-3 text-pink-900/90 placeholder-pink-700/60 backdrop-blur-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              aria-label="Choose a due date"
              className="w-full rounded-xl border border-white/20 bg-white/10 p-3 text-pink-900/90 placeholder-pink-700/60 backdrop-blur-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 sm:max-w-[200px]"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-white/20 bg-pink-600/80 px-6 py-2 text-white shadow-lg backdrop-blur-lg transition-all duration-300 hover:border-white/30 hover:bg-pink-700/90 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95"
          >
            Add
          </button>
        </div>
      </form>

      {todos.length === 0 ? (
        <div className="animate-fadeIn rounded-2xl border border-white/20 bg-white/30 p-6 text-center text-pink-900/70 backdrop-blur-lg">
          No tasks yet — add something above to get started!
        </div>
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-start rounded-2xl border border-white/20 p-4 backdrop-blur-lg transition-all duration-300 ${
                deletingId === todo.id ? 'animate-fadeOut' : 'animate-fadeIn'
              } ${
                todo.completed
                  ? 'bg-green-100/40 text-green-900/90 hover:shadow-lg hover:shadow-green-500/10'
                  : 'bg-white/40 text-pink-900/90 hover:bg-white/60 hover:shadow-lg hover:shadow-pink-500/10'
              }`}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggleTodo(todo.id)}
                className="mt-1 h-5 w-5 rounded-full border-pink-200 text-pink-400 transition-transform duration-200 focus:ring-pink-300"
                aria-label={`Mark ${todo.text} as ${todo.completed ? 'incomplete' : 'complete'}`}
              />
              <div className="ml-3 flex-1">
                <p
                  className={`font-medium transition-all duration-300 ${
                    todo.completed ? 'line-through text-green-900/60 animate-completePulse' : ''
                  }`}
                >
                  {todo.text}
                </p>
                <p className="mt-1 text-xs text-pink-900/70">
                  {todo.due_at ? 'Due' : 'Added'} {formatTodoDate(todo)}
                </p>
              </div>
              <button
                onClick={() => onDeleteTodo(todo.id)}
                className="rounded-lg p-1 text-pink-700/70 transition-colors duration-200 hover:bg-pink-100/50 hover:text-pink-900"
                aria-label={`Delete ${todo.text}`}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {todos.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500 animate-fadeUp">
          {completedCount} of {todos.length} tasks completed
        </div>
      )}
    </div>
  );
};

export default TodoList;
