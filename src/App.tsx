import { useState, useEffect } from 'react';
import { pullTodos } from './GetCanvasTodo';

function App() {
  const [todos, setTodos] = useState<any[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load Canvas assignments
  useEffect(() => {
    pullTodos()
      .then((canvasTodos) => {
        const mapped = canvasTodos.map((t: any) => ({
          id: t.assignment.id,
          text: t.assignment.name,
          due_at: t.assignment.due_at,
          completed: false,
        }));
        setTodos(mapped);
      })
      .catch((err: Error) => console.error(err));
  }, []);

  // Add your own task
  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    const todo = {
      id: Date.now(),
      text: newTodo,
      completed: false,
      created_at: new Date().toISOString(),
    };

    setTodos([todo, ...todos]);
    setNewTodo('');
  };

  const toggleTodo = (id: number) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: number) => {
    setDeletingId(id);
    setTimeout(() => {
      setTodos(todos.filter((todo) => todo.id !== id));
      setDeletingId(null);
    }, 300);
  };

  return (
    <div className="min-h-screen w-full bg-[#fefcff] relative p-4 md:p-8 overflow-hidden">
      <div
        className="absolute inset-0 z-0 animate-gradientMove"
        style={{
          backgroundImage: `
            radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
            radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />
      <div className="relative z-10 mx-auto max-w-2xl">
        <h1 className="mb-8 text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 drop-shadow-lg animate-fadeDown">
          Kota's ToDo List
        </h1>

        {/* Add Todo Form */}
        <form onSubmit={addTodo} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 p-3 rounded-xl border backdrop-blur-lg transition-all duration-300 border-white/20 bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 text-pink-900/90 placeholder-pink-700/60"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-pink-600/80 hover:bg-pink-700/90 text-white rounded-xl backdrop-blur-lg border border-white/20 hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95"
            >
              Add
            </button>
          </div>
        </form>

        {/* Todo List */}
        <div className="space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`p-4 rounded-2xl backdrop-blur-lg transition-all duration-300 flex items-start border border-white/20
                ${deletingId === todo.id ? 'animate-fadeOut' : 'animate-fadeIn'}
                ${todo.completed
                  ? 'bg-green-100/30 hover:shadow-lg hover:shadow-green-500/10 text-green-900/90'
                  : 'bg-white/30 hover:bg-white/40 hover:shadow-lg hover:shadow-pink-500/10 text-pink-900/90'}
              `}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="mt-1 w-5 h-5 text-pink-400 rounded-full border-pink-200 transition-transform duration-200 focus:ring-pink-300"
              />
              <div className="flex-1 ml-3">
                <p
                  className={`transition-all duration-300 ${
                    todo.completed
                      ? 'line-through text-green-900/60 animate-completePulse'
                      : ''
                  }`}
                >
                  {todo.text}
                </p>
                <p className="mt-1 text-xs text-pink-900/70">
                  {new Date(todo.due_at || todo.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="p-1 rounded-lg transition-colors duration-200 text-pink-700/70 hover:text-pink-900 hover:bg-pink-100/50"
                aria-label="Delete todo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
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

        {/* Stats */}
        {todos.length > 0 && (
          <div className="mt-6 text-sm text-center text-gray-500 animate-fadeUp">
            {todos.filter((t) => t.completed).length} of {todos.length} tasks completed
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
