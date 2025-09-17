import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, FormEvent, JSX } from 'react';
import Calendar from './components/Calendar';
import TodoList from './components/TodoList';
import AgentPanel from './components/AgentPanel';
import type { ArchiveReason, PlannerStatePayload, TodoItem } from './types';
import { motion } from "framer-motion";

type ViewMode = 'list' | 'calendar' | 'agent';
type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'kota-planner-theme';

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const coerceStoredThemeMode = (value: string | null): ThemeMode | null => {
  if (!value) return null;
  if (isThemeMode(value)) return value;
  if (value === 'true') return 'dark';
  if (value === 'false') return 'light';
  return null;
};

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

const resolveIsDark = (mode: ThemeMode) => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return getSystemPrefersDark();
};

const getInitialThemeSettings = () => {
  if (typeof document !== 'undefined') {
    const { dataset } = document.documentElement;
    const datasetMode = dataset.themeMode;
    if (datasetMode && isThemeMode(datasetMode)) {
      const datasetTheme = dataset.theme === 'dark';
      return {
        mode: datasetMode,
        isDark: datasetMode === 'system' ? datasetTheme : datasetMode === 'dark',
      } as const;
    }
  }

  if (typeof window === 'undefined') {
    return { mode: 'system' as ThemeMode, isDark: false };
  }

  let storedMode: ThemeMode | null = null;
  try {
    storedMode = coerceStoredThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch (error) {
    console.error('Failed to read theme preference', error);
  }

  const mode = storedMode ?? ('system' as ThemeMode);
  return { mode, isDark: resolveIsDark(mode) } as const;
};

const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const schedule = (callback: () => void, delay: number) => {
  if (typeof window !== 'undefined') {
    window.setTimeout(callback, delay);
    return;
  }

  setTimeout(callback, delay);
};

const usePrefersDarkScheme = (initialValue: boolean) =>
  useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }

      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        onStoreChange();
      };

      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
        return () => {
          media.removeEventListener('change', listener);
        };
      }

      media.addListener(listener);
      return () => {
        media.removeListener(listener);
      };
    },
    () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return initialValue;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    () => initialValue,
  );

const todoListsEqual = (a: TodoItem[], b: TodoItem[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];

    if (
      left.id !== right.id ||
      left.text !== right.text ||
      left.due_at !== right.due_at ||
      left.created_at !== right.created_at ||
      left.completed !== right.completed ||
      left.origin !== right.origin ||
      left.external_id !== right.external_id ||
      left.scheduled_time !== right.scheduled_time ||
      left.archived_at !== right.archived_at ||
      left.archived_reason !== right.archived_reason
    ) {
      return false;
    }
  }

  return true;
};

