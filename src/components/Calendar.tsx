import { useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '../types';

interface CalendarProps {
  todos: TodoItem[];
  onCompleteTodo: (id: number) => void;
  isDarkMode: boolean;
}

type CalendarView = 'day' | 'week' | 'month';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const diff = result.getDay();
  result.setDate(result.getDate() - diff);
  return result;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const getTodoDueDate = (todo: TodoItem): Date | null => {
  if (!todo.due_at) return null;
  const parsed = new Date(todo.due_at);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatTimeForTodo = (todo: TodoItem) => {
  if (todo.scheduled_time) {
    const [hoursStr, minutesStr] = todo.scheduled_time.split(':');
    const hours = Number.parseInt(hoursStr ?? '', 10);
    const minutes = Number.parseInt(minutesStr ?? '', 10);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      const display = new Date();
      display.setHours(hours, minutes, 0, 0);
      return display.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }

  const due = getTodoDueDate(todo);
  if (!due) return null;
  return due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const Calendar = ({ todos, onCompleteTodo, isDarkMode }: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewScope, setViewScope] = useState<CalendarView>('month');

  useEffect(() => {
    if (viewScope === 'month') {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [selectedDate, viewScope]);

  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(currentMonth);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const leadingDays = firstDay.getDay();
    const trailingDays = 6 - lastDay.getDay();
    const totalCells = leadingDays + lastDay.getDate() + trailingDays;

    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - leadingDays);

    const days: Date[] = [];
    for (let i = 0; i < totalCells; i += 1) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentMonth]);

  const todosByDay = useMemo(() => {
    const grouped: Record<string, TodoItem[]> = {};

    todos.forEach((todo) => {
      const date = getTodoDueDate(todo);
      if (!date) return;
      const key = toDateKey(date);
      grouped[key] = [...(grouped[key] ?? []), todo];
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const dateA = getTodoDueDate(a)?.getTime() ?? 0;
        const dateB = getTodoDueDate(b)?.getTime() ?? 0;
        if (dateA !== dateB) return dateA - dateB;
        if (a.scheduled_time && b.scheduled_time && a.scheduled_time !== b.scheduled_time) {
          return a.scheduled_time.localeCompare(b.scheduled_time);
        }
        return a.text.localeCompare(b.text);
      });
    });

    return grouped;
  }, [todos]);

  const undatedTodos = useMemo(
    () =>
      todos.filter(
        (todo) => !todo.due_at || Number.isNaN(new Date(todo.due_at).getTime()),
      ),
    [todos],
  );

  const today = new Date();
  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [selectedDate]);

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const dayLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const goToPrevious = () => {
    if (viewScope === 'month') {
      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() - 1);
        return next;
      });
      return;
    }

    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - (viewScope === 'week' ? 7 : 1));
      setCurrentMonth(startOfMonth(next));
      return next;
    });
  };

  const goToNext = () => {
    if (viewScope === 'month') {
      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + 1);
        return next;
      });
      return;
    }

    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + (viewScope === 'week' ? 7 : 1));
      setCurrentMonth(startOfMonth(next));
      return next;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setCurrentMonth(startOfMonth(now));
  };

  const dayTasks = useMemo(() => {
    const key = toDateKey(selectedDate);
    return todosByDay[key] ?? [];
  }, [selectedDate, todosByDay]);

  const viewBadge = viewScope === 'month' ? monthLabel : viewScope === 'week' ? `Week of ${weekLabel}` : dayLabel;

  const badgeClasses = isDarkMode
    ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-100'
    : 'bg-gradient-to-r from-pink-300/40 to-purple-300/40 text-pink-900/80';

  const segmentButtonClasses = (scope: CalendarView) => {
    const isActive = viewScope === scope;
    if (isDarkMode) {
      return `flex-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
        isActive
          ? 'bg-indigo-500/80 text-white shadow-lg'
          : 'text-indigo-100/60 hover:bg-indigo-500/20'
      }`;
    }

    return `flex-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
      isActive
        ? 'bg-pink-500/80 text-white shadow-lg'
        : 'text-pink-900/60 hover:bg-pink-500/20'
    }`;
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div
        className={`rounded-3xl border p-6 shadow-xl backdrop-blur-xl transition-colors ${
          isDarkMode ? 'border-white/10 bg-white/5 text-indigo-50' : 'border-white/30 bg-white/60 text-pink-900/80'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={`text-xs uppercase tracking-[0.4em] ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/60'}`}>
              Planner overview
            </p>
            <h2 className={`mt-2 text-3xl font-semibold text-transparent bg-clip-text ${
              isDarkMode ? 'bg-gradient-to-r from-purple-200 via-indigo-200 to-slate-100' : 'bg-gradient-to-r from-pink-400 to-purple-400'
            }`}
            >
              {viewBadge}
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClasses}`}>
              Focus: {viewScope.toUpperCase()}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPrevious}
                className={`rounded-full border p-2 transition ${
                  isDarkMode
                    ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-white/20'
                    : 'border-white/30 bg-white/40 text-pink-700/80 hover:bg-white/70'
                }`}
                aria-label="Previous"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={goToToday}
                className={`rounded-full border px-4 py-2 text-xs font-semibold shadow-md transition ${
                  isDarkMode
                    ? 'border-white/15 bg-indigo-500/40 text-white hover:bg-indigo-500/60'
                    : 'border-white/40 bg-gradient-to-r from-pink-300/70 to-purple-300/70 text-white hover:shadow-lg hover:shadow-pink-500/20'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={goToNext}
                className={`rounded-full border p-2 transition ${
                  isDarkMode
                    ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-white/20'
                    : 'border-white/30 bg-white/40 text-pink-700/80 hover:bg-white/70'
                }`}
                aria-label="Next"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className={`flex items-center gap-2 rounded-full border px-1 py-1 ${
              isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/40 bg-white/60'
            }`}
            >
              {(['day', 'week', 'month'] as CalendarView[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setViewScope(scope)}
                  className={segmentButtonClasses(scope)}
                  aria-pressed={viewScope === scope}
                >
                  {scope.charAt(0).toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {viewScope === 'month' && (
          <div className="mt-6 space-y-4">
            <div
              className={`grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide ${
                isDarkMode ? 'text-indigo-100/70' : 'text-pink-600/80'
              }`}
            >
              {dayNames.map((day) => (
                <div key={day} className={`rounded-xl py-2 backdrop-blur ${isDarkMode ? 'bg-white/10' : 'bg-white/40'}`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((date) => {
                const key = toDateKey(date);
                const items = todosByDay[key] ?? [];
                const isCurrentMonth =
                  date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
                const isToday = sameDay(date, today);
                const isSelected = sameDay(date, selectedDate);

                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedDate(date)}
                    className={`flex min-h-[120px] flex-col rounded-2xl border p-3 text-left transition-all duration-300 ${
                      isCurrentMonth
                        ? isDarkMode
                          ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-white/20'
                          : 'border-white/30 bg-white/70 text-pink-900/80 hover:shadow-lg hover:shadow-pink-500/10'
                        : isDarkMode
                        ? 'border-white/5 bg-white/5 text-indigo-200/40'
                        : 'border-white/15 bg-white/30 text-pink-900/40'
                    } ${isToday ? (isDarkMode ? 'ring-2 ring-indigo-400/70' : 'ring-2 ring-pink-300/70') : ''} ${
                      isSelected ? (isDarkMode ? 'outline outline-1 outline-indigo-200/60' : 'outline outline-1 outline-pink-400/60') : ''
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className={`font-semibold ${isCurrentMonth ? '' : 'opacity-60'}`}>{date.getDate()}</span>
                      {items.length > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isDarkMode ? 'bg-indigo-500/30 text-indigo-100' : 'bg-pink-500/20 text-pink-700/80'
                          }`}
                        >
                          {items.length} {items.length === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {items.length === 0 ? (
                        <div className={`flex h-full items-center justify-center text-[11px] ${
                          isDarkMode ? 'text-indigo-100/30' : 'text-pink-900/30'
                        }`}
                        >
                          {isCurrentMonth ? 'No tasks' : ''}
                        </div>
                      ) : (
                        items.slice(0, 3).map((todo) => (
                          <div
                            key={todo.id}
                            className={`w-full truncate rounded-xl border px-2 py-1 text-left text-xs font-medium shadow-sm ${
                              isDarkMode
                                ? 'border-white/10 bg-white/10 text-indigo-100'
                                : 'border-white/40 bg-white/80 text-pink-900/90'
                            } ${todo.completed ? 'line-through opacity-70' : ''}`}
                          >
                            {todo.text}
                          </div>
                        ))
                      )}
                    </div>
                    {items.length > 3 && (
                      <span className={`mt-2 text-[10px] italic ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/50'}`}>
                        +{items.length - 3} more
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewScope === 'week' && (
          <div className="mt-6 space-y-4">
            <p className={`text-xs uppercase tracking-[0.4em] ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/60'}`}>
              {weekLabel}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {weekDays.map((date) => {
                const key = toDateKey(date);
                const items = todosByDay[key] ?? [];
                const isSelected = sameDay(date, selectedDate);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`flex h-full flex-col justify-between rounded-2xl border p-4 text-left transition ${
                      isDarkMode
                        ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-white/20'
                        : 'border-white/20 bg-white/70 text-pink-900/80 hover:shadow-lg hover:shadow-pink-500/10'
                    } ${isSelected ? (isDarkMode ? 'ring-2 ring-indigo-400/70' : 'ring-2 ring-pink-300/70') : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em]">{dayNames[date.getDay()]}</p>
                        <p className="text-lg font-semibold">{date.getDate()}</p>
                      </div>
                      {items.length > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isDarkMode ? 'bg-indigo-500/30 text-indigo-100' : 'bg-pink-500/20 text-pink-700/80'
                        }`}
                        >
                          {items.length} {items.length === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      {items.length === 0 ? (
                        <p className={`text-sm italic ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/60'}`}>
                          Empty space – perfect for a break.
                        </p>
                      ) : (
                        items.map((todo) => (
                          <button
                            key={todo.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onCompleteTodo(todo.id);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                              isDarkMode
                                ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-indigo-500/20'
                                : 'border-white/30 bg-white/80 text-pink-900/90 hover:bg-white'
                            } ${todo.completed ? 'line-through opacity-70' : ''}`}
                          >
                            <span className="truncate">{todo.text}</span>
                            {formatTimeForTodo(todo) && (
                              <span className={`ml-2 whitespace-nowrap text-[10px] uppercase ${
                                isDarkMode ? 'text-indigo-200/80' : 'text-pink-900/60'
                              }`}
                              >
                                {formatTimeForTodo(todo)}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {viewScope === 'day' && (
          <div className="mt-6 space-y-4">
            <p className={`text-xs uppercase tracking-[0.4em] ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/60'}`}>
              {dayLabel}
            </p>
            <div className={`rounded-2xl border p-5 ${
              isDarkMode ? 'border-white/10 bg-white/10 text-indigo-100' : 'border-white/20 bg-white/70 text-pink-900/80'
            }`}
            >
              {dayTasks.length === 0 ? (
                <p className={`text-sm italic ${isDarkMode ? 'text-indigo-200/60' : 'text-pink-900/60'}`}>
                  No scheduled tasks — take a deep breath.
                </p>
              ) : (
                <div className="space-y-3">
                  {dayTasks.map((todo) => (
                    <button
                      key={todo.id}
                      type="button"
                      onClick={() => onCompleteTodo(todo.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isDarkMode
                          ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-indigo-500/20'
                          : 'border-white/30 bg-white/80 text-pink-900/90 hover:bg-white'
                      } ${todo.completed ? 'line-through opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{todo.text}</p>
                          <p className={`mt-1 text-xs ${isDarkMode ? 'text-indigo-200/70' : 'text-pink-900/60'}`}>
                            {todo.due_at
                              ? new Date(todo.due_at).toLocaleString(undefined, {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'No due date'}
                          </p>
                        </div>
                        {formatTimeForTodo(todo) && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            isDarkMode ? 'bg-indigo-500/30 text-indigo-100' : 'bg-pink-500/20 text-pink-700/80'
                          }`}
                          >
                            {formatTimeForTodo(todo)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {undatedTodos.length > 0 && (
        <div
          className={`rounded-3xl border p-5 backdrop-blur-lg ${
            isDarkMode ? 'border-white/10 bg-white/10 text-indigo-100' : 'border-white/20 bg-white/40 text-pink-900/80'
          }`}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide">No due date</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {undatedTodos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => onCompleteTodo(todo.id)}
                className={`rounded-full border px-3 py-1 text-sm shadow-sm transition-all duration-200 ${
                  isDarkMode
                    ? 'border-white/10 bg-white/10 text-indigo-100 hover:bg-indigo-500/20'
                    : 'border-white/30 bg-white/60 text-pink-900/80 hover:border-white/50 hover:bg-white/80'
                } ${todo.completed ? 'line-through opacity-70' : ''}`}
              >
                {todo.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
