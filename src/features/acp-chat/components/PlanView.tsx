import { Circle, CircleDot, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanTask } from "../types";

interface PlanViewProps {
  tasks: PlanTask[];
}

function TaskStatusIcon({ status }: { status: PlanTask["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span
          className="flex shrink-0 items-center justify-center text-[var(--chat-pending-icon)]"
          aria-label="Pending"
        >
          <Circle size={12} />
        </span>
      );
    case "in_progress":
      return (
        <span
          className="flex shrink-0 items-center justify-center animate-pulse text-[var(--chat-tool-running)]"
          aria-label="In progress"
        >
          <CircleDot size={12} />
        </span>
      );
    case "completed":
      return (
        <span
          className="flex shrink-0 items-center justify-center text-[var(--chat-tool-completed)]"
          aria-label="Completed"
        >
          <Check size={12} />
        </span>
      );
  }
}

export function PlanView({ tasks }: PlanViewProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="my-1 overflow-hidden rounded-md border">
      <div className="border-b px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground">
        Plan
      </div>
      <ul className="m-0 list-none p-0">
        {tasks.map((task, i) => (
          <li
            key={task.id}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 text-sm",
              i > 0 && "border-t border-[var(--chat-plan-task-border)]",
            )}
            data-status={task.status}
          >
            <TaskStatusIcon status={task.status} />
            <span>{task.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
