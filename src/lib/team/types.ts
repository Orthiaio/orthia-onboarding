export type Role = "admin" | "developer" | "viewer";
export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  organization_id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export type PublicUser = Omit<User, "password_hash">;

export interface Project {
  id: number;
  organization_id: number;
  key: string;
  name: string;
  description: string | null;
  created_by: number | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  number: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assignee_id: number | null;
  creator_id: number;
  due_date: string | null;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  task_id: number;
  user_id: number | null;
  action:
    | "created"
    | "status_changed"
    | "assigned"
    | "unassigned"
    | "priority_changed"
    | "due_date_changed"
    | "title_changed"
    | "description_changed"
    | "commented";
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Mention {
  id: number;
  comment_id: number;
  user_id: number;
  task_id: number;
  read_at: string | null;
  created_at: string;
}
