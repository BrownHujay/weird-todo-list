import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import { pullTodos } from './GetCanvasTodo';
import type { ArchiveReason, RootTodo, TodoItem } from './types';

type ViewMode = 'list' | 'calendar';

type StoredPlannerState = {
  manualTodos: TodoItem[];
  archivedTodos: TodoItem[];
  archivedCanvasIds: number[];
  darkMode?: boolean;
};

const STORAGE_KEY = 'kota-planner-state-v2';

const schedule = (callback: () => void, delay: number) => {
  if (typeof window !== 'undefined') {
    window.setTimeout(callback, delay);
    return;
  }

  setTimeout(callback, delay);
};

const App = () => {
  const [manualTodos, setManualTodos] = useState<TodoItem[]>([]);
  const [canvasTodos, setCanvasTodos] = useState<TodoItem[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<TodoItem[]>([]);
  const [archivedCanvasIds, setArchivedCanvasIds] = useState<number[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (storedRaw) {
        const stored = JSON.parse(storedRaw) as StoredPlannerState;
        setManualTodos(stored.manualTodos ?? []);
        setArchivedTodos(stored.archivedTodos ?? []);
        setArchivedCanvasIds(stored.archivedCanvasIds ?? []);
        if (typeof stored.darkMode === 'boolean') {
          setIsDarkMode(stored.darkMode);
        }
      }
    } catch (error) {
      console.error('Failed to restore planner state', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    pullTodos()
      .then((canvasItems) => {
        const mapped: TodoItem[] = canvasItems
          .filter((todo: RootTodo) => !archivedCanvasIds.includes(todo.assignment.id))
          .map((todo: RootTodo) => {
            const dueAt = todo.assignment.due_at ?? undefined;
            const dueDate = dueAt ? new Date(dueAt) : null;
            const scheduledTime =
              dueDate && !Number.isNaN(dueDate.getTime())
                ? `${dueDate.getHours().toString().padStart(2, '0')}:${dueDate
                    .getMinutes()
                    .toString()
                    .padStart(2, '0')}`
                : null;

            return {
              id: todo.assignment.id,
              text: todo.assignment.name,
              due_at: dueAt,
              completed: false,
              created_at: todo.assignment.created_at,
              origin: 'canvas',
              scheduled_time: scheduledTime,
            } satisfies TodoItem;
          });

        setCanvasTodos(mapped);
      })
      .catch((error: Error) => {
        console.error('Failed to load Canvas assignments', error);
      });
  }, [archivedCanvasIds, isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    const state: StoredPlannerState = {
      manualTodos,
      archivedTodos,
      archivedCanvasIds,
      darkMode: isDarkMode,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist planner state', error);
    }
  }, [manualTodos, archivedTodos, archivedCanvasIds, isDarkMode, isHydrated]);

  const activeTodos = useMemo(() => {
    const merged = [...canvasTodos, ...manualTodos];

    return merged.sort((a, b) => {
      const getTime = (todo: TodoItem) => {
        if (todo.due_at) {
          const parsed = new Date(todo.due_at);
          if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
        }
        if (todo.created_at) {
          const created = new Date(todo.created_at);
          if (!Number.isNaN(created.getTime())) return created.getTime();
        }
        return Number.MAX_SAFE_INTEGER;
      };

      return getTime(a) - getTime(b);
    });
  }, [canvasTodos, manualTodos]);

  const addTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newTodo.trim();
    if (!trimmed) return;

    const dueDate = newDueDate ? new Date(`${newDueDate}T${newDueTime || '12:00'}:00`) : null;
    const dueAt = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : undefined;
    const manualTime = newDueTime || null;

    const todo: TodoItem = {
      id: Date.now(),
      text: trimmed,
      completed: false,
      created_at: new Date().toISOString(),
      due_at: dueAt,
      origin: 'manual',
      scheduled_time: manualTime,
    };

    setManualTodos((prev) => [todo, ...prev]);
    setNewTodo('');
    setNewDueDate('');
    setNewDueTime('');
  };

  const archiveTodo = (todo: TodoItem, reason: ArchiveReason) => {
    const archived: TodoItem = {
      ...todo,
      completed: reason === 'completed' ? true : todo.completed,
      archived_at: new Date().toISOString(),
      archived_reason: reason,
    };

    setArchivedTodos((prev) => {
      const filtered = prev.filter((item) => item.id !== archived.id);
      return [archived, ...filtered];
    });

    if (archived.origin === 'canvas') {
      setArchivedCanvasIds((prev) => (prev.includes(archived.id) ? prev : [...prev, archived.id]));
    }
  };

  const completeTodo = (id: number) => {
    setCompletingId(id);

    setManualTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: true } : todo)));
    setCanvasTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, completed: true } : todo)));

    schedule(() => {
      let archivedItem: TodoItem | undefined;

      setManualTodos((prev) => {
        const found = prev.find((todo) => todo.id === id);
        if (!found) return prev;
        archivedItem = { ...found, completed: true };
        return prev.filter((todo) => todo.id !== id);
      });

      setCanvasTodos((prev) => {
        if (archivedItem) return prev;
        const found = prev.find((todo) => todo.id === id);
        if (!found) return prev;
        archivedItem = { ...found, completed: true };
        return prev.filter((todo) => todo.id !== id);
      });

      if (archivedItem) {
        archiveTodo(archivedItem, 'completed');
      }

      setCompletingId(null);
    }, 650);
  };

  const deleteTodo = (id: number) => {
    setDeletingId(id);

    schedule(() => {
      let archivedItem: TodoItem | undefined;

      setManualTodos((prev) => {
        const found = prev.find((todo) => todo.id === id);
        if (!found) return prev;
        archivedItem = { ...found };
        return prev.filter((todo) => todo.id !== id);
      });

      setCanvasTodos((prev) => {
        if (archivedItem) return prev;
        const found = prev.find((todo) => todo.id === id);
        if (!found) return prev;
        archivedItem = { ...found };
        return prev.filter((todo) => todo.id !== id);
      });

      if (archivedItem) {
        archiveTodo(archivedItem, 'deleted');
      }

      setDeletingId(null);
    }, 320);
  };

  const restoreTodo = (todo: TodoItem) => {
    const restored: TodoItem = {
      ...todo,
      completed: false,
      archived_at: null,
      archived_reason: undefined,
    };

    if (restored.origin === 'canvas') {
      setCanvasTodos((prev) => {
        if (prev.some((item) => item.id === restored.id)) return prev;
        const scheduledTime =
          restored.scheduled_time ??
          (restored.due_at
            ? (() => {
                const parsed = new Date(restored.due_at as string);
                if (Number.isNaN(parsed.getTime())) return null;
                return `${parsed.getHours().toString().padStart(2, '0')}:${parsed
                  .getMinutes()
                  .toString()
                  .padStart(2, '0')}`;
              })()
            : null);

        return [
          {
            ...restored,
            scheduled_time: scheduledTime,
          },
          ...prev,
        ];
      });

      setArchivedCanvasIds((prev) => prev.filter((storedId) => storedId !== restored.id));
    } else {
      setManualTodos((prev) => [restored, ...prev]);
    }

    setArchivedTodos((prev) => prev.filter((item) => item.id !== todo.id));
  };

  const toggleView = () => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const sliderStyle: CSSProperties = {
    width: 'calc(50% - 0.25rem)',
    transform: viewMode === 'calendar' ? 'translateX(100%)' : 'translateX(0)',
  };

  const thumbGradient = isDarkMode
    ? 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80'
    : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80';

  const trackClasses = isDarkMode
    ? 'border-white/10 bg-white/10 text-indigo-100'
    : 'border-white/30 bg-white/20 text-pink-900/70';

  const listLabelClass = viewMode === 'list' ? 'text-white' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';
  const calendarLabelClass = viewMode === 'calendar' ? 'text-white' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';

  const backgroundStyle: CSSProperties = isDarkMode
    ? {
        backgroundImage: `
          radial-gradient(circle at 25% 65%, rgba(88, 28, 135, 0.55), transparent 58%),
          radial-gradient(circle at 70% 30%, rgba(37, 99, 235, 0.35), transparent 65%)`,
      }
    : {
        backgroundImage: `
          radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
          radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
      };

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden ${
        isDarkMode ? 'bg-[#0b0314] text-indigo-50' : 'bg-[#fefcff] text-pink-900/80'
      } p-4 md:p-8`}
    >
      <div className="animate-gradientMove absolute inset-0 z-0" style={backgroundStyle} />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-stretch">
        <header className="mb-8 flex flex-col gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div>
            <h1
              className={`mb-3 text-4xl font-bold text-transparent bg-clip-text drop-shadow-lg animate-fadeDown ${
                isDarkMode ? 'bg-gradient-to-r from-purple-200 via-violet-200 to-indigo-200' : 'bg-gradient-to-r from-pink-300 to-purple-300'
              }`}
            >
              Kota&apos;s Planner
            </h1>
            <p
              className={`max-w-xl text-sm ${
                isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/70'
              }`}
            >
              Toggle between a focused task list and a dreamy calendar overview to keep everything on track — now with
              day, week, and month focus modes.
            </p>
          </div>

          <div className="flex justify-center gap-3 md:justify-end">
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-md backdrop-blur ${
                isDarkMode
                  ? 'border-white/15 bg-white/10 text-indigo-100 hover:bg-white/20'
                  : 'border-white/40 bg-white/60 text-pink-900/70 hover:bg-white/80'
              }`}
              aria-pressed={isDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M21 12.79A9 9 0 0111.21 3a7 7 0 1010 9.79z" />
                  </svg>
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                    />
                  </svg>
                  <span>Light</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div className="mb-8 flex justify-center">
          <button
            type="button"
            onClick={toggleView}
            aria-pressed={viewMode === 'calendar'}
            className={`relative flex w-full max-w-xs items-center justify-between rounded-full border p-1 text-sm font-semibold shadow-inner backdrop-blur ${trackClasses}`}
          >
            <span
              className={`absolute top-1 bottom-1 left-1 rounded-full shadow-lg transition-transform duration-300 ease-out ${thumbGradient}`}
              style={sliderStyle}
            />
            <span className={`relative z-10 flex-1 text-center ${listLabelClass}`}>List</span>
            <span className={`relative z-10 flex-1 text-center ${calendarLabelClass}`}>Calendar</span>
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-1 backdrop-blur-lg">
          <div
            className="flex w-[200%] transition-transform duration-700 ease-in-out"
            style={{ transform: viewMode === 'list' ? 'translateX(0%)' : 'translateX(-50%)' }}
          >
            <div className="w-1/2 flex-shrink-0 p-4 sm:p-6">
              <TodoList
                todos={activeTodos}
                archivedTodos={archivedTodos}
                newTodo={newTodo}
                newDueDate={newDueDate}
                newDueTime={newDueTime}
                deletingId={deletingId}
                completingId={completingId}
                isDarkMode={isDarkMode}
                onNewTodoChange={setNewTodo}
                onDueDateChange={setNewDueDate}
                onDueTimeChange={setNewDueTime}
                onAddTodo={addTodo}
                onCompleteTodo={completeTodo}
                onDeleteTodo={deleteTodo}
                onRestoreTodo={restoreTodo}
              />
            </div>
            <div className="w-1/2 flex-shrink-0 p-4 sm:p-6">
              <Calendar todos={activeTodos} onCompleteTodo={completeTodo} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
          {activeTodos.length === 0
            ? 'All clear — enjoy the calm!'
            : `${archivedTodos.filter((todo) => todo.archived_reason === 'completed').length} wins logged • ${
                archivedTodos.length
              } archived`}
        </div>
      </div>
    </div>
  );
};

export default App;
