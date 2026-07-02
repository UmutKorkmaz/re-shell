// Project Management and Tracking Systems with Metrics and Dashboards

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions

/**
 * Represents the lifecycle status of a task within the project management system.
 */
export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done' | 'blocked' | 'cancelled';

/**
 * Represents the priority level assigned to a task or issue.
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Represents the lifecycle status of a sprint.
 */
export type SprintStatus = 'planning' | 'active' | 'review' | 'retrospective' | 'completed';

/**
 * Represents the lifecycle status of a project.
 */
export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed' | 'archived';

/**
 * Represents the category of an issue within the tracking system.
 */
export type IssueType = 'bug' | 'feature' | 'improvement' | 'task' | 'story' | 'epic';

/**
 * Represents the severity level of an issue.
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Represents the category of a time tracking entry.
 */
export type TimeEntryType = 'development' | 'meeting' | 'review' | 'planning' | 'testing' | 'documentation' | 'other';

/**
 * Represents the scope/category of a dashboard.
 */
export type DashboardType = 'sprint' | 'project' | 'team' | 'portfolio' | 'custom';

/**
 * Top-level configuration object for the project management and tracking system.
 */
export interface ProjectManagementConfig {
  /** The name of the project management project. */
  projectName: string;
  /** The organization that owns the project. */
  organization: string;
  /** The list of cloud providers for which Terraform infrastructure is generated. */
  providers: Array<'aws' | 'azure' | 'gcp'>;
  /** Global settings controlling features such as sprints, time tracking, and reporting. */
  settings: PMSettings;
  /** The collection of projects being managed. */
  projects: Project[];
  /** The collection of sprints across all projects. */
  sprints: Sprint[];
  /** The collection of tasks across all projects. */
  tasks: Task[];
  /** The collection of tracked issues across all projects. */
  issues: Issue[];
  /** The collection of time tracking entries. */
  timeEntries: TimeEntry[];
  /** The collection of custom dashboards. */
  dashboards: Dashboard[];
  /** The collection of teams. */
  teams: Team[];
  /** The collection of milestones across all projects. */
  milestones: Milestone[];
}

/**
 * Settings that control which project management features are enabled and how they behave.
 */
export interface PMSettings {
  /** Whether sprint planning and management is enabled. */
  enableSprints: boolean;
  /** Duration of each sprint in weeks. */
  sprintDuration: number; // weeks
  /** Whether story points are used for sprint planning. */
  sprintPointsEnabled: boolean;
  /** Whether time tracking is enabled. */
  enableTimeTracking: boolean;
  /** Whether a time estimate is required for every task. */
  requireTimeEstimate: boolean;
  /** Whether issue tracking is enabled. */
  enableIssueTracking: boolean;
  /** Whether issues are automatically assigned to team members. */
  autoAssignIssues: boolean;
  /** Whether notifications are sent for important events. */
  enableNotifications: boolean;
  /** The channels through which notifications are delivered. */
  notificationChannels: Array<'email' | 'slack' | 'teams' | 'webhook'>;
  /** Whether periodic reporting is enabled. */
  enableReporting: boolean;
  /** How often reports are generated. */
  reportFrequency: 'daily' | 'weekly' | 'sprint';
  /** Whether burndown charts are generated for sprints. */
  enableBurndown: boolean;
  /** Whether velocity metrics are calculated. */
  enableVelocity: boolean;
  /** The number of completed sprints used to compute the velocity average. */
  velocitySprints: number; // number of sprints to average
  /** Whether team capacity planning is enabled. */
  enableCapacityPlanning: boolean;
  /** The default number of members for a new team. */
  defaultTeamSize: number;
  /** Whether labels can be applied to tasks and issues. */
  enableLabels: boolean;
  /** Whether epic-level grouping of tasks is enabled. */
  enableEpics: boolean;
  /** Whether subtasks are supported. */
  enableSubtasks: boolean;
  /** The maximum nesting depth allowed for subtasks. */
  maxSubtaskDepth: number;
  /** Whether task dependencies are tracked. */
  enableDependencies: boolean;
  /** Whether the "blocked" status is available for tasks. */
  enableBlockedStatus: boolean;
  /** Whether all sprint tasks must be completed before the sprint can be closed. */
  requireCompletionForSprint: boolean;
}

