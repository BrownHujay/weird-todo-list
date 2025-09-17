import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { TodoItem } from '../types';

type ChatRole = 'agent' | 'user';
type AgentWidgetType = 'todolist' | 'assignmentlist' | 'weeklyschedule' | 'currentgrades';

interface AgentBaseMessage {
  id: number;
  role: ChatRole;
  timestamp: string;
}

interface AgentTextMessage extends AgentBaseMessage {
  kind: 'text';
  content: string;
}

interface AgentWidgetMessage extends AgentBaseMessage {
  kind: 'widget';
  role: 'agent';
  widgetType: AgentWidgetType;
  command: string;
}

type AgentMessage = AgentTextMessage | AgentWidgetMessage;

interface AgentPanelProps {
  isDarkMode: boolean;
  activeTodos: TodoItem[];
  completedTodos: TodoItem[];
  isLoading: boolean;
}

const COMMAND_TEXT: Record<AgentWidgetType, string> = {
  todolist: '/todolist',
  assignmentlist: '/assignmentlist',
  weeklyschedule: '/weeklyschedule',
  currentgrades: '/currentgrades',
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatClockTime = (value: string) => {
  const [hoursStr, minutesStr] = value.split(':');
  const hours = Number.parseInt(hoursStr ?? '', 10);
  const minutes = Number.parseInt(minutesStr ?? '', 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatTodoDueLabel = (todo: TodoItem) => {
  if (todo.due_at) {
    const due = new Date(todo.due_at);
    if (!Number.isNaN(due.getTime())) {
      const now = new Date();
      const datePart = due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const timePart = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `${isSameDay(due, now) ? 'Due today' : `Due ${datePart}`} • ${timePart}`;
    }
  }
  if (todo.scheduled_time) {
    return `Planned • ${formatClockTime(todo.scheduled_time)}`;
  }
  return 'No due date yet';
};

interface WeekSegment {
  label: string;
  items: { id: number; text: string; time: string }[];
}

const buildWeekSegments = (todos: TodoItem[]): WeekSegment[] => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const withDueDate = todos
    .map((todo) => {
      if (!todo.due_at) return null;
      const due = new Date(todo.due_at);
      if (Number.isNaN(due.getTime())) return null;
      return { todo, due };
    })
    .filter((value): value is { todo: TodoItem; due: Date } => Boolean(value));

  const segments = Array.from({ length: 5 }, (_, index) => {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const items = withDueDate
      .filter(({ due }) => due >= dayStart && due < dayEnd)
      .map(({ todo, due }) => ({
        id: todo.id,
        text: todo.text,
        time: `Due • ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      }));

    return {
      label: dayStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      items,
    };
  }).filter((segment) => segment.items.length > 0);

  const anytimeItems = todos
    .filter((todo) => !todo.due_at)
    .map((todo) => ({
      id: todo.id,
      text: todo.text,
      time: todo.scheduled_time ? `Plan • ${formatClockTime(todo.scheduled_time)}` : 'No set time',
    }));

  if (anytimeItems.length > 0) {
    segments.push({
      label: 'Anytime focus',
      items: anytimeItems.slice(0, 4),
    });
  }

  return segments;
};

interface GradePreviewRow {
  course: string;
  grade: string;
  delta: string;
}

const buildGradePreview = (completedCount: number): GradePreviewRow[] => {
  const lift = Math.min(12, completedCount);
  const momentum = (base: number) => `▲ ${(base + lift * 0.15).toFixed(1)}%`;

  return [
    {
      course: 'Product Design Studio',
      grade: lift > 8 ? 'A' : 'A-',
      delta: momentum(0.8),
    },
    {
      course: 'Media Theory',
      grade: lift > 5 ? 'B+' : 'B',
      delta: momentum(0.6),
    },
    {
      course: 'Entrepreneurship Lab',
      grade: lift > 3 ? 'A-' : 'B+',
      delta: momentum(0.5),
    },
  ];
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

type AgentSummary = {
  upcoming: { id: number; text: string; due: string | null }[];
  activeCount: number;
  completedCount: number;
  canvasCount: number;
};

const getCommandIntro = (command: AgentWidgetType, summary: AgentSummary) => {
  switch (command) {
    case 'todolist': {
      if (summary.activeCount === 0) {
        return 'Your list is clear for now — /todolist will glow once new tasks land.';
      }
      return `Absolutely — /todolist is watching ${summary.activeCount} active ${
        summary.activeCount === 1 ? 'task' : 'tasks'
      }. Here’s the latest snapshot.`;
    }
    case 'assignmentlist': {
      if (summary.canvasCount === 0) {
        return 'Canvas is quiet right now, but /assignmentlist will populate as new coursework appears.';
      }
      return `Pulling up /assignmentlist so you can scan the ${summary.canvasCount} Canvas assignment${
        summary.canvasCount === 1 ? '' : 's'
      } on deck.`;
    }
    case 'weeklyschedule': {
      if (summary.upcoming.length === 0) {
        return 'The week ahead is wide open — /weeklyschedule will map things out once dates roll in.';
      }
      return 'Mapping the next few days with /weeklyschedule so you can plan your momentum.';
    }
    case 'currentgrades':
    default:
      return 'Here’s a simulated /currentgrades pulse to keep your progress in view.';
  }
};

const buildFallbackResponse = (summary: AgentSummary) => {
  if (summary.activeCount === 0) {
    return "You're all clear — add a task or drop a slash command like /todolist whenever you're ready.";
  }

  const next = summary.upcoming[0];
  if (next?.due) {
    return `You're juggling ${summary.activeCount} active ${
      summary.activeCount === 1 ? 'task' : 'tasks'
    }. Next up: ${next.text} due ${next.due}.`;
  }

  return `Currently tracking ${summary.activeCount} active ${
    summary.activeCount === 1 ? 'task' : 'tasks'
  }. Ask for /weeklyschedule or /todolist any time.`;
};

const buildDemoTranscript = (summary: AgentSummary): AgentMessage[] => {
  const transcript: AgentMessage[] = [];
  let nextId = 0;
  const baseTime = Date.now();
  const stamp = () => new Date(baseTime + nextId * 500).toISOString();
  const pushText = (message: Omit<AgentTextMessage, 'id'>) => {
    transcript.push({ ...message, id: nextId });
    nextId += 1;
  };
  const pushWidget = (message: Omit<AgentWidgetMessage, 'id'>) => {
    transcript.push({ ...message, id: nextId });
    nextId += 1;
  };

  pushText({
    role: 'agent',
    kind: 'text',
    content:
      summary.activeCount === 0
        ? "Hey! I'm your planning co-pilot. Add a task or try a slash command to see what's possible."
        : `Hey! You're tracking ${summary.activeCount} active ${
            summary.activeCount === 1 ? 'task' : 'tasks'
          } with ${summary.completedCount} wins logged. Ask me anything.`,
    timestamp: stamp(),
  });

  const addPreview = (userText: string, command: AgentWidgetType) => {
    pushText({ role: 'user', kind: 'text', content: userText, timestamp: stamp() });
    pushText({ role: 'agent', kind: 'text', content: getCommandIntro(command, summary), timestamp: stamp() });
    pushWidget({
      role: 'agent',
      kind: 'widget',
      widgetType: command,
      command: COMMAND_TEXT[command],
      timestamp: stamp(),
    });
  };

  addPreview('Can you check what I need to do today?', 'todolist');
  addPreview('Any big assignments coming up?', 'assignmentlist');
  addPreview("What's the rest of my week look like?", 'weeklyschedule');
  addPreview('And how are my grades holding up?', 'currentgrades');

  return transcript;
};

const detectCommand = (input: string): AgentWidgetType | null => {
  const command = input.trim().split(/\s+/)[0]?.toLowerCase();
  switch (command) {
    case '/todolist':
      return 'todolist';
    case '/assignmentlist':
      return 'assignmentlist';
    case '/weeklyschedule':
      return 'weeklyschedule';
    case '/currentgrades':
      return 'currentgrades';
    default:
      return null;
  }
};

const AgentPanel = ({ isDarkMode, activeTodos, completedTodos, isLoading }: AgentPanelProps) => {
  const [draft, setDraft] = useState('');
  const canvasAssignments = useMemo(
    () => activeTodos.filter((todo) => todo.origin === 'canvas'),
    [activeTodos],
  );

  const summary = useMemo<AgentSummary>(() => {
    const upcoming = activeTodos
      .map((todo) => {
        if (!todo.due_at) return null;
        const due = new Date(todo.due_at);
        if (Number.isNaN(due.getTime())) return null;
        return {
          id: todo.id,
          text: todo.text,
          due: due.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        };
      })
      .filter((item): item is { id: number; text: string; due: string } => Boolean(item))
      .slice(0, 4);

    return {
      upcoming,
      activeCount: activeTodos.length,
      completedCount: completedTodos.length,
      canvasCount: canvasAssignments.length,
    };
  }, [activeTodos, completedTodos.length, canvasAssignments.length]);

  const weekSegments = useMemo(() => buildWeekSegments(activeTodos), [activeTodos]);
  const gradePreview = useMemo(
    () => buildGradePreview(completedTodos.length),
    [completedTodos.length],
  );

  const [messages, setMessages] = useState<AgentMessage[]>(() => buildDemoTranscript(summary));
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hasUserInteracted) return;
    setMessages(buildDemoTranscript(summary));
  }, [summary, hasUserInteracted]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: hasUserInteracted ? 'smooth' : 'auto',
    });
  }, [messages, hasUserInteracted]);

  const panelClass = isDarkMode
    ? 'border-white/10 bg-black/40 text-indigo-50'
    : 'border-white/40 bg-white/80 text-pink-900/80';

  const dividerClass = isDarkMode ? 'border-white/10' : 'border-white/50';
  const commandBadgeClass = isDarkMode
    ? 'bg-indigo-500/20 text-indigo-100/80'
    : 'bg-pink-500/20 text-pink-900/70';

  const messageBubbleClass = (role: ChatRole) => {
    if (role === 'user') {
      return isDarkMode
        ? 'bg-gradient-to-r from-indigo-500/70 to-purple-500/70 text-white'
        : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80 text-white';
    }
    return isDarkMode
      ? 'bg-white/10 border border-white/10 text-indigo-100'
      : 'bg-white/80 border border-white/60 text-pink-900/80';
  };

  const placeholderCopy = isLoading
    ? 'Syncing your planner... the agent will be ready in a moment.'
    : 'Try slash commands like /todolist, /assignmentlist, /weeklyschedule, or /currentgrades.';

  const renderWidget = (type: AgentWidgetType, commandLabel: string) => {
    const baseCardClass = (variant: 'default' | 'highlight' = 'default') =>
      `w-full rounded-3xl border px-5 py-4 shadow-lg transition ${
        variant === 'highlight'
          ? isDarkMode
            ? 'border-white/10 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-sky-500/20 text-indigo-50'
            : 'border-white/60 bg-gradient-to-br from-pink-50 via-rose-50 to-indigo-50 text-pink-900/80'
          : isDarkMode
          ? 'border-white/10 bg-white/5 text-indigo-100'
          : 'border-white/60 bg-white/90 text-pink-900/80'
      }`;

    const accentDot = isDarkMode
      ? 'bg-indigo-300/90 shadow-[0_0_12px_rgba(165,180,252,0.5)]'
      : 'bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.45)]';

    if (type === 'todolist') {
      const preview = activeTodos.slice(0, 4);
      return (
        <div className={baseCardClass()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60'}`}>
                Quick view
              </p>
              <h4 className="mt-1 text-base font-semibold">Today&apos;s to-do list</h4>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${commandBadgeClass}`}>
              {commandLabel}
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {preview.length === 0 ? (
              <li className="text-sm opacity-80">
                No active tasks yet — once you add something, /todolist will populate automatically.
              </li>
            ) : (
              preview.map((todo) => (
                <li
                  key={todo.id}
                  className={`flex items-start gap-3 rounded-2xl border px-3 py-3 ${
                    isDarkMode ? 'border-white/15 bg-black/30' : 'border-pink-100 bg-white/90'
                  }`}
                >
                  <span className={`mt-1 h-2 w-2 flex-none rounded-full ${accentDot}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-snug">{todo.text}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/50'}`}>
                      {formatTodoDueLabel(todo)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      );
    }

    if (type === 'assignmentlist') {
      const preview = canvasAssignments.slice(0, 3);
      return (
        <div className={baseCardClass()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60'}`}>
                Canvas focus
              </p>
              <h4 className="mt-1 text-base font-semibold">Assignment radar</h4>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${commandBadgeClass}`}>
              {commandLabel}
            </span>
          </div>
          {preview.length === 0 ? (
            <p className="mt-4 text-sm opacity-80">
              No Canvas assignments detected yet. As soon as one syncs, this widget will populate with due dates and quick actions.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {preview.map((todo) => (
                <li
                  key={todo.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    isDarkMode ? 'border-white/10 bg-indigo-500/10 text-indigo-100' : 'border-white/50 bg-indigo-50 text-indigo-900'
                  }`}
                >
                  <p className="text-sm font-semibold">{todo.text}</p>
                  <p className={`mt-1 text-[11px] uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/60' : 'text-indigo-900/60'}`}>
                    {formatTodoDueLabel(todo)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (type === 'weeklyschedule') {
      return (
        <div className={baseCardClass()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/60'}`}>
                Planning map
              </p>
              <h4 className="mt-1 text-base font-semibold">Weekly schedule</h4>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${commandBadgeClass}`}>
              {commandLabel}
            </span>
          </div>
          {weekSegments.length === 0 ? (
            <p className="mt-4 text-sm opacity-80">
              The upcoming week is wide open — perfect for designing your own flow.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {weekSegments.map((segment) => (
                <div
                  key={segment.label}
                  className={`rounded-2xl border px-4 py-3 ${
                    isDarkMode ? 'border-white/10 bg-black/30' : 'border-white/50 bg-white/80'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{segment.label}</p>
                  <ul className="mt-3 space-y-2">
                    {segment.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3">
                        <span className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${accentDot}`} />
                        <div>
                          <p className="text-sm font-medium leading-snug">{item.text}</p>
                          <p className={`text-[11px] uppercase tracking-[0.3em] ${isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/50'}`}>
                            {item.time}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const gradientCard = baseCardClass('highlight');
    return (
      <div className={gradientCard}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">Momentum</p>
            <h4 className="mt-1 text-base font-semibold">Current grades</h4>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${commandBadgeClass}`}>
            {commandLabel}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {gradePreview.map((row) => (
            <div
              key={row.course}
              className={`rounded-2xl border px-4 py-3 ${
                isDarkMode ? 'border-white/10 bg-black/30' : 'border-white/50 bg-white/80'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{row.course}</p>
              <p className="mt-2 text-2xl font-semibold">{row.grade}</p>
              <p className={`text-xs font-semibold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-600'}`}>{row.delta}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs opacity-80">Grades are simulated for preview purposes.</p>
      </div>
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const command = detectCommand(trimmed);
    const userTimestamp = new Date().toISOString();

    setMessages((current) => {
      const nextMessages = [...current];
      let nextId = current.length ? current[current.length - 1]!.id + 1 : 0;
      const pushText = (message: Omit<AgentTextMessage, 'id'>) => {
        nextMessages.push({ ...message, id: nextId });
        nextId += 1;
      };
      const pushWidget = (message: Omit<AgentWidgetMessage, 'id'>) => {
        nextMessages.push({ ...message, id: nextId });
        nextId += 1;
      };

      pushText({ role: 'user', kind: 'text', content: trimmed, timestamp: userTimestamp });

      if (command) {
        pushText({
          role: 'agent',
          kind: 'text',
          content: getCommandIntro(command, summary),
          timestamp: new Date(Date.now() + 200).toISOString(),
        });
        pushWidget({
          role: 'agent',
          kind: 'widget',
          widgetType: command,
          command: COMMAND_TEXT[command],
          timestamp: new Date(Date.now() + 400).toISOString(),
        });
      } else {
        pushText({
          role: 'agent',
          kind: 'text',
          content: buildFallbackResponse(summary),
          timestamp: new Date(Date.now() + 200).toISOString(),
        });
      }

      return nextMessages;
    });

    setDraft('');
    setHasUserInteracted(true);
  };

  return (
    <div className="flex h-full flex-col">
      <section className={`flex h-full flex-col overflow-hidden rounded-3xl border shadow-inner backdrop-blur ${panelClass}`}>
        <header className={`flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${dividerClass}`}>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Agent Workspace</h2>
            <p className={`text-sm ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/70'}`}>
              Chat in real time and drop widgets straight into the timeline with slash commands.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
              {Object.values(COMMAND_TEXT).map((command) => (
                <span key={command} className={`rounded-full px-3 py-1 ${commandBadgeClass}`}>
                  {command}
                </span>
              ))}
            </div>
          </div>
          <div className={`self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${commandBadgeClass}`}>
            Preview
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
          role="log"
          aria-live="polite"
        >
          {messages.map((message) => {
            if (message.kind === 'widget') {
              return (
                <div key={message.id} className="flex flex-col items-start gap-2">
                  {renderWidget(message.widgetType, message.command)}
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              );
            }

            const alignment = message.role === 'user' ? 'items-end text-right' : 'items-start text-left';

            return (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] flex-col gap-2 ${alignment}`}>
                  <div className={`rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-lg ${messageBubbleClass(message.role)}`}>
                    {message.content}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          className={`border-t px-6 py-5 ${dividerClass}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.3em]" htmlFor="agent-input">
                Message the agent
              </label>
              <textarea
                id="agent-input"
                name="agent-input"
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={placeholderCopy}
                className={`w-full rounded-2xl border px-4 py-3 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isDarkMode
                    ? 'border-white/10 bg-black/50 text-indigo-50 focus:ring-indigo-300/70 focus:ring-offset-black'
                    : 'border-white/50 bg-white text-pink-900/80 focus:ring-pink-300/80 focus:ring-offset-white'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={!draft.trim()}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2 text-sm font-semibold shadow-lg transition ${
                isDarkMode
                  ? 'bg-gradient-to-r from-indigo-500/70 to-purple-500/70 text-white disabled:opacity-50'
                  : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80 text-white disabled:opacity-60'
              }`}
            >
              Send
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M5 12l14-8-4 8 4 8-14-8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className={`mt-4 text-xs ${isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/60'}`}>
            Responses are simulated for now — the live agent wiring comes next.
          </p>
        </form>
      </section>
    </div>
  );
};

export default AgentPanel;

