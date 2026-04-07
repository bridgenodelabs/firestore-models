import { useState, type FormEvent } from "react";

import { taskPriorityValues, type TaskPriority } from "../models/task";
import type { CreateTaskInput } from "../hooks/useTaskList";

interface TaskFormProps {
  onCreate: (input: CreateTaskInput) => Promise<void>;
}

export function TaskForm({ onCreate }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const nextDueAt = dueAt.length > 0 ? new Date(dueAt) : undefined;

      await onCreate({
        title,
        priority,
        dueAt: nextDueAt,
      });

      setTitle("");
      setPriority("medium");
      setDueAt("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field__label">Task title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ship adapter docs"
          required
        />
      </label>

      <div className="task-form__row">
        <label className="field">
          <span className="field__label">Priority</span>
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TaskPriority)
            }
          >
            {taskPriorityValues.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Due date (optional)</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create task"}
      </button>
    </form>
  );
}