/**
 * Represents a project within the project management system.
 */
export interface Project {
  /** Unique identifier for the project. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** A short description of the project's purpose. */
  description: string;
  /** Current lifecycle status of the project. */
  status: ProjectStatus;
  /** The category of work the project represents. */
  type: 'software' | 'infrastructure' | 'documentation' | 'research' | 'custom';

  // Dates
  /** The date the project is scheduled to start. */
  startDate: Date;
  /** The date the project is scheduled to end, if known. */
  endDate?: Date;
  /** The date the project record was created. */
  createdDate: Date;
  /** The identifier of the user who created the project. */
  createdBy: string;

  // Planning
  /** The allocated budget for the project, if any. */
  budget?: number;
  /** The currency code for the budget amount. */
  budgetCurrency: string;
  /** The total estimated hours required to complete the project. */
  estimatedHours: number;
  /** The total actual hours logged against the project so far. */
  actualHours: number;

  // Team
  /** The identifier of the project owner. */
  ownerId: string;
  /** The display name of the project owner. */
  ownerName: string;
  /** The identifier of the team assigned to the project. */
  teamId: string;
  /** The display name of the assigned team. */
  teamName: string;

  // Progress
  /** Completion percentage of the project, ranging from 0 to 100. */
  progress: number; // 0-100
  /** The number of tasks within the project that are completed. */
  tasksCompleted: number;
  /** The total number of tasks within the project. */
  tasksTotal: number;

  // Configuration
  /** Whether sprint management is enabled for this project. */
  sprintsEnabled: boolean;
  /** The identifier of the currently active sprint, if any. */
  activeSprintId?: string;

  // Tags
  /** Free-form tags used to categorize the project. */
  tags: string[];

  // Metrics
  /** The average velocity (story points per sprint) for the project, if computed. */
  velocity?: number;
  /** Burndown data points for the project, if available. */
  burndown?: BurndownData[];

  // Dependencies
  /** Identifiers of projects that this project depends on. */
  dependsOn: string[]; // project IDs
  /** Identifiers of projects that are blocked by this project. */
  blocks: string[]; // project IDs
}

/**
 * A single data point in a burndown chart, comparing ideal vs. actual remaining work.
 */
export interface BurndownData {
  /** The date the data point corresponds to. */
  date: Date;
  /** The ideal amount of work remaining on this date for a linear burndown. */
  idealRemaining: number;
  /** The actual amount of work remaining on this date. */
  actualRemaining: number;
}

/**
 * Represents a sprint within a project, including its goals, tasks, team, and metrics.
 */
export interface Sprint {
  /** Unique identifier for the sprint. */
  id: string;
  /** Human-readable sprint name. */
  name: string;
  /** A short description of the sprint's focus. */
  description: string;
  /** The identifier of the project this sprint belongs to. */
  projectId: string;
  /** The name of the project this sprint belongs to. */
  projectName: string;
  /** Current lifecycle status of the sprint. */
  status: SprintStatus;

  // Dates
  /** The date the sprint starts. */
  startDate: Date;
  /** The date the sprint ends. */
  endDate: Date;
  /** The date the sprint record was created. */
  createdDate: Date;

  // Goals
  /** The stated goal or objective for the sprint. */
  goal: string;
  /** The total story points committed to for the sprint, if using points. */
  sprintPoints?: number;

  // Tasks
  /** Identifiers of the tasks included in this sprint. */
  taskIds: string[];

  // Team
  /** The identifier of the team executing the sprint. */
  teamId: string;
  /** The identifier of the scrum master for the sprint. */
  scrumMaster: string;
  /** The identifier of the product owner for the sprint. */
  productOwner: string;

  // Capacity
  /** The total available capacity for the sprint, in hours. */
  capacity: number; // hours
  /** The total hours allocated to tasks within the sprint. */
  allocatedHours: number;

  // Metrics
  /** The number of story points actually completed during the sprint, if known. */
  completedPoints?: number;
  /** Burndown data points tracking progress throughout the sprint. */
  burndown: BurndownData[];

