import type { TaskWithId } from "../hooks/useTaskList";

interface TaskListProps {
  tasks: TaskWithId[];
  actionTaskId: string | null;
  onToggle: (task: TaskWithId) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

function formatDueAt(value?: Date): string {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function TaskList({
  tasks,
  actionTaskId,
  onToggle,
  onDelete,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <section className="task-list task-list--empty">
        <p>No tasks yet. Add one to verify create/read/update/delete flows.</p>
      </section>
    );
  }

  return (
    <section className="task-list">
      <ul>
        {tasks.map((task) => {
          const isWorking = task.id === actionTaskId;

          return (
            <li
              key={task.id}
              className={task.done ? "task task--done" : "task"}
            >
              <div className="task__main">
                <h3>{task.title}</h3>
                <p>
                  <span>Priority: {task.priority}</span>
                  <span>Due: {formatDueAt(task.dueAt)}</span>
                </p>
              </div>

              <div className="task__actions">
                <button
                  type="button"
                  onClick={() => onToggle(task)}
                  disabled={isWorking}
                >
                  {task.done ? "Mark active" : "Mark done"}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDelete(task.id)}
                  disabled={isWorking}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