const App = () => {
  const initialTheme = useMemo(() => getInitialThemeSettings(), []);
  const [activeTodos, setActiveTodos] = useState<TodoItem[]>([]);
  const [completedArchive, setCompletedArchive] = useState<TodoItem[]>([]);
  const [deletedArchive, setDeletedArchive] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme.mode);
  const [latestArchivedId, setLatestArchivedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasHydratedRef = useRef(false);
  const prefersDarkScheme = usePrefersDarkScheme(initialTheme.isDark);
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && prefersDarkScheme);

  const applyPlannerState = useCallback((state: PlannerStatePayload) => {
    const nextActive = state.active ?? [];
    const nextCompleted = state.archive?.completed ?? [];
    const nextDeleted = state.archive?.deleted ?? [];

    setActiveTodos((current) => (todoListsEqual(current, nextActive) ? current : nextActive));
    setCompletedArchive((current) => (todoListsEqual(current, nextCompleted) ? current : nextCompleted));
    setDeletedArchive((current) => (todoListsEqual(current, nextDeleted) ? current : nextDeleted));
  }, []);

  const loadPlannerState = useCallback(
    async (options?: { sync?: boolean }) => {
      const shouldMarkHydrated = Boolean(options?.sync && !hasHydratedRef.current);
      if (options?.sync) {
        if (hasHydratedRef.current) {
          return;
        }
        hasHydratedRef.current = true;
      }

      try {
        const query = options?.sync ? '?sync=true' : '';
        const response = await fetch(`/api/planner${query}`);
        if (!response.ok) {
          throw new Error(`Planner request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as PlannerStatePayload;
        applyPlannerState(payload);
      } catch (error) {
        if (shouldMarkHydrated) {
          hasHydratedRef.current = false;
        }
        throw error;
      }
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
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch (error) {
      console.error('Failed to persist theme preference', error);
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.themeMode = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.dataset.theme = isDarkMode ? 'dark' : 'light';
    root.style.colorScheme = isDarkMode ? 'dark' : 'light';
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

  const themeOptions: ThemeMode[] = ['light', 'dark', 'system'];
  const themeLabelClass = (mode: ThemeMode) =>
    themeMode === mode ? 'text-white drop-shadow' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';
  const themeTrackClasses = isDarkMode
    ? 'border-white/15 bg-white/10 text-indigo-100'
    : 'border-white/40 bg-white/60 text-pink-900/70';
  const renderThemeIcon = (mode: ThemeMode): JSX.Element => {
    if (mode === 'dark') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M21 12.79A9 9 0 0111.21 3a7 7 0 1010 9.79z" />
        </svg>
      );
    }
    if (mode === 'light') {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </svg>
      );
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v8.25a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V6.75z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6M12 17.25V21" />
      </svg>
    );
  };

  const thumbGradient = isDarkMode
    ? 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80'
    : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80';

  const trackClasses = isDarkMode
    ? 'border-white/10 bg-white/10 text-indigo-100'
    : 'border-white/30 bg-white/20 text-pink-900/70';
  const viewOptions: ViewMode[] = ['list', 'calendar', 'agent'];
  const activeIndex = viewOptions.indexOf(viewMode);
  const panelWidthPercent = 100 / viewOptions.length;
  const viewLabelClass = (mode: ViewMode) =>
    viewMode === mode ? 'text-white drop-shadow' : isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60';
  const contentRailStyle: CSSProperties = {
    width: `${viewOptions.length * 100}%`,
    transform: `translateX(-${activeIndex * panelWidthPercent}%)`,
  };
  const panelStyle: CSSProperties = {
    width: `${panelWidthPercent}%`,
  };

  const backgroundGradient = useMemo(
    () =>
      isDarkMode
        ? `
          radial-gradient(circle at 25% 65%, rgba(88, 28, 135, 0.55), transparent 58%),
          radial-gradient(circle at 70% 30%, rgba(37, 99, 235, 0.35), transparent 65%)`
        : `
          radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
          radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
    [isDarkMode],
  );

  const backgroundStyle = useMemo<CSSProperties>(
    () => ({
      backgroundImage: backgroundGradient,
    }),
    [backgroundGradient],
  );

  return (
    <div
      className={`relative w-full overflow-hidden transition-colors duration-500 ${
        isDarkMode ? 'bg-[#0b0314] text-indigo-50' : 'bg-[#fefcff] text-pink-900/80'
      } p-4 md:p-8`}
      aria-busy={isLoading}
    >
      <div className="absolute inset-0 z-0 animate-gradientMove" style={backgroundStyle} />

      <div className="flex relative z-10 flex-col items-stretch mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-6 mb-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
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
             Make a plan, work hard and get things done!
            </p>
          </div>

          <div className="flex gap-3 justify-center md:justify-end">
            <div
              className={`relative flex w-full max-w-sm overflow-hidden rounded-full border p-1 text-sm font-semibold shadow-inner backdrop-blur ${themeTrackClasses}`}
              role="radiogroup"
              aria-label="Theme mode"
            >
              {themeOptions.map((option) => {
                const isActive = themeMode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`relative flex-1 rounded-full px-3 py-2 transition-colors duration-300 ${themeLabelClass(option)}`}
                    onClick={() => setThemeMode(option)}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="theme-toggle-thumb"
                        className={`absolute inset-0 rounded-full shadow-lg ${thumbGradient}`}
                        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {renderThemeIcon(option)}
                      <span>{THEME_MODE_LABELS[option]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>
        <div className="flex justify-center mb-8">
          <div
            className={`relative flex w-full max-w-xl overflow-hidden rounded-full border p-1 text-sm font-semibold shadow-inner backdrop-blur ${trackClasses}`}
            role="tablist"
            aria-label="Planner view"
          >
            {viewOptions.map((option) => {
              const label = option === 'list' ? 'List' : option === 'calendar' ? 'Calendar' : 'Agent';
              const isActive = viewMode === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`relative flex-1 rounded-full px-4 py-2 transition-colors duration-300 ${viewLabelClass(option)}`}
                  onClick={() => setViewMode(option)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="view-toggle-thumb"
                      className={`absolute inset-0 rounded-full shadow-lg ${thumbGradient}`}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {label}
                    {option === 'agent' ? (
                      <span
                        className={`text-[10px] uppercase tracking-[0.2em] ${
                          isActive ? 'text-white/70' : isDarkMode ? 'text-indigo-100/50' : 'text-pink-900/40'
                        }`}
                      >
                        Beta
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-1 backdrop-blur-lg">
          <div
            className="flex transform-gpu transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={contentRailStyle}
          >
            <div
              className={`flex-shrink-0 p-4 sm:p-6 transform-gpu transition-all duration-500 ease-out ${
                viewMode === 'list'
                  ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
                  : 'pointer-events-none opacity-0 -translate-y-6 scale-95'
              }`}
              style={panelStyle}
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
              className={`flex-shrink-0 p-4 sm:p-6 transform-gpu transition-all duration-500 ease-out ${
                viewMode === 'calendar'
                  ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
                  : 'pointer-events-none opacity-0 translate-y-6 scale-95'
              }`}
              style={panelStyle}
            >
              <Calendar todos={sortedActiveTodos} onCompleteTodo={completeTodo} isDarkMode={isDarkMode} />
            </div>
            <div
              className={`flex-shrink-0 p-4 sm:p-6 transform-gpu transition-all duration-500 ease-out ${
                viewMode === 'agent'
                  ? 'pointer-events-auto opacity-100 translate-y-0 scale-100'
                  : 'pointer-events-none opacity-0 translate-y-6 scale-95'
              }`}
              style={panelStyle}
            >
              <AgentPanel
                isDarkMode={isDarkMode}
                activeTodos={sortedActiveTodos}
                completedTodos={completedArchive}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>

        <div className={`mt-6 text-center text-xs font-semibold uppercase tracking-[0.3em] ${ isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/60'}`}>
          {sortedActiveTodos.length === 0
            ? 'All clear — enjoy the calm!'
            : `${completedArchive.length} wins logged • ${deletedArchive.length} archived`}
        </div>
      </div>
    </div>
  );
};

export default App;