  // Review
  /** Retrospective notes captured at the end of the sprint. */
  retrospective?: string;
  /** Additional review notes about sprint outcomes. */
  reviewNotes?: string;
}

/**
 * Represents an individual unit of work (task) within a project.
 */
export interface Task {
  /** Unique identifier for the task. */
  id: string;
  /** Short human-readable title of the task. */
  title: string;
  /** Detailed description of the work to be done. */
  description: string;
  /** Current lifecycle status of the task. */
  status: TaskStatus;
  /** The priority level assigned to the task. */
  priority: TaskPriority;
  /** The category of the task. */
  type: IssueType;

  // Assignment
  /** The identifier of the project this task belongs to. */
  projectId: string;
  /** The identifier of the sprint this task is assigned to, if any. */
  sprintId?: string;
  /** The identifier of the epic this task belongs to, if any. */
  epicId?: string;
  /** The identifier of the parent task if this is a subtask. */
  parentId?: string;

  // Estimates
  /** The estimated story points for the task, if using points. */
  storyPoints?: number;
  /** The estimated hours required to complete the task. */
  estimatedHours: number;
  /** The actual hours logged against the task so far. */
  actualHours: number;

  // Assignment
  /** The identifier of the user assigned to the task, if any. */
  assigneeId?: string;
  /** The display name of the assigned user, if any. */
  assigneeName?: string;
  /** The identifier of the user who reported/created the task. */
  reporterId: string;
  /** The display name of the reporting user. */
  reporterName: string;

  // Dates
  /** The date the task was created. */
  createdDate: Date;
  /** The date the task was last updated. */
  updatedDate: Date;
  /** The date by which the task is due, if any. */
  dueDate?: Date;
  /** The date work on the task started, if any. */
  startDate?: Date;
  /** The date the task was completed, if any. */
  completedDate?: Date;

  // Dependencies
  /** Identifiers of tasks that must be completed before this task can start. */
  dependsOn: string[]; // task IDs
  /** Identifiers of tasks that are blocked by this task. */
  blocks: string[]; // task IDs

  // Progress
  /** Completion percentage of the task, ranging from 0 to 100. */
  progress: number; // 0-100
  /** The number of subtasks that are completed. */
  subtasksCompleted: number;
  /** The total number of subtasks. */
  subtasksTotal: number;

  // Labels
  /** Free-form labels applied to the task for categorization. */
  labels: string[];

  // Attachments
  /** Files and links attached to the task. */
  attachments: TaskAttachment[];

  // Comments
  /** Discussion comments on the task. */
  comments: TaskComment[];

  // History
  /** Audit trail of changes made to the task. */
  history: TaskHistoryEntry[];

  // Validation
  /** Criteria that must be met for the task to be considered complete. */
  acceptanceCriteria: string[];

  // Links
  /** Identifiers of related tasks/issues. */
  relatedIssues: string[]; // task IDs
}

/**
 * Represents a file or link attached to a task or issue.
 */
export interface TaskAttachment {
  /** Unique identifier for the attachment. */
  id: string;
  /** Display name of the attachment. */
  name: string;
  /** The kind of content the attachment represents. */
  type: 'image' | 'document' | 'link' | 'code' | 'other';
  /** The URL or path to the attachment resource. */
  url: string;
  /** The size of the attachment in bytes, if applicable. */
  size?: number;
  /** The identifier of the user who uploaded the attachment. */
  uploadedBy: string;
  /** The date the attachment was uploaded. */
  uploadedDate: Date;
}

/**
 * Represents a comment made by a user on a task or issue.
 */
export interface TaskComment {
  /** Unique identifier for the comment. */
  id: string;
  /** The identifier of the user who authored the comment. */
  authorId: string;
  /** The display name of the comment author. */
  authorName: string;
  /** The body text of the comment. */
  content: string;
  /** The date the comment was created. */
  createdDate: Date;
  /** The date the comment was last edited, if applicable. */
  updatedDate?: Date;
}

/**
 * Represents a single entry in the audit history of a task.
 */
