import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEventHandler } from 'react';
import type { ArchiveReason, TodoItem } from '../types';

interface TodoListProps {
  todos: TodoItem[];
  completedArchive: TodoItem[];
  deletedArchive: TodoItem[];
  newTodo: string;
  newDueDate: string;
  newDueTime: string;
  deletingId: number | null;
  completingId: number | null;
  isDarkMode: boolean;
  latestArchivedId: number | null;
  isLoading: boolean;
  onNewTodoChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onDueTimeChange: (value: string) => void;
  onAddTodo: FormEventHandler<HTMLFormElement>;
  onCompleteTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
  onRestoreTodo: (todo: TodoItem) => void;
  onPermanentDelete: (todo: TodoItem) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value?: string | null) => {
  if (!value) return null;
  const [hoursStr, minutesStr] = value.split(':');
  const hours = Number.parseInt(hoursStr ?? '', 10);
  const minutes = Number.parseInt(minutesStr ?? '', 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return value;
  }
  const display = new Date();
  display.setHours(hours, minutes, 0, 0);
  return display.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const TodoList = ({
  todos,
  completedArchive,
  deletedArchive,
  newTodo,
  newDueDate,
  newDueTime,
  deletingId,
  completingId,
  isDarkMode,
  latestArchivedId,
  isLoading,
  onNewTodoChange,
  onDueDateChange,
  onDueTimeChange,
  onAddTodo,
  onCompleteTodo,
  onDeleteTodo,
  onRestoreTodo,
  onPermanentDelete,
}: TodoListProps) => {
  const [showArchive, setShowArchive] = useState(false);
  const archiveCountRef = useRef(completedArchive.length + deletedArchive.length);

  useEffect(() => {
    const total = completedArchive.length + deletedArchive.length;
    if (total > archiveCountRef.current) {
      setShowArchive(true);
    }
    archiveCountRef.current = total;
  }, [completedArchive.length, deletedArchive.length]);

  const archiveSummary = useMemo(
    () => ({
      completed: completedArchive.length,
      deleted: deletedArchive.length,
    }),
    [completedArchive.length, deletedArchive.length],
  );

  const totalArchived = archiveSummary.completed + archiveSummary.deleted;

  const renderArchiveGroup = (
    items: TodoItem[],
    reason: ArchiveReason,
    heading: string,
    emptyCopy: string,
  ) => {
    const headingClass = isDarkMode ? 'text-indigo-100/80' : 'text-pink-900/80';
    const descriptionClass = isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/60';
    const isCompletedGroup = reason === 'completed';
    const actionRestoreClass = isDarkMode
      ? 'bg-indigo-500/30 text-indigo-100 hover:bg-indigo-500/50'
      : 'bg-pink-500/20 text-pink-700 hover:bg-pink-500/30';
    const actionDeleteClass = isDarkMode
      ? 'text-indigo-200/70 hover:bg-indigo-500/20 hover:text-indigo-100'
      : 'text-pink-700/70 hover:bg-pink-100/50 hover:text-pink-900';
    const reasonLabel = reason === 'completed' ? 'Completed' : 'Deleted';

    if (items.length === 0) {
      return (
        <div className="space-y-3">
          <h3 className={`text-xs font-semibold uppercase tracking-[0.2em] ${headingClass}`}>{heading}</h3>
          <p className={`text-sm ${descriptionClass}`}>{emptyCopy}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h3 className={`text-xs font-semibold uppercase tracking-[0.2em] ${headingClass}`}>{heading}</h3>
        {items.map((todo) => {
          const archivedDate = formatDate(todo.archived_at ?? undefined);
          const timeLabel = formatTime(todo.scheduled_time ?? (todo.due_at ?? undefined));
          const highlightClass =
            todo.id === latestArchivedId
              ? isDarkMode
                ? 'ring-2 ring-indigo-300/60 shadow-[0_0_18px_rgba(129,140,248,0.35)]'
                : 'ring-2 ring-pink-300/70 shadow-[0_0_18px_rgba(236,72,153,0.28)]'
              : '';

          return (
            <div
              key={todo.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between transition-shadow ${
                isCompletedGroup
                  ? isDarkMode
                    ? 'text-emerald-100 border-emerald-400/30 bg-emerald-500/20'
                    : 'border-green-200/80 bg-green-100/70 text-green-900/90'
                  : isDarkMode
                  ? 'text-indigo-100 border-white/10 bg-white/5'
                  : 'border-white/20 bg-white/60 text-pink-900/80'
              } ${highlightClass}`}
            >
              <div>
                <p className="font-semibold">{todo.text}</p>
                <p className={`text-xs ${descriptionClass}`}>
                  {reasonLabel} • {archivedDate ?? 'Recently'}
                  {timeLabel ? ` • ${timeLabel}` : ''}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => onRestoreTodo(todo)}
                  className={`px-3 py-1 text-xs font-semibold tracking-wide uppercase rounded-full transition ${actionRestoreClass}`}
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onPermanentDelete(todo)}
                  className={`flex justify-center items-center w-8 h-8 rounded-full transition ${actionDeleteClass}`}
                  aria-label={`Delete ${todo.text} forever`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const activeTaskCopy = todos.length === 0 ? 'No tasks yet — craft your next move above.' : undefined;

  return (
    <div className="animate-fadeIn">
      <form onSubmit={onAddTodo} className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex flex-col flex-1 gap-3 sm:flex-row">
            <input
              type="text"
              value={newTodo}
              onChange={(event) => onNewTodoChange(event.target.value)}
              placeholder="Add a new task..."
              aria-label="Task description"
              className={`w-full rounded-xl border p-3 placeholder:italic backdrop-blur-lg focus:outline-none focus:ring-2 ${
                isDarkMode
                  ? 'text-indigo-100 border-white/10 bg-white/5 placeholder:text-indigo-200/40 focus:ring-indigo-300/40'
                  : 'border-white/20 bg-white/10 text-pink-900/90 placeholder:text-pink-700/60 focus:ring-white/40'
              }`}
            />
            <div className="flex gap-3 w-full sm:w-auto">
              <input
                type="date"
                value={newDueDate}
                onChange={(event) => onDueDateChange(event.target.value)}
                aria-label="Choose a due date"
                className={`w-full rounded-xl border p-3 backdrop-blur-lg focus:outline-none focus:ring-2 sm:max-w-[200px] ${
                  isDarkMode
                    ? 'text-indigo-100 border-white/10 bg-white/5 focus:ring-indigo-300/40'
                    : 'border-white/20 bg-white/10 text-pink-900/90 focus:ring-white/40'
                }`}
              />
              <input
                type="time"
                value={newDueTime}
                onChange={(event) => onDueTimeChange(event.target.value)}
                aria-label="Choose a time"
                className={`w-full rounded-xl border p-3 backdrop-blur-lg focus:outline-none focus:ring-2 sm:max-w-[150px] ${
                  isDarkMode
                    ? 'text-indigo-100 border-white/10 bg-white/5 focus:ring-indigo-300/40'
                    : 'border-white/20 bg-white/10 text-pink-900/90 focus:ring-white/40'
                }`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`rounded-xl border px-6 py-2 text-white shadow-lg backdrop-blur-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95 ${
              isDarkMode
                ? 'border-violet-400/40 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:border-violet-300/60'
                : 'border-white/20 bg-pink-600/80 hover:border-white/30 hover:bg-pink-700/90'
            } disabled:cursor-not-allowed disabled:opacity-60`}
            >
            Add
          </button>
        </div>
      </form>

      {activeTaskCopy ? (
        <div
          className={`animate-fadeIn rounded-2xl border p-6 text-center backdrop-blur-lg ${
            isDarkMode
              ? 'text-indigo-100 border-white/10 bg-white/5'
              : 'border-white/20 bg-white/40 text-pink-900/70'
          }`}
        >
          {activeTaskCopy}
        </div>
      ) : (
        <div className="space-y-3">
          {todos.map((todo) => {
            const dueDateLabel = formatDate(todo.due_at ?? todo.created_at);
            const timeLabel = formatTime(todo.scheduled_time ?? (todo.due_at ?? undefined));
            const animationClass =
              completingId === todo.id
                ? 'animate-rollComplete bg-green-100/70 border-green-200/80 text-green-900/90'
                : deletingId === todo.id
                ? 'animate-fadeOut'
                : 'animate-fadeIn';
            
            // Force green background when completing before animation
            const completingStyle = completingId === todo.id 
              ? { backgroundColor: 'rgb(220 252 231 / 0.7)', borderColor: 'rgb(187 247 208 / 0.8)' }
              : {};
            const baseClass = todo.completed
              ? isDarkMode
                ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-100'
                : 'border-green-200/80 bg-green-100/70 text-green-900/90'
              : isDarkMode
              ? 'border-white/10 bg-white/5 text-indigo-100 hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10'
              : 'border-white/20 bg-white/40 text-pink-900/90 hover:bg-white/60 hover:shadow-lg hover:shadow-pink-500/10';

            return (
              <div
                key={todo.id}
                className={`flex items-start rounded-2xl border p-4 backdrop-blur-lg transition-all duration-300 ${baseClass} ${animationClass}`}
                style={completingId === todo.id ? completingStyle : {}}
              >
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => onCompleteTodo(todo.id)}
                    className={`h-5 w-5 appearance-none rounded-full border-2 transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'border-indigo-300/50 focus:ring-indigo-300/40 focus:ring-offset-indigo-900/50'
                        : 'border-pink-200 focus:ring-pink-300 focus:ring-offset-pink-100/50'
                    } ${
                      todo.completed
                        ? isDarkMode
                          ? 'bg-emerald-500/90 border-emerald-400/70'
                          : 'bg-green-400/90 border-green-300/80'
                        : 'bg-white/20'
                    }`}
                    aria-label={`Mark ${todo.text} as complete`}
                  />
                  {todo.completed && (
                    <svg
                      className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 transform text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 ml-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p
                      className={`font-medium transition-all duration-300 ${
                        todo.completed ? 'line-through opacity-70' : ''
                      }`}
                    >
                      {todo.text}
                    </p>
                    {timeLabel && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          isDarkMode
                            ? 'bg-indigo-500/20 text-indigo-100'
                            : 'bg-pink-500/15 text-pink-700/80'
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {timeLabel}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-xs ${
                      isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/70'
                    }`}
                  >
                    {todo.due_at ? 'Due' : 'Added'} {dueDateLabel ?? 'soon'}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className={`ml-3 rounded-lg p-1 transition-colors duration-200 ${
                    isDarkMode
                      ? 'text-indigo-200/70 hover:bg-indigo-500/20 hover:text-indigo-100'
                      : 'text-pink-700/70 hover:bg-pink-100/50 hover:text-pink-900'
                  }`}
                  aria-label={`Delete ${todo.text}`}
                  type="button"
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
            );
          })}
        </div>
      )}

      <div className="mt-10 space-y-3">
        <button
          type="button"
          onClick={() => setShowArchive((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.2em] backdrop-blur-lg ${
            isDarkMode
              ? 'border-white/10 bg-white/5 text-indigo-100 hover:bg-white/10'
              : 'border-white/20 bg-white/40 text-pink-900/80 hover:bg-white/60'
          }`}
          aria-expanded={showArchive}
        >
          <span>Archive</span>
          <span className="text-xs tracking-normal text-white/70">
            {totalArchived} saved • {archiveSummary.completed} completed • {archiveSummary.deleted} deleted
          </span>
        </button>

        {showArchive && (
          <div
            className={`animate-archiveReveal grid gap-3 rounded-2xl border p-5 backdrop-blur-lg ${
              isDarkMode
                ? 'border-white/10 bg-white/5'
                : 'border-white/20 bg-white/30'
            }`}
          >
            {totalArchived === 0 ? (
              <p className={`text-sm ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/70'}`}>
                Nothing archived yet — complete or delete a task to see it celebrated here.
              </p>
            ) : (
              <>
                {renderArchiveGroup(
                  completedArchive,
                  'completed',
                  'Completed',
                  'No completed tasks in your archive yet — cross something off to celebrate it here.',
                )}
                {renderArchiveGroup(
                  deletedArchive,
                  'deleted',
                  'Deleted',
                  'No deleted tasks saved. Remove something to keep it handy for restoration or goodbye.',
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoList;
