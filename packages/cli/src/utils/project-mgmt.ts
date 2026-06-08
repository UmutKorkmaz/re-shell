// Project Management and Tracking Systems with Metrics and Dashboards

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type SprintStatus = 'planning' | 'active' | 'review' | 'retrospective' | 'completed';
export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed' | 'archived';
export type IssueType = 'bug' | 'feature' | 'improvement' | 'task' | 'story' | 'epic';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TimeEntryType = 'development' | 'meeting' | 'review' | 'planning' | 'testing' | 'documentation' | 'other';
export type DashboardType = 'sprint' | 'project' | 'team' | 'portfolio' | 'custom';

export interface ProjectManagementConfig {
  projectName: string;
  organization: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: PMSettings;
  projects: Project[];
  sprints: Sprint[];
  tasks: Task[];
  issues: Issue[];
  timeEntries: TimeEntry[];
  dashboards: Dashboard[];
  teams: Team[];
  milestones: Milestone[];
}

export interface PMSettings {
  enableSprints: boolean;
  sprintDuration: number; // weeks
  sprintPointsEnabled: boolean;
  enableTimeTracking: boolean;
  requireTimeEstimate: boolean;
  enableIssueTracking: boolean;
  autoAssignIssues: boolean;
  enableNotifications: boolean;
  notificationChannels: Array<'email' | 'slack' | 'teams' | 'webhook'>;
  enableReporting: boolean;
  reportFrequency: 'daily' | 'weekly' | 'sprint';
  enableBurndown: boolean;
  enableVelocity: boolean;
  velocitySprints: number; // number of sprints to average
  enableCapacityPlanning: boolean;
  defaultTeamSize: number;
  enableLabels: boolean;
  enableEpics: boolean;
  enableSubtasks: boolean;
  maxSubtaskDepth: number;
  enableDependencies: boolean;
  enableBlockedStatus: boolean;
  requireCompletionForSprint: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  type: 'software' | 'infrastructure' | 'documentation' | 'research' | 'custom';

  // Dates
  startDate: Date;
  endDate?: Date;
  createdDate: Date;
  createdBy: string;

  // Planning
  budget?: number;
  budgetCurrency: string;
  estimatedHours: number;
  actualHours: number;

  // Team
  ownerId: string;
  ownerName: string;
  teamId: string;
  teamName: string;

  // Progress
  progress: number; // 0-100
  tasksCompleted: number;
  tasksTotal: number;

  // Configuration
  sprintsEnabled: boolean;
  activeSprintId?: string;

  // Tags
  tags: string[];

  // Metrics
  velocity?: number;
  burndown?: BurndownData[];

  // Dependencies
  dependsOn: string[]; // project IDs
  blocks: string[]; // project IDs
}

export interface BurndownData {
  date: Date;
  idealRemaining: number;
  actualRemaining: number;
}

export interface Sprint {
  id: string;
  name: string;
  description: string;
  projectId: string;
  projectName: string;
  status: SprintStatus;

  // Dates
  startDate: Date;
  endDate: Date;
  createdDate: Date;

  // Goals
  goal: string;
  sprintPoints?: number;

  // Tasks
  taskIds: string[];

  // Team
  teamId: string;
  scrumMaster: string;
  productOwner: string;

  // Capacity
  capacity: number; // hours
  allocatedHours: number;

  // Metrics
  completedPoints?: number;
  burndown: BurndownData[];

  // Review
  retrospective?: string;
  reviewNotes?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: IssueType;

  // Assignment
  projectId: string;
  sprintId?: string;
  epicId?: string;
  parentId?: string;

  // Estimates
  storyPoints?: number;
  estimatedHours: number;
  actualHours: number;

  // Assignment
  assigneeId?: string;
  assigneeName?: string;
  reporterId: string;
  reporterName: string;

  // Dates
  createdDate: Date;
  updatedDate: Date;
  dueDate?: Date;
  startDate?: Date;
  completedDate?: Date;

  // Dependencies
  dependsOn: string[]; // task IDs
  blocks: string[]; // task IDs

  // Progress
  progress: number; // 0-100
  subtasksCompleted: number;
  subtasksTotal: number;

  // Labels
  labels: string[];

  // Attachments
  attachments: TaskAttachment[];

  // Comments
  comments: TaskComment[];

  // History
  history: TaskHistoryEntry[];

  // Validation
  acceptanceCriteria: string[];

  // Links
  relatedIssues: string[]; // task IDs
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'link' | 'code' | 'other';
  url: string;
  size?: number;
  uploadedBy: string;
  uploadedDate: Date;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdDate: Date;
  updatedDate?: Date;
}

export interface TaskHistoryEntry {
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  status: TaskStatus;
  priority: TaskPriority;

  // Assignment
  projectId: string;
  assigneeId?: string;
  assigneeName?: string;
  reporterId: string;
  reporterName: string;

  // Dates
  createdDate: Date;
  updatedDate: Date;
  dueDate?: Date;
  resolvedDate?: Date;

  // Details
  environment?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;

  // Tracking
  sprintId?: string;
  epicId?: string;

  // Progress
  progress: number; // 0-100

  // Labels
  labels: string[];

  // Attachments
  attachments: TaskAttachment[];

  // Comments
  comments: TaskComment[];
}

export interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  userId: string;
  userName: string;
  type: TimeEntryType;

  // Time
  date: Date;
  duration: number; // minutes
  billable: boolean;

  // Description
  description: string;

  // Approval
  approved: boolean;
  approvedBy?: string;
  approvedDate?: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  type: DashboardType;
  scope: string[]; // project IDs, team IDs, etc.

  // Widgets
  widgets: DashboardWidget[];

  // Configuration
  refreshInterval?: number; // minutes
  autoRefresh: boolean;

  // Access
  owner: string;
  viewers: string[];
  editors: string[];

  // Layout
  layout: 'grid' | 'list' | 'kanban';

  // Filters
  filters: DashboardFilters;

  // Dates
  createdDate: Date;
  updatedDate: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'burndown' | 'velocity' | 'task-status' | 'sprint-progress' | 'time-tracking' | 'task-distribution' | 'cumulative-flow' | 'lead-time' | 'cycle-time' | 'custom';
  title: string;
  position: { row: number; column: number };
  size: { width: number; height: number };
  config: Record<string, any>;
}

