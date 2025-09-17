import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import type { ArchiveReason, PlannerStatePayload, TodoItem } from './types';

type ViewMode = 'list' | 'calendar';

const DARK_MODE_STORAGE_KEY = 'kota-planner-dark-mode';

const schedule = (callback: () => void, delay: number) => {
  if (typeof window !== 'undefined') {
    window.setTimeout(callback, delay);
    return;
  }

  setTimeout(callback, delay);
};

const App = () => {
  const [activeTodos, setActiveTodos] = useState<TodoItem[]>([]);
  const [completedArchive, setCompletedArchive] = useState<TodoItem[]>([]);
  const [deletedArchive, setDeletedArchive] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [latestArchivedId, setLatestArchivedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyPlannerState = useCallback(
    (state: PlannerStatePayload) => {
      setActiveTodos(state.active ?? []);
      setCompletedArchive(state.archive?.completed ?? []);
      setDeletedArchive(state.archive?.deleted ?? []);
    },
    [],
  );

  const loadPlannerState = useCallback(
    async (options?: { sync?: boolean }) => {
      const query = options?.sync ? '?sync=true' : '';
      const response = await fetch(`/api/planner${query}`);
      if (!response.ok) {
        throw new Error(`Planner request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as PlannerStatePayload;
      applyPlannerState(payload);
    },
    [applyPlannerState],
  );

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        await loadPlannerState({ sync: true });
      } catch (error) {
        console.error('Failed to hydrate planner', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [loadPlannerState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
      if (stored !== null) {
        setIsDarkMode(stored === 'true');
      }
    } catch (error) {
      console.error('Failed to read dark mode preference', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, isDarkMode ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to persist dark mode preference', error);
    }
  }, [isDarkMode]);

  const sortedActiveTodos = useMemo(() => {
    const merged = [...activeTodos];

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
  }, [activeTodos]);

  const addTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newTodo.trim();
    if (!trimmed) return;

    const dueDate = newDueDate ? new Date(`${newDueDate}T${newDueTime || '12:00'}:00`) : null;
    const dueAt =
      dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null;
    const manualTime = newDueTime || null;

    try {
      const response = await fetch('/api/planner/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
          due_at: dueAt,
          scheduled_time: manualTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Manual task creation failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PlannerStatePayload;
      applyPlannerState(payload);
      setNewTodo('');
      setNewDueDate('');
      setNewDueTime('');
    } catch (error) {
      console.error('Failed to create manual task', error);
    }
  };

  const archiveWithAnimation = async (id: number, reason: ArchiveReason) => {
    const duration = reason === 'completed' ? 650 : 360;
    if (reason === 'completed') {
      setCompletingId(id);
    } else {
      setDeletingId(id);
    }

    try {
      const response = await fetch(`/api/planner/${id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error(`Archive request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PlannerStatePayload;

      schedule(() => {
        applyPlannerState(payload);
        if (reason === 'completed') {
          setCompletingId(null);
        } else {
          setDeletingId(null);
        }
      }, duration);

      setLatestArchivedId(id);
      schedule(() => {
        setLatestArchivedId((current) => (current === id ? null : current));
      }, 1600);
    } catch (error) {
      console.error('Failed to archive task', error);
      if (reason === 'completed') {
        setCompletingId(null);
      } else {
        setDeletingId(null);
      }
    }
  };

  const completeTodo = (id: number) => {
    void archiveWithAnimation(id, 'completed');
  };

  const deleteTodo = (id: number) => {
    void archiveWithAnimation(id, 'deleted');
  };

  const restoreTodo = async (todo: TodoItem) => {
    try {
      const response = await fetch(`/api/planner/${todo.id}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Restore request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PlannerStatePayload;
      applyPlannerState(payload);
      setLatestArchivedId((current) => (current === todo.id ? null : current));
    } catch (error) {
      console.error('Failed to restore task', error);
    }
  };

  const permanentlyDeleteTodo = async (todo: TodoItem) => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete "${todo.text}" forever? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/planner/${todo.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as PlannerStatePayload;
      applyPlannerState(payload);
      setLatestArchivedId((current) => (current === todo.id ? null : current));
    } catch (error) {
      console.error('Failed to remove task permanently', error);
    }
  };

  const toggleView = () => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const thumbGradient = isDarkMode
    ? 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80'
    : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80';

  const trackClasses = isDarkMode
    ? 'border-white/10 bg-white/10 text-indigo-100'
    : 'border-white/30 bg-white/20 text-pink-900/70';

  const listLabelClass = viewMode === 'list' ? 'text-white' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';
  const calendarLabelClass = viewMode === 'calendar' ? 'text-white' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';

  const sliderKnobClasses = `absolute inset-y-1 left-1 w-[calc(50%-0.5rem)] rounded-full shadow-lg transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${thumbGradient} transform-gpu ${
    viewMode === 'calendar' ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
  }`;

  const contentRailTransform: CSSProperties = {
    transform: viewMode === 'list' ? 'translateX(0%)' : 'translateX(-50%)',
  };

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
      aria-busy={isLoading}
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
            className={`relative flex w-full max-w-xs items-center justify-between rounded-full border p-1.5 text-sm font-semibold shadow-inner backdrop-blur ${trackClasses}`}
          >
            <span className={sliderKnobClasses} />
            <span className={`relative z-10 flex-1 text-center ${listLabelClass}`}>List</span>
            <span className={`relative z-10 flex-1 text-center ${calendarLabelClass}`}>Calendar</span>
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-1 backdrop-blur-lg">
          <div
            className="flex w-[200%] transform-gpu transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={contentRailTransform}
          >
            <div
              className={`w-1/2 flex-shrink-0 p-4 sm:p-6 transform-gpu transition-all duration-500 ease-out ${
                viewMode === 'list'
                  ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
                  : 'pointer-events-none opacity-0 -translate-y-6 scale-95'
              }`}
            >
              <TodoList
                todos={sortedActiveTodos}
                completedArchive={completedArchive}
                deletedArchive={deletedArchive}
                newTodo={newTodo}
                newDueDate={newDueDate}
                newDueTime={newDueTime}
                deletingId={deletingId}
                completingId={completingId}
                isDarkMode={isDarkMode}
                latestArchivedId={latestArchivedId}
                isLoading={isLoading}
                onNewTodoChange={setNewTodo}
                onDueDateChange={setNewDueDate}
                onDueTimeChange={setNewDueTime}
                onAddTodo={addTodo}
                onCompleteTodo={completeTodo}
                onDeleteTodo={deleteTodo}
                onRestoreTodo={restoreTodo}
                onPermanentDelete={permanentlyDeleteTodo}
              />
            </div>
            <div
              className={`w-1/2 flex-shrink-0 p-4 sm:p-6 transform-gpu transition-all duration-500 ease-out ${
                viewMode === 'calendar'
                  ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
                  : 'pointer-events-none opacity-0 translate-y-6 scale-95'
              }`}
            >
              <Calendar todos={sortedActiveTodos} onCompleteTodo={completeTodo} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
          {sortedActiveTodos.length === 0
            ? 'All clear — enjoy the calm!'
            : `${completedArchive.length} wins logged • ${completedArchive.length + deletedArchive.length} archived`}
        </div>
      </div>
    </div>
  );
};

export default App;
