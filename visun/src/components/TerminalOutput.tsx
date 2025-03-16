"use client";

interface TerminalOutputProps {
  content: string;
}

export function TerminalOutput({ content }: TerminalOutputProps) {
  return (
    <div className="my-4 bg-zinc-900 text-white rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-zinc-800 text-sm flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-zinc-400">Terminal</div>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}