export interface DashboardFilters {
  projects?: string[];
  sprints?: string[];
  teams?: string[];
  users?: string[];
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  types?: IssueType[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface Team {
  id: string;
  name: string;
  description: string;

  // Members
  members: TeamMember[];
  leadId: string;
  leadName: string;

  // Projects
  projectIds: string[];

  // Capacity
  capacity: number; // hours per sprint
  velocityHistory: number[];

  // Skills
  skills: string[];

  // Locations
  locations: string[];

  // Timezone
  timezone: string;
}

export interface TeamMember {
  userId: string;
  userName: string;
  email: string;
  role: 'developer' | 'designer' | 'tester' | 'manager' | 'architect' | 'scrum-master' | 'product-owner' | 'custom';
  skills: string[];
  capacity: number; // hours per sprint
  avatar?: string;
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  projectId: string;

  // Dates
  targetDate: Date;
  completedDate?: Date;

  // Status
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'overdue';

  // Tasks
  taskIds: string[];

  // Progress
  progress: number; // 0-100

  // Dependencies
  dependsOn: string[]; // milestone IDs
}

// Manager Class
export class ProjectManagementManager {
  private projects: Map<string, Project> = new Map();
  private sprints: Map<string, Sprint> = new Map();
  private tasks: Map<string, Task> = new Map();
  private issues: Map<string, Issue> = new Map();
  private timeEntries: Map<string, TimeEntry> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private teams: Map<string, Team> = new Map();
  private milestones: Map<string, Milestone> = new Map();

  // Project Management
  createProject(project: Omit<Project, 'id' | 'createdDate' | 'actualHours' | 'tasksCompleted' | 'progress'>): Project {
    const id = this.generateId('project');
    const now = new Date();

    const newProject: Project = {
      ...project,
      id,
      createdDate: now,
      actualHours: 0,
      tasksCompleted: 0,
      progress: 0,
    };

    this.projects.set(id, newProject);
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  listProjects(filters?: { status?: ProjectStatus; teamId?: string }): Project[] {
    let projects = Array.from(this.projects.values());

    if (filters?.status) {
      projects = projects.filter(p => p.status === filters.status);
    }
    if (filters?.teamId) {
      projects = projects.filter(p => p.teamId === filters.teamId);
    }

    return projects.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  }

  // Sprint Management
  createSprint(sprint: Omit<Sprint, 'id' | 'createdDate'>): Sprint {
    const id = this.generateId('sprint');
    const now = new Date();

    const newSprint: Sprint = {
      ...sprint,
      id,
      createdDate: now,
      burndown: this.generateInitialBurndown(sprint.startDate, sprint.endDate, sprint.taskIds),
    };

    this.sprints.set(id, newSprint);
    return newSprint;
  }

  startSprint(sprintId: string): Sprint | undefined {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) return undefined;

    sprint.status = 'active';
    this.sprints.set(sprintId, sprint);
    return sprint;
  }

  completeSprint(sprintId: string, retrospective: string, completedPoints: number): Sprint | undefined {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) return undefined;

    sprint.status = 'completed';
    sprint.retrospective = retrospective;
    sprint.completedPoints = completedPoints;

    this.sprints.set(sprintId, sprint);
    return sprint;
  }

  getSprint(id: string): Sprint | undefined {
    return this.sprints.get(id);
  }

  listSprints(projectId?: string): Sprint[] {
    let sprints = Array.from(this.sprints.values());
    if (projectId) {
      sprints = sprints.filter(s => s.projectId === projectId);
    }
    return sprints.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  // Task Management
  createTask(task: Omit<Task, 'id' | 'createdDate' | 'updatedDate' | 'actualHours' | 'progress' | 'subtasksCompleted' | 'history'>): Task {
    const id = this.generateId('task');
    const now = new Date();

    const newTask: Task = {
      ...task,
      id,
      createdDate: now,
      updatedDate: now,
      actualHours: 0,
      progress: 0,
      subtasksCompleted: 0,
      history: [{
        timestamp: now,
        userId: task.reporterId,
        userName: task.reporterName,
        action: 'created',
      }],
    };

    this.tasks.set(id, newTask);
    return newTask;
  }

  updateTask(taskId: string, updates: Partial<Task>, userId: string, userName: string): Task | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const updated = {
      ...task,
      ...updates,
      updatedDate: new Date(),
    };

    // Add history entry
    for (const [key, value] of Object.entries(updates)) {
      updated.history.push({
        timestamp: new Date(),
        userId,
        userName,
        action: 'updated',
        field: key,
        oldValue: JSON.stringify((task as any)[key]),
        newValue: JSON.stringify(value),
      });
    }

    this.tasks.set(taskId, updated);
    return updated;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  listTasks(filters?: { projectId?: string; sprintId?: string; status?: TaskStatus; assigneeId?: string }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filters?.projectId) {
      tasks = tasks.filter(t => t.projectId === filters.projectId);
    }
    if (filters?.sprintId) {
      tasks = tasks.filter(t => t.sprintId === filters.sprintId);
    }
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters?.assigneeId) {
      tasks = tasks.filter(t => t.assigneeId === filters.assigneeId);
    }

    return tasks.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  }

  // Issue Management
  createIssue(issue: Omit<Issue, 'id' | 'createdDate' | 'updatedDate' | 'progress'>): Issue {
    const id = this.generateId('issue');
    const now = new Date();

    const newIssue: Issue = {
      ...issue,
      id,
      createdDate: now,
      updatedDate: now,
      progress: 0,
    };

    this.issues.set(id, newIssue);
    return newIssue;
  }

  getIssue(id: string): Issue | undefined {
    return this.issues.get(id);
  }

  listIssues(filters?: { projectId?: string; severity?: IssueSeverity; status?: TaskStatus }): Issue[] {
    let issues = Array.from(this.issues.values());

    if (filters?.projectId) {
      issues = issues.filter(i => i.projectId === filters.projectId);
    }
    if (filters?.severity) {
      issues = issues.filter(i => i.severity === filters.severity);
    }
    if (filters?.status) {
      issues = issues.filter(i => i.status === filters.status);
    }

    return issues.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  }

  // Time Tracking
  createTimeEntry(entry: Omit<TimeEntry, 'id'>): TimeEntry {
    const id = this.generateId('time');
    const newEntry: TimeEntry = { ...entry, id };
    this.timeEntries.set(id, newEntry);

    // Update task actual hours
    const task = this.tasks.get(entry.taskId);
    if (task) {
      task.actualHours += entry.duration / 60;
    }

    return newEntry;
  }

  getTimeEntries(filters?: { taskId?: string; userId?: string; projectId?: string }): TimeEntry[] {
    let entries = Array.from(this.timeEntries.values());

    if (filters?.taskId) {
      entries = entries.filter(e => e.taskId === filters.taskId);
    }
    if (filters?.userId) {
      entries = entries.filter(e => e.userId === filters.userId);
    }
    if (filters?.projectId) {
      entries = entries.filter(e => e.projectId === filters.projectId);
    }

    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Team Management
  createTeam(team: Omit<Team, 'id'>): Team {
    const id = this.generateId('team');
    const newTeam: Team = { ...team, id, velocityHistory: [] };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  listTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  // Milestone Management
  createMilestone(milestone: Omit<Milestone, 'id' | 'progress'>): Milestone {
    const id = this.generateId('milestone');
    const newMilestone: Milestone = {
      ...milestone,
      id,
      progress: 0,
    };
    this.milestones.set(id, newMilestone);
    return newMilestone;
  }

  getMilestone(id: string): Milestone | undefined {
    return this.milestones.get(id);
  }

  listMilestones(projectId?: string): Milestone[] {
    let milestones = Array.from(this.milestones.values());
    if (projectId) {
      milestones = milestones.filter(m => m.projectId === projectId);
    }
    return milestones.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
  }

  // Dashboard Management
  createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdDate' | 'updatedDate'>): Dashboard {
    const id = this.generateId('dashboard');
    const now = new Date();

    const newDashboard: Dashboard = {
      ...dashboard,
      id,
      createdDate: now,
      updatedDate: now,
    };

    this.dashboards.set(id, newDashboard);
    return newDashboard;
  }

  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  listDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  // Analytics
  getProjectSummary(projectId: string): ProjectSummary {
    const project = this.projects.get(projectId);
    if (!project) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        totalHours: 0,
        remainingHours: 0,
        velocity: 0,
        activeSprint: null,
      };
    }

    const tasks = this.listTasks({ projectId });
    const completedTasks = tasks.filter(t => t.status === 'done');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    const remainingHours = tasks.reduce((sum, t) => sum + (t.estimatedHours - t.actualHours), 0);

    const activeSprint = this.listSprints(projectId).find(s => s.status === 'active');

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      totalHours,
      remainingHours,
      velocity: project.velocity || 0,
      activeSprint: activeSprint || null,
    };
  }

  getTeamVelocity(teamId: string, sprintCount = 3): number {
    const sprints = this.listSprints()
      .filter(s => s.teamId === teamId && s.status === 'completed' && s.completedPoints !== undefined)
      .slice(-sprintCount);

    if (sprints.length === 0) return 0;
    return Math.round(sprints.reduce((sum, s) => sum + (s.completedPoints || 0), 0) / sprints.length);
  }

  getSprintBurndown(sprintId: string): BurndownData[] {
    const sprint = this.sprints.get(sprintId);
    return sprint?.burndown || [];
  }

  // Helper methods
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateInitialBurndown(startDate: Date, endDate: Date, taskIds: string[]): BurndownData[] {
    const totalPoints = taskIds.reduce((sum, id) => {
      const task = this.tasks.get(id);
      return sum + (task?.storyPoints || 0);
    }, 0);

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const burndown: BurndownData[] = [];
    const pointsPerDay = totalPoints / days;

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      burndown.push({
        date,
        idealRemaining: Math.max(0, totalPoints - pointsPerDay * i),
        actualRemaining: totalPoints, // Will be updated as work progresses
      });
    }

    return burndown;
  }
}

