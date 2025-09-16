import { useMemo, useState } from 'react';
import type { TodoItem } from '../types';

interface CalendarProps {
  todos: TodoItem[];
  onToggleTodo: (id: number) => void;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getTodoDueDate = (todo: TodoItem): Date | null => {
  if (!todo.due_at) return null;
  const parsed = new Date(todo.due_at);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const Calendar = ({ todos, onToggleTodo }: CalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

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
        return a.text.localeCompare(b.text);
      });
    });

    return grouped;
  }, [todos]);

  const undatedTodos = useMemo(
    () => todos.filter((todo) => !todo.due_at || Number.isNaN(new Date(todo.due_at).getTime())),
    [todos],
  );

  const today = new Date();
  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="rounded-3xl border border-white/30 bg-white/40 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-pink-900/60">Monthly Overview</p>
            <h2 className="text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 drop-shadow-sm">
              {monthLabel}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="rounded-full border border-white/30 bg-white/40 p-2 text-pink-700/80 transition-all duration-200 hover:bg-white/70 hover:text-pink-900"
              aria-label="Previous month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="rounded-full border border-white/40 bg-gradient-to-r from-pink-300/70 to-purple-300/70 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:shadow-pink-500/20"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-full border border-white/30 bg-white/40 p-2 text-pink-700/80 transition-all duration-200 hover:bg-white/70 hover:text-pink-900"
              aria-label="Next month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-pink-600/80">
          {dayNames.map((day) => (
            <div key={day} className="rounded-xl bg-white/40 py-2 backdrop-blur">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {calendarDays.map((date) => {
            const key = toDateKey(date);
            const items = todosByDay[key] ?? [];
            const isCurrentMonth =
              date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
            const isToday = sameDay(date, today);

            return (
              <div
                key={key}
                className={`flex min-h-[120px] flex-col rounded-2xl border p-3 transition-all duration-300 ${
                  isCurrentMonth
                    ? 'bg-white/60 text-pink-900/80 hover:shadow-lg hover:shadow-pink-500/10'
                    : 'bg-white/20 text-pink-900/40'
                } ${isToday ? 'ring-2 ring-pink-300/70' : 'border-white/30'} ${
                  !isCurrentMonth ? 'border-white/20' : ''
                }`}
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className={`font-semibold ${isCurrentMonth ? 'text-pink-900/90' : ''}`}>{date.getDate()}</span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-semibold text-pink-700/80">
                      {items.length} {items.length === 1 ? 'task' : 'tasks'}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {items.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[11px] text-pink-900/30">
                      {isCurrentMonth ? 'No tasks' : ''}
                    </div>
                  ) : (
                    items.map((todo) => (
                      <button
                        key={todo.id}
                        type="button"
                        onClick={() => onToggleTodo(todo.id)}
                        className={`w-full rounded-xl border px-2 py-1.5 text-left text-xs font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 ${
                          todo.completed
                            ? 'border-green-200/80 bg-green-100/70 text-green-800 line-through'
                            : 'border-white/40 bg-white/80 text-pink-900/90 hover:shadow-md'
                        }`}
                        title={todo.text}
                      >
                        <span className="block truncate">{todo.text}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undatedTodos.length > 0 && (
        <div className="rounded-3xl border border-white/20 bg-white/30 p-5 backdrop-blur-lg">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-pink-900/60">No due date</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {undatedTodos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => onToggleTodo(todo.id)}
                className={`rounded-full border px-3 py-1 text-sm shadow-sm transition-all duration-200 ${
                  todo.completed
                    ? 'border-green-200/80 bg-green-100/70 text-green-800 line-through'
                    : 'border-white/30 bg-white/60 text-pink-900/80 hover:border-white/50 hover:bg-white/80'
                }`}
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