export interface TaskHistoryEntry {
  /** The timestamp when the change occurred. */
  timestamp: Date;
  /** The identifier of the user who made the change. */
  userId: string;
  /** The display name of the user who made the change. */
  userName: string;
  /** A description of the action taken (e.g. "created", "updated"). */
  action: string;
  /** The name of the field that was changed, if applicable. */
  field?: string;
  /** The previous value of the changed field, if applicable. */
  oldValue?: string;
  /** The new value of the changed field, if applicable. */
  newValue?: string;
}

/**
 * Represents a tracked issue (bug, feature request, etc.) within a project.
 */
export interface Issue {
  /** Unique identifier for the issue. */
  id: string;
  /** Short human-readable title of the issue. */
  title: string;
  /** Detailed description of the issue. */
  description: string;
  /** The category of the issue. */
  type: IssueType;
  /** The severity level of the issue. */
  severity: IssueSeverity;
  /** Current lifecycle status of the issue. */
  status: TaskStatus;
  /** The priority level assigned to the issue. */
  priority: TaskPriority;

  // Assignment
  /** The identifier of the project this issue belongs to. */
  projectId: string;
  /** The identifier of the user assigned to the issue, if any. */
  assigneeId?: string;
  /** The display name of the assigned user, if any. */
  assigneeName?: string;
  /** The identifier of the user who reported the issue. */
  reporterId: string;
  /** The display name of the reporting user. */
  reporterName: string;

  // Dates
  /** The date the issue was created. */
  createdDate: Date;
  /** The date the issue was last updated. */
  updatedDate: Date;
  /** The date by which the issue is due, if any. */
  dueDate?: Date;
  /** The date the issue was resolved, if applicable. */
  resolvedDate?: Date;

  // Details
  /** The environment in which the issue was observed, if relevant. */
  environment?: string;
  /** Steps to reproduce the issue, if relevant. */
  stepsToReproduce?: string;
  /** The expected behavior prior to the issue. */
  expectedBehavior?: string;
  /** The actual (incorrect) behavior observed. */
  actualBehavior?: string;

  // Tracking
  /** The identifier of the sprint this issue is assigned to, if any. */
  sprintId?: string;
  /** The identifier of the epic this issue belongs to, if any. */
  epicId?: string;

  // Progress
  /** Completion percentage of the issue, ranging from 0 to 100. */
  progress: number; // 0-100

  // Labels
  /** Free-form labels applied to the issue for categorization. */
  labels: string[];

  // Attachments
  /** Files and links attached to the issue. */
  attachments: TaskAttachment[];

  // Comments
  /** Discussion comments on the issue. */
  comments: TaskComment[];
}

/**
 * Represents a single time tracking entry logged against a task.
 */
export interface TimeEntry {
  /** Unique identifier for the time entry. */
  id: string;
  /** The identifier of the task this entry is logged against. */
  taskId: string;
  /** The title of the task this entry is logged against. */
  taskTitle: string;
  /** The identifier of the project this entry belongs to. */
  projectId: string;
  /** The identifier of the user who logged the time. */
  userId: string;
  /** The display name of the user who logged the time. */
  userName: string;
  /** The category of work the time entry represents. */
  type: TimeEntryType;

  // Time
  /** The date the work was performed. */
  date: Date;
  /** The duration of the work in minutes. */
  duration: number; // minutes
  /** Whether the time is billable to the client/project. */
  billable: boolean;

  // Description
  /** A description of the work performed. */
  description: string;

  // Approval
  /** Whether the time entry has been approved by a manager. */
  approved: boolean;
  /** The identifier of the user who approved the entry, if approved. */
  approvedBy?: string;
  /** The date the entry was approved, if applicable. */
  approvedDate?: Date;
}

/**
 * Represents a customizable dashboard displaying project management widgets.
 */
export interface Dashboard {
  /** Unique identifier for the dashboard. */
  id: string;
  /** Human-readable dashboard name. */
  name: string;
  /** A short description of what the dashboard shows. */
  description: string;
  /** The category/scope type of the dashboard. */
  type: DashboardType;
  /** Identifiers of the entities (projects, teams, etc.) included in the dashboard scope. */
  scope: string[]; // project IDs, team IDs, etc.

  // Widgets
  /** The widgets displayed on the dashboard. */
  widgets: DashboardWidget[];