export interface ProjectSummary {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalHours: number;
  remainingHours: number;
  velocity: number;
  activeSprint: Sprint | null;
}

// Generate Markdown Documentation
export function generateProjectMgmtMarkdown(config: ProjectManagementConfig): string {
  let md = '# Project Management and Tracking System\n\n';
  md += '## Overview\n\n';
  md += `**Project:** ${config.projectName}\n`;
  md += `**Organization:** ${config.organization}\n`;
  md += `**Providers:** ${config.providers.join(', ')}\n\n`;

  md += '## Features\n\n';
  md += '- Sprint planning and management\n';
  md += '- Task tracking with status, priority, and assignments\n';
  md += '- Issue tracking and bug reporting\n';
  md += '- Time tracking and reporting\n';
  md += '- Burndown and velocity charts\n';
  md += '- Team capacity planning\n';
  md += '- Milestone tracking\n';
  md += '- Custom dashboards with widgets\n';
  md += '- Epic and subtask support\n';
  md += '- Task dependencies and blocking\n';
  md += '- Comments and attachments\n';
  md += '- Full audit history\n\n';

  md += '## Projects\n\n';
  md += '| Project | Status | Progress | Tasks | Velocity |\n';
  md += '|---------|--------|----------|-------|----------|\n';

  for (const project of config.projects) {
    const progress = Math.round(project.progress);
    md += `| ${project.name} | ${project.status} | ${progress}% | ${project.tasksCompleted}/${project.tasksTotal} | ${project.velocity || '-'} |\n`;
  }
  md += '\n';

  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { ProjectManagementManager } from \'./project-manager\';\n\n';
  md += 'const manager = new ProjectManagementManager();\n\n';
  md += '// Create a project\n';
  md += 'const project = manager.createProject({\n';
  md += '  name: "My Project",\n';
  md += '  description: "Project description",\n';
  md += '  status: "active",\n';
  md += '  type: "software",\n';
  md += '  startDate: new Date(),\n';
  md += '  estimatedHours: 1000,\n';
  md += '  ownerId: "user-001",\n';
  md += '  ownerName: "John Doe",\n';
  md += '  teamId: "team-001",\n';
  md += '  teamName: "Engineering Team"\n';
  md += '});\n\n';
  md += '// Create a task\n';
  md += 'const task = manager.createTask({\n';
  md += '  title: "Implement feature",\n';
  md += '  description: "Feature description",\n';
  md += '  status: "todo",\n';
  md += '  priority: "high",\n';
  md += '  type: "feature",\n';
  md += '  projectId: project.id,\n';
  md += '  estimatedHours: 8,\n';
  md += '  reporterId: "user-001",\n';
  md += '  reporterName: "John Doe"\n';
  md += '});\n';
  md += '```\n\n';

  return md;
}

