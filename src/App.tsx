import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import { pullTodos } from './GetCanvasTodo';
import type { RootTodo, TodoItem } from './types';

type ViewMode = 'list' | 'calendar';

const App = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    pullTodos()
      .then((canvasTodos) => {
        const mapped: TodoItem[] = canvasTodos.map((todo: RootTodo) => ({
          id: todo.assignment.id,
          text: todo.assignment.name,
          due_at: todo.assignment.due_at ?? undefined,
          completed: false,
          created_at: todo.assignment.created_at,
        }));

        setTodos(mapped);
      })
      .catch((error: Error) => {
        console.error('Failed to load Canvas assignments', error);
      });
  }, []);

  const addTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTodo.trim()) return;

    const dueDateIso = newDueDate ? new Date(`${newDueDate}T12:00:00`).toISOString() : undefined;

    const todo: TodoItem = {
      id: Date.now(),
      text: newTodo.trim(),
      completed: false,
      created_at: new Date().toISOString(),
      due_at: dueDateIso,
    };

    setTodos((prev) => [todo, ...prev]);
    setNewTodo('');
    setNewDueDate('');
  };

  const toggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed: !todo.completed,
            }
          : todo,
      ),
    );
  };

  const deleteTodo = (id: number) => {
    setDeletingId(id);
    setTimeout(() => {
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
      setDeletingId(null);
    }, 300);
  };

  const toggleView = () => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  };

  const sliderStyle: CSSProperties = {
    width: 'calc(50% - 0.25rem)',
    transform: viewMode === 'calendar' ? 'translateX(100%)' : 'translateX(0)',
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#fefcff] p-4 md:p-8">
      <div
        className="animate-gradientMove absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
            radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-stretch">
        <header className="mb-10 text-center">
          <h1 className="mb-3 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 drop-shadow-lg animate-fadeDown">
            Kota&apos;s Planner
          </h1>
          <p className="text-sm text-pink-900/70">
            Toggle between a focused task list and a dreamy calendar overview to keep everything on track.
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <button
            type="button"
            onClick={toggleView}
            aria-pressed={viewMode === 'calendar'}
            className="relative flex w-full max-w-xs items-center justify-between rounded-full border border-white/30 bg-white/20 p-1 text-sm font-semibold text-pink-900/70 shadow-inner backdrop-blur"
          >
            <span
              className="absolute top-1 bottom-1 left-1 rounded-full bg-gradient-to-r from-pink-400/80 to-purple-400/80 shadow-lg transition-transform duration-300 ease-out"
              style={sliderStyle}
            />
            <span className={`relative z-10 flex-1 text-center ${viewMode === 'list' ? 'text-white' : ''}`}>List</span>
            <span className={`relative z-10 flex-1 text-center ${viewMode === 'calendar' ? 'text-white' : ''}`}>
              Calendar
            </span>
          </button>
        </div>

        {viewMode === 'list' ? (
          <TodoList
            todos={todos}
            newTodo={newTodo}
            newDueDate={newDueDate}
            deletingId={deletingId}
            onNewTodoChange={setNewTodo}
            onDueDateChange={setNewDueDate}
            onAddTodo={addTodo}
            onToggleTodo={toggleTodo}
            onDeleteTodo={deleteTodo}
          />
        ) : (
          <Calendar todos={todos} onToggleTodo={toggleTodo} />
        )}
      </div>
    </div>
  );
};

export default App;