  // Configuration
  /** How often the dashboard refreshes, in minutes, if auto-refresh is on. */
  refreshInterval?: number; // minutes
  /** Whether the dashboard refreshes its data automatically. */
  autoRefresh: boolean;

  // Access
  /** The identifier of the user who owns the dashboard. */
  owner: string;
  /** Identifiers of users who can view the dashboard. */
  viewers: string[];
  /** Identifiers of users who can edit the dashboard. */
  editors: string[];

  // Layout
  /** The visual layout mode for dashboard widgets. */
  layout: 'grid' | 'list' | 'kanban';

  // Filters
  /** Filters applied to the data shown on the dashboard. */
  filters: DashboardFilters;

  // Dates
  /** The date the dashboard was created. */
  createdDate: Date;
  /** The date the dashboard was last updated. */
  updatedDate: Date;
}

/**
 * Represents a single widget displayed on a dashboard.
 */
export interface DashboardWidget {
  /** Unique identifier for the widget. */
  id: string;
  /** The type of chart or visualization the widget renders. */
  type: 'burndown' | 'velocity' | 'task-status' | 'sprint-progress' | 'time-tracking' | 'task-distribution' | 'cumulative-flow' | 'lead-time' | 'cycle-time' | 'custom';
  /** Display title of the widget. */
  title: string;
  /** The row and column position of the widget within the dashboard grid. */
  position: { row: number; column: number };
  /** The width and height (in grid units) of the widget. */
  size: { width: number; height: number };
  /** Widget-specific configuration options. */
  config: Record<string, unknown>;
}

/**
 * Represents the set of filters that can be applied to a dashboard's data.
 */
export interface DashboardFilters {
  /** Filter results to the given project identifiers. */
  projects?: string[];
  /** Filter results to the given sprint identifiers. */
  sprints?: string[];
  /** Filter results to the given team identifiers. */
  teams?: string[];
  /** Filter results to the given user identifiers. */
  users?: string[];
  /** Filter results to the given task statuses. */
  statuses?: TaskStatus[];
  /** Filter results to the given priority levels. */
  priorities?: TaskPriority[];
  /** Filter results to the given issue types. */
  types?: IssueType[];
  /** Filter results to a specific date range. */
  dateRange?: {
    /** The inclusive start date of the range. */
    startDate: Date;
    /** The inclusive end date of the range. */
    endDate: Date;
  };
}

/**
 * Represents a team within the project management system, including members and capacity.
 */
export interface Team {
  /** Unique identifier for the team. */
  id: string;
  /** Human-readable team name. */
  name: string;
  /** A short description of the team. */
  description: string;

  // Members
  /** The members belonging to the team. */
  members: TeamMember[];
  /** The identifier of the team lead. */
  leadId: string;
  /** The display name of the team lead. */
  leadName: string;

  // Projects
  /** Identifiers of the projects the team is responsible for. */
  projectIds: string[];

  // Capacity
  /** The total available capacity of the team per sprint, in hours. */
  capacity: number; // hours per sprint
  /** Historical velocity values (completed story points) for recent sprints. */
  velocityHistory: number[];

  // Skills
  /** The combined set of skills across the team. */
  skills: string[];

  // Locations
  /** The geographic locations of team members. */
  locations: string[];

  // Timezone
  /** The primary timezone of the team. */
  timezone: string;
}

/**
 * Represents an individual member of a team.
 */
export interface TeamMember {
  /** The identifier of the user. */
  userId: string;
  /** The display name of the user. */
  userName: string;
  /** The email address of the user. */
  email: string;
  /** The role the user plays on the team. */
  role: 'developer' | 'designer' | 'tester' | 'manager' | 'architect' | 'scrum-master' | 'product-owner' | 'custom';
  /** The skills possessed by the member. */
  skills: string[];
  /** The member's available capacity per sprint, in hours. */
  capacity: number; // hours per sprint
  /** A URL to the member's avatar image, if set. */
  avatar?: string;
}

/**
 * Represents a milestone within a project, marking a significant point or deliverable.
 */