// Generate Terraform Configuration
export function generateProjectMgmtTerraform(config: ProjectManagementConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  let tf = `# Terraform for Project Management - ${provider.toUpperCase()}\n`;
  tf += `# Generated for ${config.projectName}\n\n`;

  if (provider === 'aws') {
    tf += '# DynamoDB for project data\n';
    tf += 'resource "aws_dynamodb_table" "projects" {\n';
    tf += `  name = "${config.projectName}-projects"\n`;
    tf += '  billing_mode = "PAY_PER_REQUEST"\n';
    tf += '  hash_key = "id"\n\n';
    tf += '  attribute {\n';
    tf += '    name = "id"\n';
    tf += '    type = "S"\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += 'resource "aws_dynamodb_table" "tasks" {\n';
    tf += `  name = "${config.projectName}-tasks"\n`;
    tf += '  billing_mode = "PAY_PER_REQUEST"\n';
    tf += '  hash_key = "id"\n\n';
    tf += '  attribute {\n';
    tf += '    name = "id"\n';
    tf += '    type = "S"\n';
    tf += '  }\n\n';
    tf += '  global_secondary_index {\n';
    tf += '    name = "ProjectIndex"\n';
    tf += '    hash_key = "projectId"\n';
    tf += '    projection_type = "ALL"\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += 'resource "aws_dynamodb_table" "sprints" {\n';
    tf += `  name = "${config.projectName}-sprints"\n`;
    tf += '  billing_mode = "PAY_PER_REQUEST"\n';
    tf += '  hash_key = "id"\n\n';
    tf += '  attribute {\n';
    tf += '    name = "id"\n';
    tf += '    type = "S"\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# S3 for attachments\n';
    tf += 'resource "aws_s3_bucket" "attachments" {\n';
    tf += `  bucket = "${config.projectName}-attachments"\n`;
    tf += '  versioning {\n';
    tf += '    enabled = true\n';
    tf += '  }\n';
    tf += '}\n\n';
  } else if (provider === 'azure') {
    tf += '# Azure Resources for Project Management\n';
    tf += 'resource "azurerm_storage_account" "pm_storage" {\n';
    tf += `  name = "${config.projectName}pmstorage"\n`;
    tf += '  resource_group_name = azurerm_resource_group.main.name\n';
    tf += '  location = var.location\n';
    tf += '  account_tier = "Standard"\n';
    tf += '  account_replication_type = "LRS"\n';
    tf += '}\n\n';

    tf += '# Cosmos DB for data\n';
    tf += 'resource "azurerm_cosmosdb_account" "pm_db" {\n';
    tf += `  name = "${config.projectName}-pm-db"\n`;
    tf += '  location = var.location\n';
    tf += '  resource_group_name = azurerm_resource_group.main.name\n';
    tf += '  offer_type = "Standard"\n';
    tf += '  kind = "GlobalDocumentDB"\n';
    tf += '}\n\n';
  } else if (provider === 'gcp') {
    tf += '# GCP Resources for Project Management\n';
    tf += 'resource "google_storage_bucket" "attachments" {\n';
    tf += `  name = "${config.projectName}-attachments"\n`;
    tf += '  location = var.location\n';
    tf += '  versioning {\n';
    tf += '    enabled = true\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# Firestore for data\n';
    tf += 'resource "google_firestore_database" "pm_db" {\n';
    tf += `  name = "${config.projectName}-pm-db"\n`;
    tf += '  location = var.region\n';
    tf += '  type = "FIRESTORE_NATIVE"\n';
    tf += '}\n\n';
  }

  return tf;
}

// Generate TypeScript Manager
export function generateTypeScriptManager(config: ProjectManagementConfig): string {
  let code = `// Project Management Manager - TypeScript\n`;
  code += `// Generated for ${config.projectName}\n\n`;
  code += `import { EventEmitter } from 'events';\n`;
  code += `import { randomUUID } from 'crypto';\n\n`;

  // Enums
  code += `export enum TaskStatus {\n`;
  code += `  BACKLOG = 'backlog',\n`;
  code += `  TODO = 'todo',\n`;
  code += `  IN_PROGRESS = 'in-progress',\n`;
  code += `  IN_REVIEW = 'in-review',\n`;
  code += `  DONE = 'done',\n`;
  code += `  BLOCKED = 'blocked',\n`;
  code += `  CANCELLED = 'cancelled'\n`;
  code += `}\n\n`;

  code += `export enum TaskPriority {\n`;
  code += `  CRITICAL = 'critical',\n`;
  code += `  HIGH = 'high',\n`;
  code += `  MEDIUM = 'medium',\n`;
  code += `  LOW = 'low'\n`;
  code += `}\n\n`;

  code += `export enum SprintStatus {\n`;
  code += `  PLANNING = 'planning',\n`;
  code += `  ACTIVE = 'active',\n`;
  code += `  REVIEW = 'review',\n`;
  code += `  RETROSPECTIVE = 'retrospective',\n`;
  code += `  COMPLETED = 'completed'\n`;
  code += `}\n\n`;

  // Interfaces
  code += `export interface Task {\n`;
  code += `  id: string;\n`;
  code += `  title: string;\n`;
  code += `  description: string;\n`;
  code += `  status: TaskStatus;\n`;
  code += `  priority: TaskPriority;\n`;
  code += `  type: string;\n`;
  code += `  projectId: string;\n`;
  code += `  sprintId?: string;\n`;
  code += `  assigneeId?: string;\n`;
  code += `  storyPoints?: number;\n`;
  code += `  estimatedHours: number;\n`;
  code += `  actualHours: number;\n`;
  code += `  progress: number;\n`;
  code += `  createdDate: Date;\n`;
  code += `  dueDate?: Date;\n`;
  code += `}\n\n`;

  code += `export interface Sprint {\n`;
  code += `  id: string;\n`;
  code += `  name: string;\n`;
  code += `  projectId: string;\n`;
  code += `  status: SprintStatus;\n`;
  code += `  startDate: Date;\n`;
  code += `  endDate: Date;\n`;
  code += `  goal: string;\n`;
  code += `  taskIds: string[];\n`;
  code += `  capacity: number;\n`;
  code += `}\n\n`;

  // Manager Class
  code += `export class ProjectManagementManager extends EventEmitter {\n`;
  code += `  private projects: Map<string, Project> = new Map();\n`;
  code += `  private sprints: Map<string, Sprint> = new Map();\n`;
  code += `  private tasks: Map<string, Task> = new Map();\n\n`;

  code += `  constructor() {\n`;
  code += `    super();\n`;
  code += `  }\n\n`;

  // Create Task
  code += `  createTask(task: Omit<Task, 'id' | 'createdDate' | 'actualHours' | 'progress'>): Task {\n`;
  code += `    const id = this.generateId('task');\n`;
  code += `    const newTask: Task = {\n`;
  code += `      ...task,\n`;
  code += `      id,\n`;
  code += `      createdDate: new Date(),\n`;
  code += `      actualHours: 0,\n`;
  code += `      progress: 0\n`;
  code += `    };\n\n`;
  code += `    this.tasks.set(id, newTask);\n`;
  code += `    this.emit('taskCreated', newTask);\n`;
  code += `    return newTask;\n`;
  code += `  }\n\n`;

  // Update Task
  code += `  updateTask(taskId: string, updates: Partial<Task>): Task | undefined {\n`;
  code += `    const task = this.tasks.get(taskId);\n`;
  code += `    if (!task) return undefined;\n\n`;
  code += `    const updated = { ...task, ...updates };\n`;
  code += `    this.tasks.set(taskId, updated);\n`;
  code += `    this.emit('taskUpdated', updated);\n`;
  code += `    return updated;\n`;
  code += `  }\n\n`;

  // Create Sprint
  code += `  createSprint(sprint: Omit<Sprint, 'id'>): Sprint {\n`;
  code += `    const id = this.generateId('sprint');\n`;
  code += `    const newSprint: Sprint = { ...sprint, id };\n`;
  code += `    this.sprints.set(id, newSprint);\n`;
  code += `    this.emit('sprintCreated', newSprint);\n`;
  code += `    return newSprint;\n`;
  code += `  }\n\n`;

  // Start Sprint
  code += `  startSprint(sprintId: string): Sprint | undefined {\n`;
  code += `    const sprint = this.sprints.get(sprintId);\n`;
  code += `    if (!sprint) return undefined;\n\n`;
  code += `    sprint.status = SprintStatus.ACTIVE;\n`;
  code += `    this.emit('sprintStarted', sprint);\n`;
  code += `    return sprint;\n`;
  code += `  }\n\n`;

  // List methods
  code += `  listTasks(projectId?: string): Task[] {\n`;
  code += `    let tasks = Array.from(this.tasks.values());\n`;
  code += `    if (projectId) {\n`;
  code += `      tasks = tasks.filter(t => t.projectId === projectId);\n`;
  code += `    }\n`;
  code += `    return tasks.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());\n`;
  code += `  }\n\n`;

  code += `  listSprints(projectId?: string): Sprint[] {\n`;
  code += `    let sprints = Array.from(this.sprints.values());\n`;
  code += `    if (projectId) {\n`;
  code += `      sprints = sprints.filter(s => s.projectId === projectId);\n`;
  code += `    }\n`;
  code += `    return sprints.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());\n`;
  code += `  }\n\n`;

  // Get Summary
  code += `  getSummary(projectId: string): ProjectSummary {\n`;
  code += `    const tasks = this.listTasks(projectId);\n`;
  code += `    const completed = tasks.filter(t => t.status === TaskStatus.DONE).length;\n`;
  code += `    const inProgress = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;\n`;
  code += `    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);\n\n`;
  code += `    return {\n`;
  code += `      totalTasks: tasks.length,\n`;
  code += `      completedTasks: completed,\n`;
  code += `      inProgressTasks: inProgress,\n`;
  code += `      totalHours,\n`;
  code += `      velocity: this.calculateVelocity(projectId)\n`;
  code += `    };\n`;
  code += `  }\n\n`;

  // Private helpers
  code += `  private generateId(prefix: string): string {\n`;
  code += `    return \`\${prefix}-\${Date.now()}-\${randomUUID().substring(0, 8)}\`;\n`;
  code += `  }\n\n`;

  code += `  private calculateVelocity(projectId: string): number {\n`;
  code += `    const sprints = Array.from(this.sprints.values())\n`;
  code += `      .filter(s => s.projectId === projectId && s.status === SprintStatus.COMPLETED)\n`;
  code += `      .slice(-3);\n\n`;
  code += `    if (sprints.length === 0) return 0;\n`;
  code += `    return Math.round(sprints.length);\n`;
  code += `  }\n`;
  code += `}\n\n`;

  code += `export interface Project {\n`;
  code += `  id: string;\n`;
  code += `  name: string;\n`;
  code += `  status: string;\n`;
  code += `  progress: number;\n`;
  code += `  tasksCompleted: number;\n`;
  code += `  tasksTotal: number;\n`;
  code += `}\n\n`;

  code += `export interface ProjectSummary {\n`;
  code += `  totalTasks: number;\n`;
  code += `  completedTasks: number;\n`;
  code += `  inProgressTasks: number;\n`;
  code += `  totalHours: number;\n`;
  code += `  velocity: number;\n`;
  code += `}\n`;

  return code;
}

// Generate Python Manager
export function generatePythonManager(config: ProjectManagementConfig): string {
  let code = `# Project Management Manager - Python\n`;
  code += `# Generated for ${config.projectName}\n\n`;
  code += `from typing import Dict, List, Optional, Any\n`;
  code += `from dataclasses import dataclass, field\n`;
  code += `from datetime import datetime, date, timedelta\n`;
  code += `from enum import Enum\n`;
  code += `import uuid\n`;
  code += `import json\n\n`;

  // Enums
  code += `class TaskStatus(Enum):\n`;
  code += `    BACKLOG = "backlog"\n`;
  code += `    TODO = "todo"\n`;
  code += `    IN_PROGRESS = "in-progress"\n`;
  code += `    IN_REVIEW = "in-review"\n`;
  code += `    DONE = "done"\n`;
  code += `    BLOCKED = "blocked"\n`;
  code += `    CANCELLED = "cancelled"\n\n`;

  code += `class TaskPriority(Enum):\n`;
  code += `    CRITICAL = "critical"\n`;
  code += `    HIGH = "high"\n`;
  code += `    MEDIUM = "medium"\n`;
  code += `    LOW = "low"\n\n`;

  // Dataclasses
  code += `@dataclass\n`;
  code += `class Task:\n`;
  code += `    id: str\n`;
  code += `    title: str\n`;
  code += `    description: str\n`;
  code += `    status: TaskStatus\n`;
  code += `    priority: TaskPriority\n`;
  code += `    type: str\n`;
  code += `    project_id: str\n`;
  code += `    sprint_id: Optional[str] = None\n`;
  code += `    assignee_id: Optional[str] = None\n`;
  code += `    story_points: Optional[int] = None\n`;
  code += `    estimated_hours: float = 0\n`;
  code += `    actual_hours: float = 0\n`;
  code += `    progress: int = 0\n`;
  code += `    created_date: datetime = field(default_factory=datetime.now)\n`;
  code += `    due_date: Optional[datetime] = None\n\n`;

  code += `@dataclass\n`;
  code += `class Sprint:\n`;
  code += `    id: str\n`;
  code += `    name: str\n`;
  code += `    project_id: str\n`;
  code += `    status: str\n`;
  code += `    start_date: datetime\n`;
  code += `    end_date: datetime\n`;
  code += `    goal: str\n`;
  code += `    task_ids: List[str] = field(default_factory=list)\n`;
  code += `    capacity: int = 0\n\n`;

  // Manager Class
  code += `class ProjectManagementManager:\n`;
  code += `    def __init__(self):\n`;
  code += `        self.projects: Dict[str, Any] = {}\n`;
  code += `        self.sprints: Dict[str, Sprint] = {}\n`;
  code += `        self.tasks: Dict[str, Task] = {}\n\n`;

  code += `    def generate_id(self, prefix: str) -> str:\n`;
  code += `        return f"{prefix}-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:8]}"\n\n`;

  code += `    def create_task(\n`;
  code += `        self,\n`;
  code += `        title: str,\n`;
  code += `        description: str,\n`;
  code += `        project_id: str,\n`;
  code += `        priority: TaskPriority,\n`;
  code += `        task_type: str,\n`;
  code += `        estimated_hours: float = 0,\n`;
  code += `        **kwargs\n`;
  code += `    ) -> Task:\n`;
  code += `        task_id = self.generate_id("task")\n`;
  code += `        task = Task(\n`;
  code += `            id=task_id,\n`;
  code += `            title=title,\n`;
  code += `            description=description,\n`;
  code += `            status=TaskStatus.TODO,\n`;
  code += `            priority=priority,\n`;
  code += `            type=task_type,\n`;
  code += `            project_id=project_id,\n`;
  code += `            estimated_hours=estimated_hours\n`;
  code += `        )\n`;
  code += `        self.tasks[task_id] = task\n`;
  code += `        return task\n\n`;

  code += `    def update_task(self, task_id: str, **updates) -> Optional[Task]:\n`;
  code += `        task = self.tasks.get(task_id)\n`;
  code += `        if not task:\n`;
  code += `            return None\n\n`;
  code += `        for key, value in updates.items():\n`;
  code += `            setattr(task, key, value)\n\n`;
  code += `        return task\n\n`;

  code += `    def create_sprint(\n`;
  code += `        self,\n`;
  code += `        name: str,\n`;
  code += `        project_id: str,\n`;
  code += `        start_date: datetime,\n`;
  code += `        end_date: datetime,\n`;
  code += `        goal: str,\n`;
  code += `        capacity: int = 0\n`;
  code += `    ) -> Sprint:\n`;
  code += `        sprint_id = self.generate_id("sprint")\n`;
  code += `        sprint = Sprint(\n`;
  code += `            id=sprint_id,\n`;
  code += `            name=name,\n`;
  code += `            project_id=project_id,\n`;
  code += `            status="planning",\n`;
  code += `            start_date=start_date,\n`;
  code += `            end_date=end_date,\n`;
  code += `            goal=goal,\n`;
  code += `            capacity=capacity\n`;
  code += `        )\n`;
  code += `        self.sprints[sprint_id] = sprint\n`;
  code += `        return sprint\n\n`;

  code += `    def start_sprint(self, sprint_id: str) -> Optional[Sprint]:\n`;
  code += `        sprint = self.sprints.get(sprint_id)\n`;
  code += `        if not sprint:\n`;
  code += `            return None\n\n`;
  code += `        sprint.status = "active"\n`;
  code += `        return sprint\n\n`;

  code += `    def list_tasks(self, project_id: Optional[str] = None) -> List[Task]:\n`;
  code += `        tasks = list(self.tasks.values())\n`;
  code += `        if project_id:\n`;
  code += `            tasks = [t for t in tasks if t.project_id == project_id]\n`;
  code += `        return sorted(tasks, key=lambda t: t.created_date, reverse=True)\n\n`;

  code += `    def list_sprints(self, project_id: Optional[str] = None) -> List[Sprint]:\n`;
  code += `        sprints = list(self.sprints.values())\n`;
  code += `        if project_id:\n`;
  code += `            sprints = [s for s in sprints if s.project_id == project_id]\n`;
  code += `        return sorted(sprints, key=lambda s: s.start_date)\n\n`;

  code += `    def get_summary(self, project_id: str) -> Dict[str, Any]:\n`;
  code += `        tasks = self.list_tasks(project_id)\n`;
  code += `        return {\n`;
  code += `            "totalTasks": len(tasks),\n`;
  code += `            "completedTasks": sum(1 for t in tasks if t.status == TaskStatus.DONE),\n`;
  code += `            "inProgressTasks": sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS),\n`;
  code += `            "velocity": self.calculate_velocity(project_id)\n`;
  code += `        }\n\n`;

  code += `    def calculate_velocity(self, project_id: str) -> int:\n`;
  code += `        sprints = [\n`;
  code += `            s for s in self.sprints.values()\n`;
  code += `            if s.project_id == project_id and s.status == "completed"\n`;
  code += `        ][:3]\n`;
  code += `        return len(sprints)\n`;

  return code;
}

// Write files
export async function writeProjectMgmtFiles(
  config: ProjectManagementConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  const markdown = generateProjectMgmtMarkdown(config);
  await fs.writeFile(path.join(outputDir, 'PROJECT_MGMT_GUIDE.md'), markdown);

  // Write config JSON
  await fs.writeFile(path.join(outputDir, 'pm-config.json'), JSON.stringify(config, null, 2));

  // Write Terraform configs for enabled providers
  for (const provider of config.providers) {
    const terraformDir = path.join(outputDir, 'terraform', provider);
    await fs.ensureDir(terraformDir);

    const tf = generateProjectMgmtTerraform(config, provider);
    await fs.writeFile(path.join(terraformDir, 'main.tf'), tf);
  }

  // Write manager code
  if (language === 'typescript') {
    const tsCode = generateTypeScriptManager(config);
    await fs.writeFile(path.join(outputDir, 'pm-manager.ts'), tsCode);

    const packageJson = {
      name: `${config.projectName}-pm`,
      version: '1.0.0',
      description: 'Project Management and Tracking with Metrics and Dashboards',
      main: 'pm-manager.ts',
      scripts: {
        'test': 'ts-node pm-manager.ts test',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonManager(config);
    await fs.writeFile(path.join(outputDir, 'pm_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'google-cloud-storage>=2.13.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }
}

// Display configuration
export function displayProjectMgmtConfig(config: ProjectManagementConfig, language: 'typescript' | 'python', outputDir: string): void {
  console.log(chalk.cyan('\n✨ Project Management and Tracking Systems'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Organization:'), config.organization);
  console.log(chalk.yellow('Language:'), language);
  console.log(chalk.yellow('Output:'), outputDir);
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));

  console.log(chalk.cyan('\n📊 Configuration:'));
  console.log(chalk.gray('  Projects:'), config.projects.length);
  console.log(chalk.gray('  Sprints:'), config.sprints.length);
  console.log(chalk.gray('  Tasks:'), config.tasks.length);
  console.log(chalk.gray('  Issues:'), config.issues.length);
  console.log(chalk.gray('  Teams:'), config.teams.length);
  console.log(chalk.gray('  Dashboards:'), config.dashboards.length);

  console.log(chalk.cyan('\n⚙️  Settings:'));
  console.log(chalk.gray('  Enable Sprints:'), config.settings.enableSprints ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Sprint Duration:'), config.settings.sprintDuration + ' weeks');
  console.log(chalk.gray('  Enable Time Tracking:'), config.settings.enableTimeTracking ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Issue Tracking:'), config.settings.enableIssueTracking ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Burndown:'), config.settings.enableBurndown ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Velocity:'), config.settings.enableVelocity ? chalk.green('Yes') : chalk.red('No'));

  console.log(chalk.cyan('\n☁️  Cloud Providers:'));
  for (const provider of config.providers) {
    console.log(chalk.gray(`  - ${provider.toUpperCase()}`));
  }

  console.log(chalk.cyan('\n📁 Output Files:'));
  console.log(chalk.gray(`  - PROJECT_MGMT_GUIDE.md`));
  console.log(chalk.gray(`  - pm-config.json`));
  console.log(chalk.gray(`  - ${language === 'typescript' ? 'pm-manager.ts' : 'pm_manager.py'}`));
  console.log(chalk.gray(`  - terraform/{provider}/main.tf`));

  console.log(chalk.gray('\n────────────────────────────────────────────────────────────\n'));
}

// Create example configuration
export function createExampleProjectMgmtConfig(): ProjectManagementConfig {
  return {
    projectName: 'my-project-mgmt',
    organization: 'Acme Corp',
    providers: ['aws', 'azure', 'gcp'],
    settings: {
      enableSprints: true,
      sprintDuration: 2,
      sprintPointsEnabled: true,
      enableTimeTracking: true,
      requireTimeEstimate: true,
      enableIssueTracking: true,
      autoAssignIssues: false,
      enableNotifications: true,
      notificationChannels: ['email' as const, 'slack' as const],
      enableReporting: true,
      reportFrequency: 'sprint',
      enableBurndown: true,
      enableVelocity: true,
      velocitySprints: 3,
      enableCapacityPlanning: true,
      defaultTeamSize: 7,
      enableLabels: true,
      enableEpics: true,
      enableSubtasks: true,
      maxSubtaskDepth: 3,
      enableDependencies: true,
      enableBlockedStatus: true,
      requireCompletionForSprint: true,
    },
    projects: [
      {
        id: 'proj-001',
        name: 'E-Commerce Platform',
        description: 'Build a modern e-commerce platform with microservices architecture',
        status: 'active' as ProjectStatus,
        type: 'software' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        createdDate: new Date('2024-01-01'),
        createdBy: 'pm-admin',
        budget: 500000,
        budgetCurrency: 'USD',
        estimatedHours: 10000,
        actualHours: 6500,
        ownerId: 'user-001',
        ownerName: 'Jane Smith',
        teamId: 'team-001',
        teamName: 'Engineering Team A',
        progress: 65,
        tasksCompleted: 45,
        tasksTotal: 70,
        sprintsEnabled: true,
        activeSprintId: 'sprint-003',
        tags: ['ecommerce', 'microservices', 'react', 'nodejs'],
        dependsOn: [],
        blocks: [],
        velocity: 23,
      },
      {
        id: 'proj-002',
        name: 'Mobile App Development',
        description: 'Cross-platform mobile application for customer engagement',
        status: 'active' as ProjectStatus,
        type: 'software' as const,
        startDate: new Date('2024-03-01'),
        createdDate: new Date('2024-02-15'),
        createdBy: 'pm-admin',
        budget: 300000,
        budgetCurrency: 'USD',
        estimatedHours: 6000,
        actualHours: 2100,
        ownerId: 'user-002',
        ownerName: 'Bob Johnson',
        teamId: 'team-002',
        teamName: 'Mobile Team',
        progress: 35,
        tasksCompleted: 18,
        tasksTotal: 50,
        sprintsEnabled: true,
        tags: ['mobile', 'react-native', 'ios', 'android'],
        dependsOn: ['proj-001'],
        blocks: [],
      },
      {
        id: 'proj-003',
        name: 'Infrastructure Migration',
        description: 'Migrate legacy infrastructure to cloud-native architecture',
        status: 'planning' as ProjectStatus,
        type: 'infrastructure' as const,
        startDate: new Date('2024-06-01'),
        createdDate: new Date('2024-05-01'),
        createdBy: 'pm-admin',
        budget: 200000,
        budgetCurrency: 'USD',
        estimatedHours: 4000,
        actualHours: 0,
        ownerId: 'user-003',
        ownerName: 'Mike Davis',
        teamId: 'team-001',
        teamName: 'Engineering Team A',
        progress: 0,
        tasksCompleted: 0,
        tasksTotal: 25,
        sprintsEnabled: false,
        tags: ['infrastructure', 'aws', 'kubernetes', 'migration'],
        dependsOn: [],
        blocks: ['proj-001'],
      },
    ],
    sprints: [
      {
        id: 'sprint-001',
        name: 'Sprint 1 - Foundation',
        description: 'Initial sprint to set up project foundation',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        status: 'completed' as SprintStatus,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28'),
        createdDate: new Date('2024-01-10'),
        goal: 'Set up development environment and basic project structure',
        sprintPoints: 21,
        taskIds: ['task-001', 'task-002', 'task-003'],
        teamId: 'team-001',
        scrumMaster: 'user-004',
        productOwner: 'user-005',
        capacity: 560,
        allocatedHours: 545,
        completedPoints: 21,
        burndown: [],
        retrospective: 'Good velocity established. Need to improve estimation accuracy.',
        reviewNotes: 'All sprint goals achieved. Team collaboration was excellent.',
      },
      {
        id: 'sprint-002',
        name: 'Sprint 2 - Core Features',
        description: 'Develop core e-commerce features',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        status: 'completed' as SprintStatus,
        startDate: new Date('2024-01-29'),
        endDate: new Date('2024-02-11'),
        createdDate: new Date('2024-01-20'),
        goal: 'Implement product catalog and shopping cart functionality',
        sprintPoints: 23,
        taskIds: ['task-004', 'task-005', 'task-006'],
        teamId: 'team-001',
        scrumMaster: 'user-004',
        productOwner: 'user-005',
        capacity: 560,
        allocatedHours: 558,
        completedPoints: 23,
        burndown: [],
        retrospective: 'Velocity improved. Need to focus on code quality and testing.',
        reviewNotes: 'Sprint goals met with some scope adjustments.',
      },
      {
        id: 'sprint-003',
        name: 'Sprint 3 - Payment Integration',
        description: 'Integrate payment processing and checkout',
        projectId: 'proj-001',
        projectName: 'E-Commerce Platform',
        status: 'active' as SprintStatus,
        startDate: new Date('2024-02-12'),
        endDate: new Date('2024-02-25'),
        createdDate: new Date('2024-02-05'),
        goal: 'Complete payment integration and order processing',
        sprintPoints: 25,
        taskIds: ['task-007', 'task-008', 'task-009', 'task-010'],
        teamId: 'team-001',
        scrumMaster: 'user-004',
        productOwner: 'user-005',
        capacity: 560,
        allocatedHours: 520,
        burndown: [],
      },
    ],
    tasks: [
      {
        id: 'task-001',
        title: 'Set up development environment',
        description: 'Configure development tools, repositories, and CI/CD pipeline',
        status: 'done' as TaskStatus,
        priority: 'high' as TaskPriority,
        type: 'task' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-001',
        storyPoints: 3,
        estimatedHours: 8,
        actualHours: 7,
        assigneeId: 'user-006',
        assigneeName: 'DevOps Engineer',
        reporterId: 'user-004',
        reporterName: 'Scrum Master',
        createdDate: new Date('2024-01-15'),
        updatedDate: new Date('2024-01-20'),
        dueDate: new Date('2024-01-18'),
        completedDate: new Date('2024-01-17'),
        progress: 100,
        subtasksCompleted: 3,
        subtasksTotal: 3,
        dependsOn: [],
        blocks: [],
        labels: ['devops', 'setup'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Environment is reproducible', 'CI/CD pipeline is functional', 'Documentation is complete'],
        relatedIssues: [],
      },
      {
        id: 'task-002',
        title: 'Design database schema',
        description: 'Design normalized database schema for e-commerce platform',
        status: 'done' as TaskStatus,
        priority: 'critical' as TaskPriority,
        type: 'task' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-001',
        storyPoints: 5,
        estimatedHours: 16,
        actualHours: 18,
        assigneeId: 'user-007',
        assigneeName: 'Database Architect',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-01-15'),
        updatedDate: new Date('2024-01-22'),
        dueDate: new Date('2024-01-19'),
        completedDate: new Date('2024-01-21'),
        progress: 100,
        subtasksCompleted: 5,
        subtasksTotal: 5,
        dependsOn: ['task-001'],
        blocks: [],
        labels: ['database', 'design'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Schema is normalized to 3NF', 'Indexes are optimized', 'Migration scripts are ready'],
        relatedIssues: ['task-003'],
      },
      {
        id: 'task-003',
        title: 'Create API specifications',
        description: 'Define RESTful API endpoints and OpenAPI documentation',
        status: 'done' as TaskStatus,
        priority: 'high' as TaskPriority,
        type: 'task' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-001',
        storyPoints: 8,
        estimatedHours: 24,
        actualHours: 22,
        assigneeId: 'user-008',
        assigneeName: 'Backend Lead',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-01-16'),
        updatedDate: new Date('2024-01-26'),
        dueDate: new Date('2024-01-25'),
        completedDate: new Date('2024-01-25'),
        progress: 100,
        subtasksCompleted: 8,
        subtasksTotal: 8,
        dependsOn: ['task-002'],
        blocks: [],
        labels: ['api', 'backend', 'openapi'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['OpenAPI spec is complete', 'All endpoints documented', 'Examples provided'],
        relatedIssues: ['task-004'],
      },
      {
        id: 'task-004',
        title: 'Implement user authentication',
        description: 'Build secure user authentication with JWT tokens',
        status: 'done' as TaskStatus,
        priority: 'critical' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-002',
        epicId: 'epic-001',
        storyPoints: 8,
        estimatedHours: 32,
        actualHours: 30,
        assigneeId: 'user-008',
        assigneeName: 'Backend Lead',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-01-28'),
        updatedDate: new Date('2024-02-08'),
        dueDate: new Date('2024-02-06'),
        completedDate: new Date('2024-02-07'),
        progress: 100,
        subtasksCompleted: 10,
        subtasksTotal: 10,
        dependsOn: ['task-003'],
        blocks: [],
        labels: ['security', 'auth', 'jwt'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['JWT tokens work correctly', 'Password reset flow is functional', 'MFA is supported'],
        relatedIssues: [],
      },
      {
        id: 'task-005',
        title: 'Build product catalog API',
        description: 'Create CRUD endpoints for product catalog management',
        status: 'done' as TaskStatus,
        priority: 'high' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-002',
        epicId: 'epic-001',
        storyPoints: 5,
        estimatedHours: 20,
        actualHours: 19,
        assigneeId: 'user-009',
        assigneeName: 'Backend Developer',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-01-29'),
        updatedDate: new Date('2024-02-07'),
        dueDate: new Date('2024-02-08'),
        completedDate: new Date('2024-02-06'),
        progress: 100,
        subtasksCompleted: 6,
        subtasksTotal: 6,
        dependsOn: ['task-003'],
        blocks: [],
        labels: ['api', 'catalog', 'backend'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['CRUD operations work', 'Pagination is implemented', 'Search functionality is working'],
        relatedIssues: ['task-006'],
      },
      {
        id: 'task-006',
        title: 'Build shopping cart API',
        description: 'Implement shopping cart with session management',
        status: 'done' as TaskStatus,
        priority: 'high' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-002',
        epicId: 'epic-002',
        storyPoints: 8,
        estimatedHours: 28,
        actualHours: 30,
        assigneeId: 'user-010',
        assigneeName: 'Backend Developer',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-01-29'),
        updatedDate: new Date('2024-02-09'),
        dueDate: new Date('2024-02-08'),
        completedDate: new Date('2024-02-09'),
        progress: 100,
        subtasksCompleted: 8,
        subtasksTotal: 8,
        dependsOn: ['task-005'],
        blocks: [],
        labels: ['api', 'cart', 'backend'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Cart persists across sessions', 'Items can be added/removed', 'Quantities are validated'],
        relatedIssues: [],
      },
      {
        id: 'task-007',
        title: 'Integrate payment gateway',
        description: 'Connect Stripe for payment processing',
        status: 'in-progress' as TaskStatus,
        priority: 'critical' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-003',
        epicId: 'epic-002',
        storyPoints: 8,
        estimatedHours: 32,
        actualHours: 18,
        assigneeId: 'user-008',
        assigneeName: 'Backend Lead',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-02-10'),
        updatedDate: new Date('2024-02-15'),
        dueDate: new Date('2024-02-20'),
        progress: 56,
        subtasksCompleted: 5,
        subtasksTotal: 9,
        dependsOn: ['task-006'],
        blocks: [],
        labels: ['payment', 'stripe', 'integration'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Stripe checkout works', 'Webhooks are handled', 'Refunds are supported'],
        relatedIssues: ['task-008'],
      },
      {
        id: 'task-008',
        title: 'Build order management',
        description: 'Create order lifecycle management system',
        status: 'in-progress' as TaskStatus,
        priority: 'high' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-003',
        epicId: 'epic-002',
        storyPoints: 8,
        estimatedHours: 28,
        actualHours: 12,
        assigneeId: 'user-009',
        assigneeName: 'Backend Developer',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-02-11'),
        updatedDate: new Date('2024-02-15'),
        dueDate: new Date('2024-02-22'),
        progress: 43,
        subtasksCompleted: 4,
        subtasksTotal: 8,
        dependsOn: ['task-007'],
        blocks: [],
        labels: ['orders', 'backend', 'workflow'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Order states are tracked', 'Notifications are sent', 'History is maintained'],
        relatedIssues: ['task-009'],
      },
      {
        id: 'task-009',
        title: 'Implement order confirmation emails',
        description: 'Send order confirmation and status update emails',
        status: 'todo' as TaskStatus,
        priority: 'medium' as TaskPriority,
        type: 'task' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-003',
        storyPoints: 3,
        estimatedHours: 12,
        actualHours: 0,
        assigneeId: 'user-011',
        assigneeName: 'Frontend Developer',
        reporterId: 'user-005',
        reporterName: 'Product Owner',
        createdDate: new Date('2024-02-12'),
        updatedDate: new Date('2024-02-12'),
        dueDate: new Date('2024-02-23'),
        progress: 0,
        subtasksCompleted: 0,
        subtasksTotal: 4,
        dependsOn: ['task-008'],
        blocks: [],
        labels: ['email', 'notifications', 'frontend'],
        attachments: [],
        comments: [],
        history: [],
        acceptanceCriteria: ['Confirmation email is sent', 'Status updates work', 'Email templates are branded'],
        relatedIssues: [],
      },
      {
        id: 'task-010',
        title: 'Create admin dashboard',
        description: 'Build admin interface for order and product management',
        status: 'blocked' as TaskStatus,
        priority: 'medium' as TaskPriority,
        type: 'feature' as IssueType,
        projectId: 'proj-001',
        sprintId: 'sprint-003',
        storyPoints: 5,
        estimatedHours: 24,
        actualHours: 8,
        assigneeId: 'user-012',
        assigneeName: 'Frontend Developer',
        reporterId: 'user-004',
        reporterName: 'Scrum Master',
        createdDate: new Date('2024-02-12'),
        updatedDate: new Date('2024-02-15'),
        dueDate: new Date('2024-02-24'),
        progress: 33,
        subtasksCompleted: 2,
        subtasksTotal: 7,
        dependsOn: ['task-005'],
        blocks: [],
        labels: ['admin', 'dashboard', 'frontend'],
        attachments: [],
        comments: [
          {
            id: 'comment-001',
            authorId: 'user-012',
            authorName: 'Frontend Developer',
            content: 'Blocked on API design finalization for admin endpoints',
            createdDate: new Date('2024-02-15'),
          },
        ],
        history: [],
        acceptanceCriteria: ['Products can be managed', 'Orders can be viewed/updated', 'Dashboard is responsive'],
        relatedIssues: [],
      },
    ],
    issues: [
      {
        id: 'issue-001',
        title: 'Memory leak in cart service',
        description: 'Cart service is experiencing memory leaks under load',
        type: 'bug' as IssueType,
        severity: 'high' as IssueSeverity,
        status: 'in-progress' as TaskStatus,
        priority: 'critical' as TaskPriority,
        projectId: 'proj-001',
        assigneeId: 'user-008',
        assigneeName: 'Backend Lead',
        reporterId: 'user-013',
        reporterName: 'QA Engineer',
        createdDate: new Date('2024-02-14'),
        updatedDate: new Date('2024-02-15'),
        dueDate: new Date('2024-02-16'),
        sprintId: 'sprint-003',
        progress: 50,
        environment: 'Production',
        stepsToReproduce: '1. Add 100 items to cart\n2. Navigate between pages\n3. Observe memory usage',
        expectedBehavior: 'Memory usage should remain stable',
        actualBehavior: 'Memory usage increases with each page navigation',
        labels: ['bug', 'memory', 'cart'],
        attachments: [],
        comments: [],
      },
      ],
    timeEntries: [
      {
        id: 'time-001',
        taskId: 'task-001',
        taskTitle: 'Set up development environment',
        projectId: 'proj-001',
        userId: 'user-006',
        userName: 'DevOps Engineer',
        type: 'development' as TimeEntryType,
        date: new Date('2024-01-15T09:00:00'),
        duration: 240, // 4 hours
        billable: true,
        description: 'Environment setup and tool configuration',
        approved: true,
        approvedBy: 'user-004',
        approvedDate: new Date('2024-01-16'),
      },
      {
        id: 'time-002',
        taskId: 'task-001',
        taskTitle: 'Set up development environment',
        projectId: 'proj-001',
        userId: 'user-006',
        userName: 'DevOps Engineer',
        type: 'documentation' as TimeEntryType,
        date: new Date('2024-01-16T10:00:00'),
        duration: 180, // 3 hours
        billable: true,
        description: 'Documentation for environment setup',
        approved: true,
        approvedBy: 'user-004',
        approvedDate: new Date('2024-01-17'),
      },
    ],
    dashboards: [
      {
        id: 'dash-001',
        name: 'Sprint Dashboard',
        description: 'Real-time sprint progress dashboard',
        type: 'sprint' as DashboardType,
        scope: ['proj-001'],
        widgets: [
          {
            id: 'widget-001',
            type: 'burndown',
            title: 'Sprint Burndown',
            position: { row: 0, column: 0 },
            size: { width: 2, height: 1 },
            config: { sprintId: 'sprint-003' },
          },
          {
            id: 'widget-002',
            type: 'task-status',
            title: 'Task Status Distribution',
            position: { row: 0, column: 2 },
            size: { width: 1, height: 1 },
            config: { sprintId: 'sprint-003' },
          },
          {
            id: 'widget-003',
            type: 'velocity',
            title: 'Team Velocity',
            position: { row: 1, column: 0 },
            size: { width: 2, height: 1 },
            config: { teamId: 'team-001', sprintCount: 3 },
          },
        ],
        refreshInterval: 15,
        autoRefresh: true,
        owner: 'user-004',
        viewers: ['user-005', 'user-006', 'user-007'],
        editors: ['user-004'],
        layout: 'grid',
        filters: {
          projects: ['proj-001'],
          sprints: ['sprint-003'],
        },
        createdDate: new Date('2024-02-01'),
        updatedDate: new Date('2024-02-01'),
      },
    ],
    teams: [
      {
        id: 'team-001',
        name: 'Engineering Team A',
        description: 'Backend and frontend development team',
        members: [
          {
            userId: 'user-006',
            userName: 'DevOps Engineer',
            email: 'devops@acme.com',
            role: 'architect' as const,
            skills: ['docker', 'kubernetes', 'aws', 'ci-cd'],
            capacity: 120,
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=devops',
          },
          {
            userId: 'user-007',
            userName: 'Database Architect',
            email: 'dba@acme.com',
            role: 'architect' as const,
            skills: ['postgresql', 'mongodb', 'redis', 'database-design'],
            capacity: 120,
          },
          {
            userId: 'user-008',
            userName: 'Backend Lead',
            email: 'backend-lead@acme.com',
            role: 'developer' as const,
            skills: ['nodejs', 'typescript', 'express', 'nestjs'],
            capacity: 120,
          },
          {
            userId: 'user-009',
            userName: 'Backend Developer',
            email: 'backend-dev@acme.com',
            role: 'developer' as const,
            skills: ['nodejs', 'python', 'api-design'],
            capacity: 120,
          },
          {
            userId: 'user-010',
            userName: 'Backend Developer',
            email: 'backend-dev2@acme.com',
            role: 'developer' as const,
            skills: ['nodejs', 'graphql', 'mongodb'],
            capacity: 120,
          },
          {
            userId: 'user-011',
            userName: 'Frontend Developer',
            email: 'frontend-dev@acme.com',
            role: 'developer' as const,
            skills: ['react', 'typescript', 'tailwind', 'nextjs'],
            capacity: 120,
          },
          {
            userId: 'user-012',
            userName: 'Frontend Developer',
            email: 'frontend-dev2@acme.com',
            role: 'developer' as const,
            skills: ['react', 'vue', 'typescript', 'css'],
            capacity: 120,
          },
        ],
        leadId: 'user-004',
        leadName: 'Scrum Master',
        projectIds: ['proj-001', 'proj-003'],
        capacity: 840, // 7 members * 120 hours
        velocityHistory: [21, 23],
        skills: ['backend', 'frontend', 'devops', 'database'],
        locations: ['US-East', 'US-West'],
        timezone: 'America/New_York',
      },
    ],
    milestones: [
      {
        id: 'milestone-001',
        name: 'MVP Release',
        description: 'Minimum viable product release for e-commerce platform',
        projectId: 'proj-001',
        targetDate: new Date('2024-06-30'),
        completedDate: undefined,
        status: 'in-progress' as const,
        taskIds: ['task-001', 'task-002', 'task-003', 'task-004', 'task-005', 'task-006'],
        progress: 67,
        dependsOn: [],
      },
      {
        id: 'milestone-002',
        name: 'Beta Launch',
        description: 'Beta launch with payment processing',
        projectId: 'proj-001',
        targetDate: new Date('2024-09-30'),
        completedDate: undefined,
        status: 'planned' as const,
        taskIds: ['task-007', 'task-008', 'task-009'],
        progress: 0,
        dependsOn: ['milestone-001'],
      },
    ],
  };
}
