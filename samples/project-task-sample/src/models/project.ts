import { defineModel, type PersistedBase } from "firestore-type/core";
import {
  dateFromTimestamp,
  timestampFromDate,
  type TimestampLike,
} from "firestore-type/time";

const defaultTimestampFactory = (date: Date) => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

export interface Project {
  name: string;
  description?: string;
  createdAt: Date;
}

export interface ProjectPersisted extends PersistedBase {
  schemaVersion: 1;
  name: string;
  description?: string;
  createdAt: TimestampLike;
}

export const projectModel = defineModel<Project, ProjectPersisted>({
  currentVersion: 1,
  toPersisted: (project, toTimestamp) => ({
    schemaVersion: 1,
    name: project.name,
    description: project.description,
    createdAt: timestampFromDate(
      project.createdAt,
      toTimestamp ?? defaultTimestampFactory,
    ),
  }),
  fromPersisted: (doc) => ({
    name: doc.name,
    description: doc.description,
    createdAt: dateFromTimestamp(doc.createdAt),
  }),
});