export interface Milestone {
  /** Unique identifier for the milestone. */
  id: string;
  /** Human-readable milestone name. */
  name: string;
  /** A short description of what the milestone represents. */
  description: string;
  /** The identifier of the project this milestone belongs to. */
  projectId: string;

  // Dates
  /** The target date by which the milestone should be reached. */
  targetDate: Date;
  /** The date the milestone was actually completed, if applicable. */
  completedDate?: Date;

  // Status
  /** Current lifecycle status of the milestone. */
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'overdue';

  // Tasks
  /** Identifiers of the tasks that contribute to this milestone. */
  taskIds: string[];

  // Progress
  /** Completion percentage of the milestone, ranging from 0 to 100. */
  progress: number; // 0-100

  // Dependencies
  /** Identifiers of milestones that must be completed before this one. */
  dependsOn: string[]; // milestone IDs
}

// Manager Class

/**
 * Core manager class for the project management system. Provides CRUD operations
 * for projects, sprints, tasks, issues, time entries, teams, milestones, and
 * dashboards, as well as analytics such as burndown and velocity.
 */
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

  /**
   * Creates a new project and stores it in the manager.
   *
   * @param project - The project data excluding auto-generated fields.
   * @returns The newly created project with id, createdDate, and default values set.
   */
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

  /**
   * Updates an existing project with the provided field values.
   *
   * @param id - The identifier of the project to update.
   * @param updates - A partial object containing the fields to change.
   * @returns The updated project, or `undefined` if the project was not found.
   */
  updateProject(id: string, updates: Partial<Project>): Project | undefined {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  /**
   * Retrieves a project by its identifier.
   *
   * @param id - The identifier of the project.
   * @returns The project, or `undefined` if not found.
   */
  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  /**
   * Lists projects, optionally filtered by status and/or team.
   *
   * @param filters - Optional filters to narrow the results by status or team.
   * @returns An array of matching projects sorted by creation date (newest first).
   */
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

  /**
   * Creates a new sprint and generates its initial burndown data.
   *
   * @param sprint - The sprint data excluding auto-generated fields.
   * @returns The newly created sprint with id, createdDate, and burndown set.
   */
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

  /**
   * Transitions a sprint to the "active" status.
   *
   * @param sprintId - The identifier of the sprint to start.
   * @returns The updated sprint, or `undefined` if the sprint was not found.
   */
  startSprint(sprintId: string): Sprint | undefined {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) return undefined;

    sprint.status = 'active';
    this.sprints.set(sprintId, sprint);
    return sprint;
  }

  /**
   * Marks a sprint as completed and records retrospective details.
   *
   * @param sprintId - The identifier of the sprint to complete.
   * @param retrospective - Retrospective notes for the sprint.
   * @param completedPoints - The number of story points completed during the sprint.
   * @returns The updated sprint, or `undefined` if the sprint was not found.
   */
  completeSprint(sprintId: string, retrospective: string, completedPoints: number): Sprint | undefined {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) return undefined;

    sprint.status = 'completed';
    sprint.retrospective = retrospective;
    sprint.completedPoints = completedPoints;

    this.sprints.set(sprintId, sprint);
    return sprint;
  }

  /**
   * Retrieves a sprint by its identifier.
   *
   * @param id - The identifier of the sprint.
   * @returns The sprint, or `undefined` if not found.
   */
  getSprint(id: string): Sprint | undefined {
    return this.sprints.get(id);
  }

  /**
   * Lists sprints, optionally filtered by project.
   *
   * @param projectId - When provided, only sprints belonging to this project are returned.
   * @returns An array of matching sprints sorted by start date (newest first).
   */
  listSprints(projectId?: string): Sprint[] {
    let sprints = Array.from(this.sprints.values());
    if (projectId) {
      sprints = sprints.filter(s => s.projectId === projectId);
    }
    return sprints.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  // Task Management

  /**
   * Creates a new task and records an initial "created" history entry.
   *
   * @param task - The task data excluding auto-generated fields.
   * @returns The newly created task with id, timestamps, and default values set.
   */
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

  /**
   * Updates an existing task and appends history entries for each changed field.
   *
   * @param taskId - The identifier of the task to update.
   * @param updates - A partial object containing the fields to change.
   * @param userId - The identifier of the user making the change.
   * @param userName - The display name of the user making the change.
   * @returns The updated task, or `undefined` if the task was not found.
   */
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
        oldValue: JSON.stringify((task as unknown as Record<string, unknown>)[key]),
        newValue: JSON.stringify(value),
      });
    }

    this.tasks.set(taskId, updated);
    return updated;
  }

  /**
   * Retrieves a task by its identifier.
   *
   * @param id - The identifier of the task.
   * @returns The task, or `undefined` if not found.
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Lists tasks, optionally filtered by project, sprint, status, and/or assignee.
   *
   * @param filters - Optional filters to narrow the results.
   * @returns An array of matching tasks sorted by creation date (newest first).
   */
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

  /**
   * Creates a new tracked issue and stores it in the manager.
   *
   * @param issue - The issue data excluding auto-generated fields.
   * @returns The newly created issue with id, timestamps, and default progress set.
   */
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

  /**
   * Retrieves an issue by its identifier.
   *
   * @param id - The identifier of the issue.
   * @returns The issue, or `undefined` if not found.
   */
  getIssue(id: string): Issue | undefined {
    return this.issues.get(id);
  }

  /**
   * Lists issues, optionally filtered by project, severity, and/or status.
   *
   * @param filters - Optional filters to narrow the results.
   * @returns An array of matching issues sorted by creation date (newest first).
   */
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

  /**
   * Creates a new time entry and updates the related task's actual hours.
   *
   * @param entry - The time entry data excluding the auto-generated id.
   * @returns The newly created time entry.
   */
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

  /**
   * Lists time entries, optionally filtered by task, user, and/or project.
   *
   * @param filters - Optional filters to narrow the results.
   * @returns An array of matching time entries sorted by date (newest first).
   */
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

  /**
   * Creates a new team with an empty velocity history.
   *
   * @param team - The team data excluding the auto-generated id.
   * @returns The newly created team.
   */
  createTeam(team: Omit<Team, 'id'>): Team {
    const id = this.generateId('team');
    const newTeam: Team = { ...team, id, velocityHistory: [] };
    this.teams.set(id, newTeam);
    return newTeam;
  }

  /**
   * Retrieves a team by its identifier.
   *
   * @param id - The identifier of the team.
   * @returns The team, or `undefined` if not found.
   */
  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  /**
   * Lists all teams in the manager.
   *
   * @returns An array of all teams.
   */
  listTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  // Milestone Management

  /**
   * Creates a new milestone with an initial progress of 0.
   *
   * @param milestone - The milestone data excluding auto-generated fields.
   * @returns The newly created milestone.
   */
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

  /**
   * Retrieves a milestone by its identifier.
   *
   * @param id - The identifier of the milestone.
   * @returns The milestone, or `undefined` if not found.
   */
  getMilestone(id: string): Milestone | undefined {
    return this.milestones.get(id);
  }

  /**
   * Lists milestones, optionally filtered by project.
   *
   * @param projectId - When provided, only milestones belonging to this project are returned.
   * @returns An array of matching milestones sorted by target date (earliest first).
   */
  listMilestones(projectId?: string): Milestone[] {
    let milestones = Array.from(this.milestones.values());
    if (projectId) {
      milestones = milestones.filter(m => m.projectId === projectId);
    }
    return milestones.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
  }

  // Dashboard Management

  /**
   * Creates a new dashboard and stores it in the manager.
   *
   * @param dashboard - The dashboard data excluding auto-generated fields.
   * @returns The newly created dashboard with id and timestamps set.
   */
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

  /**
   * Retrieves a dashboard by its identifier.
   *
   * @param id - The identifier of the dashboard.
   * @returns The dashboard, or `undefined` if not found.
   */
  getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  /**
   * Lists all dashboards in the manager.
   *
   * @returns An array of all dashboards.
   */
  listDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  // Analytics

  /**
   * Computes a summary of project metrics including task counts, hours, and velocity.
   *
   * @param projectId - The identifier of the project to summarize.
   * @returns A summary object, with zeroed values if the project is not found.
   */
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

  /**
   * Calculates the average velocity (completed story points) for a team over recent sprints.
   *
   * @param teamId - The identifier of the team.
   * @param sprintCount - The number of most recent completed sprints to average (default 3).
   * @returns The average completed story points, rounded to the nearest integer. Returns 0 if no completed sprints exist.
   */
  getTeamVelocity(teamId: string, sprintCount = 3): number {
    const sprints = this.listSprints()
      .filter(s => s.teamId === teamId && s.status === 'completed' && s.completedPoints !== undefined)
      .slice(-sprintCount);

    if (sprints.length === 0) return 0;
    return Math.round(sprints.reduce((sum, s) => sum + (s.completedPoints || 0), 0) / sprints.length);
  }

  /**
   * Retrieves the burndown data for a sprint.
   *
   * @param sprintId - The identifier of the sprint.
   * @returns An array of burndown data points, or an empty array if the sprint is not found.
   */
  getSprintBurndown(sprintId: string): BurndownData[] {
    const sprint = this.sprints.get(sprintId);
    return sprint?.burndown || [];
  }

  // Helper methods

  /**
   * Generates a unique identifier using a prefix, timestamp, and random suffix.
   *
   * @param prefix - A string prefix indicating the entity type (e.g. "task", "sprint").
   * @returns A unique identifier string.
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generates the initial ideal burndown data points for a sprint based on total story points.
   *
   * @param startDate - The start date of the sprint.
   * @param endDate - The end date of the sprint.
   * @param taskIds - The identifiers of the tasks included in the sprint.
   * @returns An array of burndown data points, one per day from start to end.
   */
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

