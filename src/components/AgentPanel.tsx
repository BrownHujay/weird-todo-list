import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { TodoItem } from '../types';

type ChatRole = 'agent' | 'user';

interface AgentMessage {
  id: number;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface AgentPanelProps {
  isDarkMode: boolean;
  activeTodos: TodoItem[];
  completedTodos: TodoItem[];
  isLoading: boolean;
}

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const AgentPanel = ({ isDarkMode, activeTodos, completedTodos, isLoading }: AgentPanelProps) => {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 0,
      role: 'agent',
      content:
        "Hi! I'm your planning co-pilot. Ask me about your schedule or tell me what you'd like to focus on.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const summary = useMemo(() => {
    const now = new Date();
    const upcoming = activeTodos
      .map((todo) => ({ todo, due: todo.due_at ? new Date(todo.due_at) : null }))
      .filter(({ due }) => due && !Number.isNaN(due.getTime()) && due >= now)
      .sort((a, b) => (a.due && b.due ? a.due.getTime() - b.due.getTime() : 0))
      .slice(0, 3)
      .map(({ todo, due }) => ({
        id: todo.id,
        text: todo.text,
        due: due ? due.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
      }));

    const completedCount = completedTodos.length;
    const activeCount = activeTodos.length;
    return {
      upcoming,
      completedCount,
      activeCount,
    };
  }, [activeTodos, completedTodos]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    const timestamp = new Date().toISOString();
    setMessages((current) => {
      const nextId = current.length ? current[current.length - 1]!.id + 1 : 0;
      const userMessage: AgentMessage = {
        id: nextId,
        role: 'user',
        content: trimmed,
        timestamp,
      };
      const agentMessage: AgentMessage = {
        id: nextId + 1,
        role: 'agent',
        content:
          summary.activeCount === 0
            ? "I'll be ready to help as soon as you add your first task."
            : `I'm warming up my planning skills. Right now you have ${summary.activeCount} active ${
                summary.activeCount === 1 ? 'task' : 'tasks'
              } and ${summary.completedCount} wins logged. We'll wire up deeper assistance soon!`,
        timestamp,
      };
      return [...current, userMessage, agentMessage];
    });
    setDraft('');
  };

  const messageContainerClass = isDarkMode
    ? 'bg-white/5 border-white/10 text-indigo-50'
    : 'bg-white/70 border-white/40 text-pink-900/80';

  const messageBubbleClass = (role: ChatRole) => {
    if (role === 'user') {
      return isDarkMode
        ? 'self-end bg-gradient-to-r from-purple-500/60 to-indigo-500/60 text-white'
        : 'self-end bg-gradient-to-r from-pink-400/70 to-purple-400/70 text-white';
    }
    return isDarkMode
      ? 'self-start bg-white/10 border border-white/10 text-indigo-100'
      : 'self-start bg-white/80 border border-white/60 text-pink-900/80';
  };

  const placeholderCopy = isLoading
    ? 'Syncing your planner... the agent will be ready in a moment.'
    : 'Ask the agent to help organise your day, prioritise tasks, or reflect on recent wins.';

  return (
    <div className="flex h-full flex-col gap-6">
      <section
        className={`flex flex-col gap-4 rounded-3xl border p-5 shadow-inner backdrop-blur ${messageContainerClass}`}
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Agent Workspace</h2>
            <p className={`text-sm ${isDarkMode ? 'text-indigo-100/70' : 'text-pink-900/70'}`}>
              A friendly space to reason about your plan. Conversation history stays on this device for now.
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
              isDarkMode ? 'bg-indigo-500/20 text-indigo-100/80' : 'bg-pink-500/20 text-pink-900/70'
            }`}
          >
            Preview
          </div>
        </header>
        <div
          className={`flex max-h-72 min-h-[12rem] flex-col gap-3 overflow-y-auto rounded-2xl border p-4 ${
            isDarkMode ? 'border-white/10 bg-black/20' : 'border-white/40 bg-white/70'
          }`}
          aria-live="polite"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${messageBubbleClass(message.role)}`}
            >
              <p className="leading-relaxed">{message.content}</p>
              <span className={`mt-2 block text-[10px] uppercase tracking-[0.2em] opacity-70`}>
                {formatTime(message.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className={`rounded-3xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/40 bg-white/70'}`}>
          <h3 className="text-xs font-semibold uppercase tracking-[0.3em]">
            Snapshot
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div
              className={`rounded-2xl border p-3 text-sm ${
                isDarkMode ? 'border-white/10 bg-white/10 text-indigo-100' : 'border-white/40 bg-white/90 text-pink-900/80'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">Active</p>
              <p className="mt-1 text-2xl font-semibold">{summary.activeCount}</p>
            </div>
            <div
              className={`rounded-2xl border p-3 text-sm ${
                isDarkMode ? 'border-white/10 bg-white/10 text-indigo-100' : 'border-white/40 bg-white/90 text-pink-900/80'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">Completed</p>
              <p className="mt-1 text-2xl font-semibold">{summary.completedCount}</p>
            </div>
            <div
              className={`rounded-2xl border p-3 text-sm ${
                isDarkMode ? 'border-white/10 bg-white/10 text-indigo-100' : 'border-white/40 bg-white/90 text-pink-900/80'
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">Focus</p>
              {summary.upcoming.length === 0 ? (
                <p className="mt-1 text-sm">No scheduled items — design your day.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {summary.upcoming.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${
                          isDarkMode ? 'bg-indigo-300/90 shadow-[0_0_10px_rgba(165,180,252,0.6)]' : 'bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)]'
                        }`}
                      />
                      <span className="flex-1 leading-relaxed">
                        {item.text}
                        {item.due ? <span className="block text-[11px] uppercase tracking-[0.2em] opacity-70">{item.due}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`flex flex-col gap-3 rounded-3xl border p-4 shadow-lg ${
            isDarkMode ? 'border-white/10 bg-black/40' : 'border-white/40 bg-white/90'
          }`}
        >
          <label className="text-xs font-semibold uppercase tracking-[0.3em]" htmlFor="agent-input">
            Ask the agent
          </label>
          <textarea
            id="agent-input"
            name="agent-input"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholderCopy}
            className={`w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDarkMode
                ? 'border-white/10 bg-white/5 text-indigo-50 focus:ring-indigo-300/70 focus:ring-offset-black'
                : 'border-white/40 bg-white text-pink-900/80 focus:ring-pink-300/80 focus:ring-offset-white'
            }`}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs ${isDarkMode ? 'text-indigo-100/60' : 'text-pink-900/60'}`}>
              Responses are simulated for now. Real agent magic is coming soon.
            </p>
            <button
              type="submit"
              disabled={!draft.trim()}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-lg transition ${
                isDarkMode
                  ? 'bg-gradient-to-r from-indigo-500/70 to-purple-500/70 text-white disabled:opacity-50'
                  : 'bg-gradient-to-r from-pink-400/80 to-purple-400/80 text-white disabled:opacity-60'
              }`}
            >
              Send
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
              >
                <path d="M5 12l14-8-4 8 4 8-14-8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AgentPanel;
