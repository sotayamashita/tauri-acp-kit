import type { PlanTask } from "../types";

interface PlanViewProps {
  tasks: PlanTask[];
}

function TaskStatusIcon({ status }: { status: PlanTask["status"] }) {
  switch (status) {
    case "pending":
      return (
        <span className="plan-task-icon pending" aria-label="Pending">
          ○
        </span>
      );
    case "in_progress":
      return (
        <span className="plan-task-icon in-progress" aria-label="In progress">
          ●
        </span>
      );
    case "completed":
      return (
        <span className="plan-task-icon completed" aria-label="Completed">
          ✓
        </span>
      );
  }
}

export function PlanView({ tasks }: PlanViewProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="plan-view">
      <div className="plan-header">Plan</div>
      <ul className="plan-tasks">
        {tasks.map((task) => (
          <li key={task.id} className="plan-task" data-status={task.status}>
            <TaskStatusIcon status={task.status} />
            <span>{task.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
