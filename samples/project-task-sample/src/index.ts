import {
  persistProjectWithTasks,
  getProjectWithTasks,
  type TaskWithId,
} from "./lib/projectAdapter";
import { type Project } from "./models/project";
import { type TaskPriority } from "../../shared/src/models/task";

const projectId =
  process.env.PROJECT_TASKS_PROJECT_ID ??
  process.env.VITE_PROJECT_TASKS_PROJECT_ID ??
  "project-demo";
const taskPriority: TaskPriority = "medium";

const project: Project = {
  name: "Transactional Project",
  description:
    "Sample project that writes a parent document with a task subcollection in one transaction.",
  createdAt: new Date(),
};

const tasks: TaskWithId[] = [
  {
    id: `${projectId}-task-1`,
    title: "Capture requirements",
    done: false,
    priority: taskPriority,
  },
  {
    id: `${projectId}-task-2`,
    title: "Implement adapter",
    done: false,
    priority: "high",
  },
];

async function main(): Promise<void> {
  await persistProjectWithTasks(projectId, project, tasks);

  const projectWithTasks = await getProjectWithTasks(projectId);
  console.log("Transaction succeeded. Hydrated project:");
  console.log(JSON.stringify(projectWithTasks, null, 2));
}

main().catch((error) => {
  console.error("Project task sample failed:", error);
  process.exitCode = 1;
});