/**
 * Aggregated summary metrics for a project.
 */
export interface ProjectSummary {
  /** The total number of tasks in the project. */
  totalTasks: number;
  /** The number of completed tasks in the project. */
  completedTasks: number;
  /** The number of tasks currently in progress. */
  inProgressTasks: number;
  /** The total estimated hours across all tasks. */
  totalHours: number;
  /** The total remaining hours (estimated minus actual) across all tasks. */
  remainingHours: number;
  /** The average velocity (story points per sprint) for the project. */
  velocity: number;
  /** The currently active sprint for the project, or `null` if none is active. */
  activeSprint: Sprint | null;
}

// Generate Markdown Documentation

/**
 * Generates a Markdown documentation string describing the project management configuration,
 * features, projects, and usage examples.
 *
 * @param config - The project management configuration to document.
 * @returns A Markdown-formatted string containing the documentation.
 */
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

/**
 * Generates Terraform infrastructure configuration for the project management system
 * tailored to the specified cloud provider.
 *
 * @param config - The project management configuration to generate infrastructure for.
 * @param provider - The target cloud provider ('aws', 'azure', or 'gcp').
 * @returns A string containing the Terraform configuration.
 */
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

/**
 * Generates a complete TypeScript implementation of a project management manager class,
 * including enums, interfaces, and CRUD methods, based on the provided configuration.
 *
 * @param config - The project management configuration used to populate the generated code header.
 * @returns A string containing the generated TypeScript source code.
 */
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

/**
 * Generates a complete Python implementation of a project management manager class,
 * including enums, dataclasses, and CRUD methods, based on the provided configuration.
 *
 * @param config - The project management configuration used to populate the generated code header.
 * @returns A string containing the generated Python source code.
 */
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

/**
 * Writes all project management files to disk, including documentation, configuration JSON,
 * Terraform infrastructure, and manager source code for the specified language.
 *
 * @param config - The project management configuration to write.
 * @param outputDir - The directory where files will be written.
 * @param language - The target programming language for the generated manager code.
 * @returns A promise that resolves when all files have been written.
 */
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

/**
 * Prints a formatted summary of the project management configuration to the console,
 * including project counts, settings, cloud providers, and expected output files.
 *
 * @param config - The project management configuration to display.
 * @param language - The target programming language for the generated code.
 * @param outputDir - The directory where files will be written.
 */
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

/**
 * Creates a fully populated example project management configuration with sample
 * projects, sprints, tasks, issues, time entries, dashboards, teams, and milestones.
 *
 * @returns A `ProjectManagementConfig` object filled with realistic example data.
 */
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
