/**
 * Enterprise Collaboration and Team Management System
 *
 * Provides team collaboration, communication, document sharing,
 * code review, and analytics capabilities.
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Role assigned to a team member, controlling their permissions within a team.
 */
export type TeamRole = 'owner' | 'admin' | 'moderator' | 'member' | 'guest' | 'viewer';

/**
 * Categorization of a communication channel by its medium and purpose.
 */
export type ChannelType = 'text' | 'voice' | 'video' | 'announcement' | 'private' | 'archived';

/**
 * Format of a message's payload, such as plain text, a file, or a code snippet.
 */
export type MessageType = 'text' | 'file' | 'code' | 'image' | 'video' | 'audio' | 'emoji' | 'system';

/**
 * Supported emoji reactions that can be applied to a message.
 */
export type ReactionType = 'thumbs_up' | 'thumbs_down' | 'laugh' | 'celebrate' | 'thinking' | 'heart' | 'fire' | 'eyes';

/**
 * Lifecycle state of a collaborative task.
 */
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

/**
 * Relative importance level assigned to a collaborative task.
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Kind of shared document, such as a text document, spreadsheet, or design file.
 */
export type DocumentType = 'document' | 'spreadsheet' | 'presentation' | 'code' | 'design' | 'whiteboard';

/**
 * Lifecycle state of a code review request.
 */
export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected';

/**
 * Category of a user-facing notification.
 */
export type NotificationType = 'mention' | 'reply' | 'assignment' | 'reminder' | 'announcement' | 'system';

/**
 * Urgency level assigned to a notification.
 */
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * Purpose of a scheduled meeting, such as a standup or sprint planning.
 */
export type MeetingType = 'standup' | 'sprint_planning' | 'retrospective' | 'review' | 'one_on_one' | 'all_hands' | 'ad_hoc';

/**
 * Lifecycle state of a meeting.
 */
export type MeetingStatus = 'scheduled' | 'started' | 'paused' | 'ended' | 'cancelled';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Represents a registered user of the collaboration platform.
 */
export interface User {
  /** Unique identifier of the user. */
  id: string;
  /** Display name of the user. */
  name: string;
  /** Email address used for contact and authentication. */
  email: string;
  /** Optional URL to the user's avatar image. */
  avatar?: string;
  /** Optional job title. */
  title?: string;
  /** Optional department the user belongs to. */
  department?: string;
  /** Optional geographic location. */
  location?: string;
  /** IANA timezone identifier, e.g. `America/Los_Angeles`. */
  timezone: string;
  /** Current presence status of the user. */
  status: 'online' | 'away' | 'busy' | 'offline' | 'in_meeting';
  /** Timestamp of the user's most recent activity. */
  lastSeen: Date;
  /** List of skills associated with the user. */
  skills: string[];
  /** Languages the user can communicate in. */
  languages: string[];
  /** Date the user joined the platform. */
  joinedAt: Date;
}

/**
 * Represents a team within the collaboration platform.
 */
export interface Team {
  /** Unique identifier of the team. */
  id: string;
  /** Human-readable name of the team. */
  name: string;
  /** Short description of the team's purpose. */
  description: string;
  /** Optional URL to the team's avatar image. */
  avatar?: string;
  /** User ID of the team owner. */
  owner: string;
  /** Members that belong to the team. */
  members: TeamMember[];
  /** Communication channels associated with the team. */
  channels: Channel[];
  /** Configuration settings for the team. */
  settings: TeamSettings;
  /** Date the team was created. */
  createdAt: Date;
}

/**
 * Describes a user's membership in a team, including their role and permissions.
 */
export interface TeamMember {
  /** ID of the user who is a member of the team. */
  userId: string;
  /** Role assigned to the user within the team. */
  role: TeamRole;
  /** Date the user joined the team. */
  joinedAt: Date;
  /** List of permission strings granted to the member. */
  permissions: string[];
}

/**
 * Configuration options that govern team behavior and access policies.
 */
export interface TeamSettings {
  /** Whether the team is visible to non-members. */
  isPublic: boolean;
  /** Whether guest-level access is permitted. */
  allowGuestAccess: boolean;
  /** Whether content can be shared outside the organization. */
  allowExternalSharing: boolean;
  /** Default channel type created for the team. */
  defaultChannelType: ChannelType;
  /** Number of days messages are retained before deletion. */
  messageRetention: number;
  /** Number of days files are retained before deletion. */
  fileRetention: number;
  /** Whether guests require explicit approval to join. */
  requireApprovalForGuests: boolean;
}

/**
 * Represents a communication channel within a team.
 */
export interface Channel {
  /** Unique identifier of the channel. */
  id: string;
  /** ID of the team the channel belongs to. */
  teamId: string;
  /** Human-readable name of the channel. */
  name: string;
  /** Optional description of the channel's purpose. */
  description?: string;
  /** Type of the channel (text, voice, video, etc.). */
  type: ChannelType;
  /** IDs of the users who are members of the channel. */
  members: string[];
  /** ID of the user who created the channel. */
  createdBy: string;
  /** Date the channel was created. */
  createdAt: Date;
  /** Optional date the channel was archived. */
  archivedAt?: Date;
  /** Whether the channel is private and restricted to invited members. */
  isPrivate: boolean;
  /** Whether the channel is read-only for most members. */
  isReadOnly: boolean;
  /** Optional ID of a parent channel, when channels are nested. */
  parentChannelId?: string;
}

/**
 * Represents a message posted to a channel.
 */
export interface Message {
  /** Unique identifier of the message. */
  id: string;
  /** ID of the channel the message belongs to. */
  channelId: string;
  /** Optional ID of the parent thread, if the message is in a thread. */
  threadId?: string;
  /** ID of the user who authored the message. */
  authorId: string;
  /** Textual content of the message. */
  content: string;
  /** Type of the message payload. */
  type: MessageType;
  /** Files attached to the message. */
  attachments: MessageAttachment[];
  /** Emoji reactions applied to the message. */
  reactions: MessageReaction[];
  /** Number of replies the message has received. */
  replies: number;
  /** Optional date the message was last edited. */
  editedAt?: Date;
  /** Optional date the message was soft-deleted. */
  deletedAt?: Date;
  /** Whether the message is pinned in its channel. */
  pinned: boolean;
  /** IDs of users mentioned in the message. */
  mentions: string[];
  /** Date the message was created. */
  createdAt: Date;
}

/**
 * Represents a file attached to a message.
 */
export interface MessageAttachment {
  /** Unique identifier of the attachment. */
  id: string;
  /** File name of the attachment. */
  name: string;
  /** Size of the file in bytes. */
  size: number;
  /** MIME type of the file. */
  mimeType: string;
  /** URL where the file can be downloaded. */
  url: string;
  /** Optional URL to a thumbnail preview of the attachment. */
  thumbnail?: string;
}

/**
 * Represents an emoji reaction applied to a message by one or more users.
 */
export interface MessageReaction {
  /** The emoji used for the reaction. */
  emoji: ReactionType;
  /** IDs of the users who applied the reaction. */
  userIds: string[];
}

/**
 * Represents a threaded conversation stemming from a parent message.
 */
export interface Thread {
  /** Unique identifier of the thread. */
  id: string;
  /** ID of the channel the thread belongs to. */
  channelId: string;
  /** ID of the parent message that started the thread. */
  parentMessageId: string;
  /** Messages that make up the thread. */
  messages: Message[];
  /** Lifecycle status of the thread. */
  status: 'active' | 'resolved' | 'archived';
  /** IDs of users participating in the thread. */
  participantIds: string[];
}

/**
 * Represents a shared document owned by a user or team.
 */
export interface Document {
  /** Unique identifier of the document. */
  id: string;
  /** Human-readable name of the document. */
  name: string;
  /** Type of the document. */
  type: DocumentType;
  /** Textual or serialized content of the document. */
  content: string;
  /** ID of the user who owns the document. */
  ownerId: string;
  /** Optional ID of the team the document belongs to. */
  teamId?: string;
  /** Optional ID of the folder containing the document. */
  folderId?: string;
  /** Current version number of the document. */
  version: number;
  /** Whether the document is a reusable template. */
  isTemplate: boolean;
  /** Tags used to categorize the document. */
  tags: string[];
  /** Access permissions applied to the document. */
  permissions: DocumentPermission[];
  /** Date the document was created. */
  createdAt: Date;
  /** Date the document was last updated. */
  updatedAt: Date;
}

/**
 * Defines the access level a user or team has for a document.
 */
export interface DocumentPermission {
  /** ID of the user the permission applies to, if applicable. */
  userId?: string;
  /** ID of the team the permission applies to, if applicable. */
  teamId?: string;
  /** Access role controlling what can be done with the document. */
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
}

/**
 * Represents a code review (pull request) for a repository.
 */
export interface CodeReview {
  /** Unique identifier of the review. */
  id: string;
  /** Title summarizing the review. */
  title: string;
  /** Description of what the review changes or adds. */
  description: string;
  /** ID of the repository the review belongs to. */
  repositoryId: string;
  /** Name of the branch containing the changes. */
  sourceBranch: string;
  /** Name of the branch the changes are intended to merge into. */
  targetBranch: string;
  /** ID of the user who authored the review. */
  authorId: string;
  /** Reviewers assigned to the review. */
  reviewers: Reviewer[];
  /** Current lifecycle status of the review. */
  status: ReviewStatus;
  /** Number of commits included in the review. */
  commits: number;
  /** Number of lines added by the review. */
  additions: number;
  /** Number of lines removed by the review. */
  deletions: number;
  /** Number of files changed by the review. */
  changedFiles: number;
  /** Inline comments left on the review. */
  comments: ReviewComment[];
  /** Date the review was created. */
  createdAt: Date;
  /** Optional date the review was merged. */
  mergedAt?: Date;
  /** Optional date the review was closed without merging. */
  closedAt?: Date;
}

/**
 * Represents a reviewer assigned to a code review and their review decision.
 */
export interface Reviewer {
  /** ID of the user assigned as reviewer. */
  userId: string;
  /** Reviewer's current decision on the review. */
  status: 'pending' | 'approved' | 'changes_requested' | 'declined';
  /** Optional date the reviewer submitted their decision. */
  submittedAt?: Date;
}

/**
 * Represents an inline comment left on a specific file and line in a code review.
 */
export interface ReviewComment {
  /** Unique identifier of the comment. */
  id: string;
  /** ID of the user who wrote the comment. */
  authorId: string;
  /** Textual content of the comment. */
  content: string;
  /** Relative path of the file the comment refers to. */
  file: string;
  /** Line number the comment is attached to. */
  line: number;
  /** Whether the comment has been resolved. */
  resolved: boolean;
  /** Date the comment was created. */
  createdAt: Date;
  /** Optional date the comment was resolved. */
  resolvedAt?: Date;
}

/**
 * Represents a collaborative task that can be assigned, tracked, and discussed.
 */
export interface TaskCollab {
  /** Unique identifier of the task. */
  id: string;
  /** Short title of the task. */
  title: string;
  /** Detailed description of the task. */
  description: string;
  /** Current lifecycle status of the task. */
  status: TaskStatus;
  /** Priority of the task. */
  priority: TaskPriority;
  /** IDs of users assigned to the task. */
  assigneeIds: string[];
  /** ID of the user who created the task. */
  creatorId: string;
  /** Optional ID of the team the task belongs to. */
  teamId?: string;
  /** Optional date the task is due. */
  dueDate?: Date;
  /** Optional date work on the task is expected to start. */
  startDate?: Date;
  /** Optional estimated effort in hours. */
  estimatedHours?: number;
  /** Optional actual effort spent in hours. */
  actualHours?: number;
  /** Tags used to categorize the task. */
  tags: string[];
  /** IDs of tasks that must be completed before this one. */
  dependencies: string[];
  /** Subtasks belonging to the task. */
  subtasks: SubTask[];
  /** Comments left on the task. */
  comments: TaskComment[];
  /** IDs of files attached to the task. */
  attachments: string[];
  /** Optional date the task was completed. */
  completedAt?: Date;
  /** Date the task was created. */
  createdAt: Date;
  /** Date the task was last updated. */
  updatedAt: Date;
}

/**
 * Represents a smaller unit of work nested under a parent task.
 */
export interface SubTask {
  /** Unique identifier of the subtask. */
  id: string;
  /** Short title of the subtask. */
  title: string;
  /** Whether the subtask has been completed. */
  completed: boolean;
  /** Optional date the subtask was completed. */
  completedAt?: Date;
}

/**
 * Represents a comment left on a task by a user.
 */
export interface TaskComment {
  /** Unique identifier of the comment. */
  id: string;
  /** ID of the user who wrote the comment. */
  authorId: string;
  /** Textual content of the comment. */
  content: string;
  /** Date the comment was created. */
  createdAt: Date;
  /** Optional date the comment was last edited. */
  editedAt?: Date;
}

/**
 * Represents a scheduled or in-progress meeting with participants.
 */
export interface Meeting {
  /** Unique identifier of the meeting. */
  id: string;
  /** Title of the meeting. */
  title: string;
  /** Optional description or agenda. */
  description?: string;
  /** Purpose category of the meeting. */
  type: MeetingType;
  /** Current lifecycle status of the meeting. */
  status: MeetingStatus;
  /** ID of the user hosting the meeting. */
  hostId: string;
  /** IDs of users invited to the meeting. */
  participantIds: string[];
  /** Date and time the meeting is scheduled to begin. */
  scheduledFor: Date;
  /** Planned duration of the meeting in minutes. */
  duration: number;
  /** Optional recurring schedule configuration. */
  recurring?: RecurringSchedule;
  /** Whether recording is enabled for the meeting. */
  recordingEnabled: boolean;
  /** Whether live transcription is enabled for the meeting. */
  transcriptEnabled: boolean;
  /** Optional free-form notes for the meeting. */
  notes?: string;
  /** Optional IDs of tasks derived as action items from the meeting. */
  actionItems?: string[];
  /** Optional URL to the meeting recording. */
  recordingUrl?: string;
  /** Optional URL to the meeting transcript. */
  transcriptUrl?: string;
  /** Date the meeting record was created. */
  createdAt: Date;
}

/**
 * Defines how and when a meeting repeats over time.
 */
export interface RecurringSchedule {
  /** How often the meeting recurs. */
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  /** Days of the week (0-6, Sunday-Saturday) the meeting recurs on. */
  daysOfWeek?: number[];
  /** Optional date after which the recurrence stops. */
  endDate?: Date;
}

/**
 * Represents a notification delivered to a user.
 */
export interface Notification {
  /** Unique identifier of the notification. */
  id: string;
  /** ID of the user the notification is addressed to. */
  userId: string;
  /** Category of the notification. */
  type: NotificationType;
  /** Urgency of the notification. */
  priority: NotificationPriority;
  /** Short title for the notification. */
  title: string;
  /** Detailed content of the notification. */
  content: string;
  /** Optional URL the user can navigate to in response. */
  actionUrl?: string;
  /** Whether the notification has been read. */
  read: boolean;
  /** Whether the notification has been dismissed by the user. */
  dismissed: boolean;
  /** Date the notification was created. */
  createdAt: Date;
}

/**
 * Represents an activity event recorded in the collaboration platform's audit log.
 */
export interface Activity {
  /** Unique identifier of the activity entry. */
  id: string;
  /** ID of the user who performed the activity, or `system`. */
  userId: string;
  /** Short description of the action performed. */
  action: string;
  /** Kind of entity the activity relates to. */
  entityType: 'message' | 'document' | 'task' | 'meeting' | 'review' | 'user' | 'team' | 'channel';
  /** ID of the entity the activity relates to. */
  entityId: string;
  /** Optional additional context about the activity. */
  metadata?: Record<string, unknown>;
  /** Date the activity occurred. */
  createdAt: Date;
}

/**
 * Represents a set of analytics computed for a specific time period.
 */
export interface Analytics {
  /** Granularity of the reporting period. */
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /** Start of the reporting window. */
  startDate: Date;
  /** End of the reporting window. */
  endDate: Date;
  /** Aggregated metrics for the period. */
  metrics: AnalyticsMetrics;
}

/**
 * Aggregated metrics covering users, teams, messages, documents, reviews, tasks, and meetings.
 */
export interface AnalyticsMetrics {
  /** User-related metrics. */
  users: {
    /** Total number of registered users. */
    total: number;
    /** Number of currently active users. */
    active: number;
    /** Number of users who joined during the period. */
    new: number;
    /** Retention percentage. */
    retention: number;
  };
  /** Team-related metrics. */
  teams: {
    /** Total number of teams. */
    total: number;
    /** Number of active teams. */
    active: number;
    /** Average number of members per team. */
    avgSize: number;
  };
  /** Messaging-related metrics. */
  messages: {
    /** Messages sent during the period. */
    sent: number;
    /** Messages read during the period. */
    read: number;
    /** Average response time in minutes. */
    avgResponseTime: number;
    /** Channels with the highest message counts. */
    mostActiveChannels: { channelId: string; count: number }[];
  };
  /** Document-related metrics. */
  documents: {
    /** Documents created during the period. */
    created: number;
    /** Documents edited during the period. */
    edited: number;
    /** Documents shared during the period. */
    shared: number;
    /** Documents with the most views. */
    mostViewed: { docId: string; views: number }[];
  };
  /** Code review-related metrics. */
  codeReviews: {
    /** Reviews opened during the period. */
    opened: number;
    /** Reviews merged during the period. */
    merged: number;
    /** Reviews closed without merging during the period. */
    closed: number;
    /** Average time to complete a review in hours. */
    avgReviewTime: number;
    /** Percentage of reviews that were approved. */
    approvalRate: number;
  };
  /** Task-related metrics. */
  tasks: {
    /** Tasks created during the period. */
    created: number;
    /** Tasks completed during the period. */
    completed: number;
    /** Tasks that are past their due date. */
    overdue: number;
    /** Average time to complete a task in hours. */
    avgCompletionTime: number;
  };
  /** Meeting-related metrics. */
  meetings: {
    /** Meetings scheduled during the period. */
    scheduled: number;
    /** Meetings completed during the period. */
    completed: number;
    /** Meetings cancelled during the period. */
    cancelled: number;
    /** Average meeting duration in minutes. */
    avgDuration: number;
    /** Attendance rate as a percentage. */
    attendanceRate: number;
  };
}

// ============================================================================
// Example Configuration Data
// ============================================================================

/**
 * Sample users used to seed the collaboration manager with initial data.
 */
export const exampleUsers: User[] = [
  {
    id: 'usr-001',
    name: 'Alice Johnson',
    email: 'alice.johnson@example.com',
    avatar: 'https://example.com/avatars/alice.jpg',
    title: 'Senior Software Engineer',
    department: 'Engineering',
    location: 'San Francisco, CA',
    timezone: 'America/Los_Angeles',
    status: 'online',
    lastSeen: new Date(),
    skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
    languages: ['English', 'Spanish'],
    joinedAt: new Date('2023-01-15'),
  },
  {
    id: 'usr-002',
    name: 'Bob Smith',
    email: 'bob.smith@example.com',
    title: 'Product Manager',
    department: 'Product',
    location: 'New York, NY',
    timezone: 'America/New_York',
    status: 'busy',
    lastSeen: new Date(),
    skills: ['Agile', 'Scrum', 'Product Strategy', 'Data Analysis'],
    languages: ['English'],
    joinedAt: new Date('2023-02-01'),
  },
  {
    id: 'usr-003',
    name: 'Carol Williams',
    email: 'carol.williams@example.com',
    title: 'UX Designer',
    department: 'Design',
    location: 'London, UK',
    timezone: 'Europe/London',
    status: 'away',
    lastSeen: new Date(Date.now() - 30 * 60 * 1000),
    skills: ['Figma', 'UI Design', 'User Research', 'Prototyping'],
    languages: ['English', 'French'],
    joinedAt: new Date('2023-03-10'),
  },
  {
    id: 'usr-004',
    name: 'David Chen',
    email: 'david.chen@example.com',
    title: 'DevOps Engineer',
    department: 'Engineering',
    location: 'Singapore',
    timezone: 'Asia/Singapore',
    status: 'offline',
    lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000),
    skills: ['Kubernetes', 'Terraform', 'CI/CD', 'Monitoring'],
    languages: ['English', 'Mandarin'],
    joinedAt: new Date('2023-04-01'),
  },
];

/**
 * Sample teams used to seed the collaboration manager with initial data.
 */
export const exampleTeams: Team[] = [
  {
    id: 'team-001',
    name: 'Engineering',
    description: 'Core engineering team',
    owner: 'usr-001',
    members: [
      { userId: 'usr-001', role: 'admin', joinedAt: new Date('2023-01-15'), permissions: ['all'] },
      { userId: 'usr-004', role: 'member', joinedAt: new Date('2023-04-01'), permissions: ['read', 'write'] },
    ],
    channels: [],
    settings: {
      isPublic: true,
      allowGuestAccess: false,
      allowExternalSharing: false,
      defaultChannelType: 'text',
      messageRetention: 90,
      fileRetention: 365,
      requireApprovalForGuests: true,
    },
    createdAt: new Date('2023-01-15'),
  },
  {
    id: 'team-002',
    name: 'Product',
    description: 'Product management team',
    owner: 'usr-002',
    members: [
      { userId: 'usr-002', role: 'admin', joinedAt: new Date('2023-02-01'), permissions: ['all'] },
    ],
    channels: [],
    settings: {
      isPublic: true,
      allowGuestAccess: true,
      allowExternalSharing: true,
      defaultChannelType: 'text',
      messageRetention: 180,
      fileRetention: 365,
      requireApprovalForGuests: false,
    },
    createdAt: new Date('2023-02-01'),
  },
];

/**
 * Sample channels used to seed the collaboration manager with initial data.
 */
export const exampleChannels: Channel[] = [
  {
    id: 'chan-001',
    teamId: 'team-001',
    name: 'general',
    description: 'General team discussions',
    type: 'text',
    members: ['usr-001', 'usr-004'],
    createdBy: 'usr-001',
    createdAt: new Date('2023-01-15'),
    isPrivate: false,
    isReadOnly: false,
  },
  {
    id: 'chan-002',
    teamId: 'team-001',
    name: 'code-reviews',
    description: 'Pull request reviews and discussions',
    type: 'text',
    members: ['usr-001', 'usr-004'],
    createdBy: 'usr-001',
    createdAt: new Date('2023-01-20'),
    isPrivate: false,
    isReadOnly: false,
  },
  {
    id: 'chan-003',
    teamId: 'team-001',
    name: 'standup',
    description: 'Daily standup meetings',
    type: 'voice',
    members: ['usr-001', 'usr-004'],
    createdBy: 'usr-001',
    createdAt: new Date('2023-01-15'),
    isPrivate: false,
    isReadOnly: false,
  },
];

/**
 * Sample messages used to seed the collaboration manager with initial data.
 */
export const exampleMessages: Message[] = [
  {
    id: 'msg-001',
    channelId: 'chan-001',
    authorId: 'usr-001',
    content: 'Hey everyone! I just pushed the new feature branch.',
    type: 'text',
    attachments: [],
    reactions: [
      { emoji: 'thumbs_up', userIds: ['usr-004'] },
      { emoji: 'fire', userIds: ['usr-004'] },
    ],
    replies: 2,
    mentions: [],
    pinned: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: 'msg-002',
    channelId: 'chan-001',
    authorId: 'usr-004',
    content: 'Great work! I will review it shortly.',
    type: 'text',
    attachments: [],
    reactions: [],
    replies: 0,
    mentions: [],
    pinned: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
  },
];

/**
 * Sample documents used to seed the collaboration manager with initial data.
 */
export const exampleDocuments: Document[] = [
  {
    id: 'doc-001',
    name: 'Project Architecture',
    type: 'document',
    content: '# Architecture Overview\n\nSystem architecture documentation...',
    ownerId: 'usr-001',
    teamId: 'team-001',
    version: 3,
    isTemplate: false,
    tags: ['architecture', 'documentation'],
    permissions: [
      { userId: 'usr-001', role: 'owner' },
      { teamId: 'team-001', role: 'editor' },
    ],
    createdAt: new Date('2023-05-01'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 'doc-002',
    name: 'Q1 Planning Spreadsheet',
    type: 'spreadsheet',
    content: '{"sheets": [{"name": "Timeline", "data": [...]}]}',
    ownerId: 'usr-002',
    teamId: 'team-002',
    version: 5,
    isTemplate: false,
    tags: ['planning', 'q1'],
    permissions: [
      { userId: 'usr-002', role: 'owner' },
      { teamId: 'team-002', role: 'editor' },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
];

/**
 * Sample code reviews used to seed the collaboration manager with initial data.
 */
export const exampleCodeReviews: CodeReview[] = [
  {
    id: 'rev-001',
    title: 'Add user authentication flow',
    description: 'Implements OAuth2 login with refresh tokens',
    repositoryId: 'repo-001',
    sourceBranch: 'feature/auth',
    targetBranch: 'main',
    authorId: 'usr-001',
    reviewers: [
      { userId: 'usr-004', status: 'approved', submittedAt: new Date() },
    ],
    status: 'approved',
    commits: 3,
    additions: 450,
    deletions: 120,
    changedFiles: 8,
    comments: [
      {
        id: 'cmt-001',
        authorId: 'usr-004',
        content: 'Consider adding rate limiting here',
        file: 'src/auth/login.ts',
        line: 42,
        resolved: true,
        createdAt: new Date(),
        resolvedAt: new Date(),
      },
    ],
    createdAt: new Date('2024-01-25'),
    mergedAt: new Date('2024-01-26'),
  },
];

/**
 * Sample collaborative tasks used to seed the collaboration manager with initial data.
 */
export const exampleTasks: TaskCollab[] = [
  {
    id: 'task-001',
    title: 'Implement user dashboard',
    description: 'Create the main dashboard interface for users',
    status: 'in_progress',
    priority: 'high',
    assigneeIds: ['usr-001'],
    creatorId: 'usr-002',
    teamId: 'team-001',
    dueDate: new Date('2024-02-15'),
    estimatedHours: 16,
    actualHours: 8,
    tags: ['frontend', 'dashboard'],
    dependencies: [],
    subtasks: [
      { id: 'sub-001', title: 'Create layout', completed: true, completedAt: new Date() },
      { id: 'sub-002', title: 'Add widgets', completed: false },
    ],
    comments: [],
    attachments: [],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date(),
  },
];

/**
 * Sample meetings used to seed the collaboration manager with initial data.
 */
export const exampleMeetings: Meeting[] = [
  {
    id: 'mtg-001',
    title: 'Daily Standup',
    type: 'standup',
    status: 'scheduled',
    hostId: 'usr-001',
    participantIds: ['usr-001', 'usr-004'],
    scheduledFor: new Date(),
    duration: 15,
    recurring: {
      frequency: 'daily',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    },
    recordingEnabled: false,
    transcriptEnabled: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'mtg-002',
    title: 'Sprint Planning',
    type: 'sprint_planning',
    status: 'scheduled',
    hostId: 'usr-002',
    participantIds: ['usr-001', 'usr-002', 'usr-004'],
    scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    duration: 60,
    recordingEnabled: true,
    transcriptEnabled: true,
    createdAt: new Date('2024-01-20'),
  },
];

// ============================================================================
// Manager Class
// ============================================================================

/**
 * Configuration for the collaboration platform, controlling enabled features and limits.
 */
export interface CollaborationConfig {
  /** Name of the organization using the platform. */
  organization: string;
  /** Optional description of the deployment. */
  description?: string;
  /** Whether messaging is enabled. */
  enableMessaging?: boolean;
  /** Whether file sharing is enabled. */
  enableFileSharing?: boolean;
  /** Whether code review workflows are enabled. */
  enableCodeReview?: boolean;
  /** Whether task management is enabled. */
  enableTaskManagement?: boolean;
  /** Whether video conferencing is enabled. */
  enableVideoConferencing?: boolean;
  /** Whether analytics reporting is enabled. */
  enableAnalytics?: boolean;
  /** Maximum allowed file size in megabytes. */
  maxFileSize?: number;
  /** Maximum number of members allowed in a team. */
  maxTeamSize?: number;
}

/**
 * Central manager for the collaboration platform. Stores and orchestrates users,
 * teams, channels, messages, documents, code reviews, tasks, meetings,
 * notifications, and activity logs.
 */
export class CollaborationManager {
  private users: Map<string, User> = new Map();
  private teams: Map<string, Team> = new Map();
  private channels: Map<string, Channel> = new Map();
  private messages: Map<string, Message> = new Map();
  private threads: Map<string, Thread> = new Map();
  private documents: Map<string, Document> = new Map();
  private reviews: Map<string, CodeReview> = new Map();
  private tasks: Map<string, TaskCollab> = new Map();
  private meetings: Map<string, Meeting> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private activities: Map<string, Activity> = new Map();

  /**
   * Creates a new CollaborationManager and seeds it with example data.
   *
   * @param config - Configuration for the collaboration platform.
   */
  constructor(private config: CollaborationConfig) {
    this.initializeExampleData();
  }

  private initializeExampleData(): void {
    exampleUsers.forEach(u => this.users.set(u.id, u));
    exampleTeams.forEach(t => {
      t.channels = exampleChannels.filter(c => c.teamId === t.id);
      this.teams.set(t.id, t);
    });
    exampleChannels.forEach(c => this.channels.set(c.id, c));
    exampleMessages.forEach(m => this.messages.set(m.id, m));
    exampleDocuments.forEach(d => this.documents.set(d.id, d));
    exampleCodeReviews.forEach(r => this.reviews.set(r.id, r));
    exampleTasks.forEach(t => this.tasks.set(t.id, t));
    exampleMeetings.forEach(m => this.meetings.set(m.id, m));
  }

  /**
   * Generates a unique identifier combining a prefix, timestamp, and random segment.
   *
   * @param prefix - Prefix prepended to the generated identifier.
   * @returns A unique identifier string.
   */
  generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Creates a new user and records the creation as an activity.
   *
   * @param user - User attributes excluding `id`, `joinedAt`, and `lastSeen`.
   * @returns The newly created user with generated identifiers.
   */
  // User Management
  createUser(user: Omit<User, 'id' | 'joinedAt' | 'lastSeen'>): User {
    const id = this.generateId('usr');
    const newUser: User = {
      ...user,
      id,
      joinedAt: new Date(),
      lastSeen: new Date(),
    };
    this.users.set(id, newUser);
    this.logActivity('user', id, 'created', { ...newUser } as Record<string, unknown>);
    return newUser;
  }

  /**
   * Retrieves a user by ID.
   *
   * @param id - ID of the user to look up.
   * @returns The user, or `undefined` if not found.
   */
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /**
   * Lists users, optionally filtered by status or department, sorted by name.
   *
   * @param filters - Optional filters for status and department.
   * @returns Array of matching users sorted alphabetically by name.
   */
  listUsers(filters?: { status?: User['status']; department?: string }): User[] {
    let users = Array.from(this.users.values());
    if (filters?.status) {
      users = users.filter(u => u.status === filters.status);
    }
    if (filters?.department) {
      users = users.filter(u => u.department === filters.department);
    }
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Updates a user's presence status and refreshes their last-seen timestamp.
   *
   * @param userId - ID of the user to update.
   * @param status - New presence status.
   */
  updateUserStatus(userId: string, status: User['status']): void {
    const user = this.users.get(userId);
    if (user) {
      user.status = status;
      user.lastSeen = new Date();
    }
  }

  /**
   * Creates a new team and records the creation as an activity.
   *
   * @param team - Team attributes excluding `id`, `createdAt`, and `channels`.
   * @returns The newly created team with generated identifiers.
   */
  // Team Management
  createTeam(team: Omit<Team, 'id' | 'createdAt' | 'channels'>): Team {
    const id = this.generateId('team');
    const newTeam: Team = {
      ...team,
      id,
      channels: [],
      createdAt: new Date(),
    };
    this.teams.set(id, newTeam);
    this.logActivity('team', id, 'created', { ...newTeam } as Record<string, unknown>);
    return newTeam;
  }

  /**
   * Adds a user to a team with the specified role, if not already a member.
   *
   * @param teamId - ID of the team to add the user to.
   * @param userId - ID of the user to add.
   * @param role - Role to assign to the new member.
   */
  addTeamMember(teamId: string, userId: string, role: TeamRole): void {
    const team = this.teams.get(teamId);
    if (team && this.users.has(userId)) {
      const existingMember = team.members.find(m => m.userId === userId);
      if (!existingMember) {
        team.members.push({
          userId,
          role,
          joinedAt: new Date(),
          permissions: role === 'admin' ? ['all'] : ['read', 'write'],
        });
        this.logActivity('team', teamId, 'member_added', { userId, role } as Record<string, unknown>);
      }
    }
  }

  /**
   * Lists teams, optionally filtered to those a user belongs to, sorted by name.
   *
   * @param userId - Optional user ID to filter teams by membership.
   * @returns Array of matching teams sorted alphabetically by name.
   */
  listTeams(userId?: string): Team[] {
    let teams = Array.from(this.teams.values());
    if (userId) {
      teams = teams.filter(t => t.members.some(m => m.userId === userId));
    }
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Creates a new communication channel and records the creation as an activity.
   *
   * @param channel - Channel attributes excluding `id` and `createdAt`.
   * @returns The newly created channel with generated identifiers.
   */
  // Channel Management
  createChannel(channel: Omit<Channel, 'id' | 'createdAt'>): Channel {
    const id = this.generateId('chan');
    const newChannel: Channel = {
      ...channel,
      id,
      createdAt: new Date(),
    };
    this.channels.set(id, newChannel);
    this.logActivity('channel', id, 'created', { ...newChannel } as Record<string, unknown>);
    return newChannel;
  }

  /**
   * Retrieves a channel by ID.
   *
   * @param id - ID of the channel to look up.
   * @returns The channel, or `undefined` if not found.
   */
  getChannel(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  /**
   * Sends a message to a channel, updating the parent thread if applicable.
   *
   * @param message - Message attributes excluding `id`, `createdAt`, `reactions`, and `replies`.
   * @returns The newly created message with generated identifiers.
   */
  // Message Management
  sendMessage(message: Omit<Message, 'id' | 'createdAt' | 'reactions' | 'replies'>): Message {
    const id = this.generateId('msg');
    const newMessage: Message = {
      ...message,
      id,
      reactions: [],
      replies: 0,
      createdAt: new Date(),
    };
    this.messages.set(id, newMessage);

    // Update thread parent if applicable
    if (message.threadId) {
      const thread = this.threads.get(message.threadId);
      if (thread) {
        thread.messages.push(newMessage);
      }
    }

    this.logActivity('message', id, 'sent', { channelId: message.channelId });
    return newMessage;
  }

  /**
   * Adds an emoji reaction from a user to a message, creating the reaction if new.
   *
   * @param messageId - ID of the message to react to.
   * @param emoji - Reaction emoji to apply.
   * @param userId - ID of the user adding the reaction.
   */
  addReaction(messageId: string, emoji: ReactionType, userId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      let reaction = message.reactions.find(r => r.emoji === emoji);
      if (!reaction) {
        reaction = { emoji, userIds: [] };
        message.reactions.push(reaction);
      }
      if (!reaction.userIds.includes(userId)) {
        reaction.userIds.push(userId);
      }
    }
  }

  /**
   * Retrieves recent non-deleted messages for a channel, newest first.
   *
   * @param channelId - ID of the channel to fetch messages for.
   * @param limit - Maximum number of messages to return. Defaults to 50.
   * @returns Array of messages sorted from newest to oldest.
   */
  getChannelMessages(channelId: string, limit = 50): Message[] {
    return Array.from(this.messages.values())
      .filter(m => m.channelId === channelId && !m.deletedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Creates a new document at version 1 and records the creation as an activity.
   *
   * @param document - Document attributes excluding `id`, `createdAt`, `updatedAt`, and `version`.
   * @returns The newly created document with generated identifiers.
   */
  // Document Management
  createDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Document {
    const id = this.generateId('doc');
    const newDocument: Document = {
      ...document,
      id,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.documents.set(id, newDocument);
    this.logActivity('document', id, 'created', { ...newDocument } as Record<string, unknown>);
    return newDocument;
  }

  /**
   * Retrieves a document by ID.
   *
   * @param id - ID of the document to look up.
   * @returns The document, or `undefined` if not found.
   */
  getDocument(id: string): Document | undefined {
    return this.documents.get(id);
  }

  /**
   * Lists documents, optionally filtered to those owned by or shared with a user,
   * sorted by most recently updated.
   *
   * @param userId - Optional user ID to filter documents by ownership or permission.
   * @returns Array of matching documents sorted by last update time.
   */
  listDocuments(userId?: string): Document[] {
    let docs = Array.from(this.documents.values());
    if (userId) {
      docs = docs.filter(d => d.ownerId === userId || d.permissions.some(p => p.userId === userId));
    }
    return docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Creates a new code review in `pending` status and notifies assigned reviewers.
   *
   * @param review - Review attributes excluding `id`, `createdAt`, `status`, and `comments`.
   * @returns The newly created code review with generated identifiers.
   */
  // Code Review Management
  createCodeReview(review: Omit<CodeReview, 'id' | 'createdAt' | 'status' | 'comments'>): CodeReview {
    const id = this.generateId('rev');
    const newReview: CodeReview = {
      ...review,
      id,
      status: 'pending',
      comments: [],
      createdAt: new Date(),
    };
    this.reviews.set(id, newReview);

    // Notify reviewers
    review.reviewers.forEach(r => {
      this.createNotification({
        userId: r.userId,
        type: 'assignment',
        priority: 'normal',
        title: 'Code Review Request',
        content: `You are requested to review: ${review.title}`,
        actionUrl: `/review/${id}`,
      });
    });

    this.logActivity('review', id, 'created', { ...newReview } as Record<string, unknown>);
    return newReview;
  }

  /**
   * Records a reviewer's decision on a code review and recalculates the review's
   * overall status based on all reviewer submissions.
   *
   * @param reviewId - ID of the code review being submitted.
   * @param userId - ID of the reviewer submitting their decision.
   * @param status - The reviewer's decision.
   * @param commentId - Optional ID of an associated comment.
   */
  submitReview(reviewId: string, userId: string, status: Reviewer['status'], commentId?: string): void {
    const review = this.reviews.get(reviewId);
    if (review) {
      const reviewer = review.reviewers.find(r => r.userId === userId);
      if (reviewer) {
        reviewer.status = status;
        reviewer.submittedAt = new Date();
      }

      // Update overall status based on all reviewers
      const allReviewed = review.reviewers.every(r => r.status !== 'pending');
      const hasChanges = review.reviewers.some(r => r.status === 'changes_requested');
      const allApproved = review.reviewers.every(r => r.status === 'approved');

      if (allReviewed && !hasChanges && allApproved) {
        review.status = 'approved';
      } else if (hasChanges) {
        review.status = 'changes_requested';
      }

      this.logActivity('review', reviewId, 'reviewed', { userId, status });
    }
  }

  /**
   * Creates a new collaborative task and notifies assignees (excluding the creator).
   *
   * @param task - Task attributes excluding `id`, `createdAt`, and `updatedAt`.
   * @returns The newly created task with generated identifiers.
   */
  // Task Management
  createTask(task: Omit<TaskCollab, 'id' | 'createdAt' | 'updatedAt'>): TaskCollab {
    const id = this.generateId('task');
    const newTask: TaskCollab = {
      ...task,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(id, newTask);

    // Notify assignees
    task.assigneeIds.forEach(aid => {
      if (aid !== task.creatorId) {
        this.createNotification({
          userId: aid,
          type: 'assignment',
          priority: task.priority === 'critical' ? 'urgent' : 'normal',
          title: 'New Task Assignment',
          content: `You have been assigned to: ${task.title}`,
          actionUrl: `/task/${id}`,
        });
      }
    });

    this.logActivity('task', id, 'created', { ...newTask } as Record<string, unknown>);
    return newTask;
  }

  /**
   * Updates the status of a task, setting the completed timestamp when marked done.
   *
   * @param taskId - ID of the task to update.
   * @param status - New status for the task.
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      if (status === 'done') {
        task.completedAt = new Date();
      }
      this.logActivity('task', taskId, 'status_updated', { status });
    }
  }

  /**
   * Creates a new meeting in `scheduled` status and notifies invited participants.
   *
   * @param meeting - Meeting attributes excluding `id`, `createdAt`, and `status`.
   * @returns The newly created meeting with generated identifiers.
   */
  // Meeting Management
  createMeeting(meeting: Omit<Meeting, 'id' | 'createdAt' | 'status'>): Meeting {
    const id = this.generateId('mtg');
    const newMeeting: Meeting = {
      ...meeting,
      id,
      status: 'scheduled',
      createdAt: new Date(),
    };
    this.meetings.set(id, newMeeting);

    // Notify participants
    meeting.participantIds.forEach(pid => {
      if (pid !== meeting.hostId) {
        this.createNotification({
          userId: pid,
          type: 'reminder',
          priority: 'normal',
          title: 'Meeting Invitation',
          content: `You are invited to: ${meeting.title}`,
          actionUrl: `/meeting/${id}`,
        });
      }
    });

    this.logActivity('meeting', id, 'created', { ...newMeeting } as Record<string, unknown>);
    return newMeeting;
  }

  /**
   * Marks a scheduled meeting as started and logs the transition as an activity.
   *
   * @param meetingId - ID of the meeting to start.
   */
  startMeeting(meetingId: string): void {
    const meeting = this.meetings.get(meetingId);
    if (meeting) {
      meeting.status = 'started';
      this.logActivity('meeting', meetingId, 'started', {});
    }
  }

  /**
   * Creates a new unread, undismissed notification for a user.
   *
   * @param notification - Notification attributes excluding `id`, `read`, `dismissed`, and `createdAt`.
   * @returns The newly created notification with generated identifiers.
   */
  // Notification Management
  createNotification(notification: Omit<Notification, 'id' | 'read' | 'dismissed' | 'createdAt'>): Notification {
    const id = this.generateId('notif');
    const newNotification: Notification = {
      ...notification,
      id,
      read: false,
      dismissed: false,
      createdAt: new Date(),
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  /**
   * Lists notifications for a user, optionally limited to unread items, newest first.
   *
   * @param userId - ID of the user whose notifications to retrieve.
   * @param unreadOnly - Whether to return only unread notifications. Defaults to false.
   * @returns Array of matching notifications sorted from newest to oldest.
   */
  getUserNotifications(userId: string, unreadOnly = false): Notification[] {
    let notifications = Array.from(this.notifications.values()).filter(n => n.userId === userId);
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Marks a single notification as read.
   *
   * @param notificationId - ID of the notification to mark as read.
   */
  markNotificationRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Computes aggregated analytics for the platform across a given date range.
   *
   * @param period - Granularity of the reporting period.
   * @param startDate - Start of the reporting window.
   * @param endDate - End of the reporting window.
   * @returns An Analytics object containing metrics for the period.
   */
  // Analytics
  getAnalytics(period: Analytics['period'], startDate: Date, endDate: Date): Analytics {
    const messages = Array.from(this.messages.values());
    const reviews = Array.from(this.reviews.values());
    const tasks = Array.from(this.tasks.values());
    const meetings = Array.from(this.meetings.values());
    const users = Array.from(this.users.values());
    const teams = Array.from(this.teams.values());

    const periodMessages = messages.filter(m => m.createdAt >= startDate && m.createdAt <= endDate);
    const periodReviews = reviews.filter(r => r.createdAt >= startDate && r.createdAt <= endDate);
    const periodTasks = tasks.filter(t => t.createdAt >= startDate && t.createdAt <= endDate);
    const periodMeetings = meetings.filter(m => m.createdAt >= startDate && m.createdAt <= endDate);
    const periodUsers = users.filter(u => u.joinedAt >= startDate && u.joinedAt <= endDate);

    return {
      period,
      startDate,
      endDate,
      metrics: {
        users: {
          total: users.length,
          active: users.filter(u => u.status !== 'offline').length,
          new: periodUsers.length,
          retention: 92, // Simplified calculation
        },
        teams: {
          total: teams.length,
          active: teams.filter(t => t.members.length > 0).length,
          avgSize: Math.round(teams.reduce((sum, t) => sum + t.members.length, 0) / teams.length) || 0,
        },
        messages: {
          sent: periodMessages.length,
          read: Math.round(periodMessages.length * 0.85),
          avgResponseTime: 15,
          mostActiveChannels: this.getTopChannels(periodMessages, 5),
        },
        documents: {
          created: Math.floor(periodMessages.length / 10),
          edited: Math.floor(periodMessages.length / 5),
          shared: Math.floor(periodMessages.length / 8),
          mostViewed: [],
        },
        codeReviews: {
          opened: periodReviews.length,
          merged: periodReviews.filter(r => r.status === 'approved').length,
          closed: periodReviews.filter(r => r.status === 'rejected').length,
          avgReviewTime: 18,
          approvalRate: periodReviews.length > 0 ? Math.round((periodReviews.filter(r => r.status === 'approved').length / periodReviews.length) * 100) : 0,
        },
        tasks: {
          created: periodTasks.length,
          completed: periodTasks.filter(t => t.status === 'done').length,
          overdue: periodTasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'done').length,
          avgCompletionTime: 48,
        },
        meetings: {
          scheduled: periodMeetings.length,
          completed: periodMeetings.filter(m => m.status === 'ended').length,
          cancelled: periodMeetings.filter(m => m.status === 'cancelled').length,
          avgDuration: 45,
          attendanceRate: 87,
        },
      },
    };
  }

  private getTopChannels(messages: Message[], limit: number): { channelId: string; count: number }[] {
    const counts = new Map<string, number>();
    messages.forEach(m => {
      counts.set(m.channelId, (counts.get(m.channelId) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([channelId, count]) => ({ channelId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private logActivity(entityType: Activity['entityType'], entityId: string, action: string, metadata?: Record<string, unknown>): void {
    const activity: Activity = {
      id: this.generateId('act'),
      userId: metadata?.['userId'] as string || 'system',
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date(),
    };
    this.activities.set(activity.id, activity);
  }

  /**
   * Builds a high-level summary of the platform including counts of each entity
   * type and the last month's analytics metrics.
   *
   * @returns A summary object with organization name, entity counts, and monthly metrics.
   */
  getSummary(): Record<string, unknown> {
    const analytics = this.getAnalytics('month', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());

    return {
      organization: this.config.organization,
      users: {
        total: this.users.size,
        online: Array.from(this.users.values()).filter(u => u.status === 'online').length,
      },
      teams: this.teams.size,
      channels: this.channels.size,
      messages: this.messages.size,
      documents: this.documents.size,
      codeReviews: this.reviews.size,
      tasks: this.tasks.size,
      meetings: this.meetings.size,
      monthlyMetrics: analytics.metrics,
    };
  }
}

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates a Markdown documentation guide for the collaboration platform,
 * including a platform summary, feature descriptions, and usage examples.
 *
 * @param name - Name of the organization the guide is generated for.
 * @param manager - CollaborationManager instance used to compute summaries and analytics.
 * @returns A Markdown string describing the platform.
 */
export function generateMarkdown(name: string, manager: CollaborationManager): string {
  const summary = manager.getSummary();
  const analytics = manager.getAnalytics('month', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());

  return `# Enterprise Collaboration and Team Management
**Generated for:** ${name}

## Overview

This platform provides comprehensive tools for team collaboration, including messaging, file sharing, code reviews, task management, and video conferencing.

---

## Platform Summary

| Metric | Count |
|--------|-------|
| Total Users | ${summary.users} |
| Online Now | ${(summary.users as { online?: number }).online} |
| Teams | ${summary.teams} |
| Channels | ${summary.channels} |
| Messages This Month | ${analytics.metrics.messages.sent} |
| Documents | ${summary.documents} |
| Code Reviews | ${summary.codeReviews} |
| Active Tasks | ${summary.tasks} |
| Meetings This Month | ${analytics.metrics.meetings.scheduled} |

---

## Features

### Messaging
- Real-time chat with channels and direct messages
- Threaded conversations
- Reactions and emoji responses
- File and image sharing
- Message search and archival

### Document Collaboration
- Real-time document editing
- Version history
- Permission-based access control
- Templates and shared libraries

### Code Review
- Pull request workflow
- Inline comments and suggestions
- Reviewer assignment and tracking
- Approval workflows

### Task Management
- Task creation and assignment
- Subtasks and dependencies
- Progress tracking
- Due date reminders

### Video Conferencing
- Scheduled and ad-hoc meetings
- Screen sharing
- Recording and transcription
- Recurring meetings

---

## Getting Started

### Creating a Team
\`\`\`typescript
const team = manager.createTeam({
  name: 'Engineering',
  description: 'Core engineering team',
  owner: 'user-id',
  members: [],
  settings: {
    isPublic: true,
    allowGuestAccess: false,
    allowExternalSharing: false,
    defaultChannelType: 'text',
    messageRetention: 90,
    fileRetention: 365,
    requireApprovalForGuests: true,
  },
});
\`\`\`

### Sending a Message
\`\`\`typescript
const message = manager.sendMessage({
  channelId: 'channel-id',
  authorId: 'user-id',
  content: 'Hello team!',
  type: 'text',
  attachments: [],
  mentions: [],
  pinned: false,
});
\`\`\`

### Creating a Task
\`\`\`typescript
const task = manager.createTask({
  title: 'Implement feature',
  description: 'Add new feature to product',
  status: 'todo',
  priority: 'high',
  assigneeIds: ['user-id'],
  creatorId: 'creator-id',
  dueDate: new Date('2024-12-31'),
  tags: ['feature', 'backend'],
  dependencies: [],
  subtasks: [],
  comments: [],
  attachments: [],
});
\`\`\`

---

*Document generated on ${new Date().toISOString()}*
`;
}

/**
 * Generates Terraform infrastructure code for the collaboration platform
 * targeting the specified cloud provider.
 *
 * @param provider - Cloud provider to generate Terraform for (`aws`, `azure`, or `gcp`).
 * @param name - Name of the organization, used to derive resource names.
 * @param config - Collaboration configuration influencing resource settings.
 * @returns A Terraform configuration string for the chosen provider.
 */
export function generateTerraform(provider: 'aws' | 'azure' | 'gcp', name: string, config: CollaborationConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  if (provider === 'aws') {
    const code = `# Terraform for Collaboration Platform - AWS
# Generated for ${name}

# ============================================================================
# Storage and Database
# ============================================================================

# S3 for file storage
resource "aws_s3_bucket" "collaboration_files" {
  name = "${normalizedName}-files"
  force_destroy = false

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  lifecycle_rule {
    id = "delete_old_versions"
    enabled = true
    noncurrent_version_expiration {
      days = ${config.maxFileSize || 90}
    }
  }
}

# DynamoDB for messages
resource "aws_dynamodb_table" "messages" {
  name = "${normalizedName}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  global_secondary_index {
    name = "ChannelIndex"
    hash_key = "channelId"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# DynamoDB for sessions
resource "aws_dynamodb_table" "sessions" {
  name = "${normalizedName}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled = true
  }
}

# ============================================================================
# Real-time Communication (WebSocket API)
# ============================================================================

resource "aws_apigatewayv2_api" "websocket" {
  name = "${normalizedName}-websocket"
  protocol_type = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_stage" "production" {
  api_id = aws_apigatewayv2_api.websocket.id
  name = "production"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit = 100
    throttling_rate_limit = 50
  }
}

resource "aws_apigatewayv2_integration" "connect" {
  api_id = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"
  integration_uri = aws_lambda_function.connect_invoke.arn
}

resource "aws_apigatewayv2_route" "connect" {
  api_id = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target = "integrations/"
  + aws_apigatewayv2_integration.connect.id
}

# Lambda for WebSocket connections
resource "aws_lambda_function" "connect_invoke" {
  function_name = "${normalizedName}-ws-connect"
  role = aws_iam_role.lambda_role.arn
  package_type = "Zip"
  runtime = "nodejs20.x"
  handler = "index.handler"

  filename = "ws-connect.zip"

  environment {
    variables = {
      MESSAGES_TABLE = aws_dynamodb_table.messages.name
      SESSIONS_TABLE = aws_dynamodb_table.sessions.name
    }
  }
}

# ============================================================================
# Video Conferencing
# ============================================================================

# Kinesis Video Streams for video
resource "aws_kinesis_video_stream" "meetings" {
  name = "${normalizedName}-meetings"
  data_retention_in_hours = 24

  media_type = "video/h264"
}

# ============================================================================
# Notifications
# ============================================================================

# SNS for notifications
resource "aws_sns_topic" "notifications" {
  name = "${normalizedName}-notifications"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol = "email"
  endpoint = "notifications@${normalizedName}.com"
}

resource "aws_sns_topic_subscription" "slack" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol = "https"
  endpoint = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
}

# ============================================================================
# IAM
# ============================================================================

resource "aws_iam_role" "lambda_role" {
  name = "${normalizedName}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "s3" {
  role = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "kinesis" {
  role = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonKinesisVideoStreamsFullAccess"
}

resource "aws_iam_role_policy_attachment" "sns" {
  role = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSNSFullAccess"
}
`;
  }

  if (provider === 'azure') {
    return `# Terraform for Collaboration Platform - Azure
# Generated for ${name}

# ============================================================================
# Storage and Database
# ============================================================================

# Storage Account for files
resource "azurerm_storage_account" "collaboration" {
  name = "${normalizedName}storage"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
  account_tier = "Standard"
  account_replication_type = "GRS"

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
  }
}

# Cosmos DB for messages
resource "azurerm_cosmosdb_account" "messages" {
  name = "${normalizedName}-cosmos"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type = "Standard"
  kind = "GlobalDocumentDB"

  enable_automatic_failover = false

  consistency_policy {
    consistency_level = "Session"
  }
}

resource "azurerm_cosmosdb_sql_database" "messages" {
  name = "collaboration"
  resource_group_name = azurerm_resource_group.main.name
  account_name = azurerm_cosmosdb_account.messages.name
}

# ============================================================================
# Real-time Communication
# ============================================================================

# SignalR Service for WebSocket
resource "azurerm_signalr_service" "main" {
  name = "${normalizedName}-signalr"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name

  sku {
    name = "Standard_S1"
    capacity = 1
  }

  cors {
    allowed_origins = ["https://${normalizedName}.com"]
  }
}

# ============================================================================
# Video Conferencing
# ============================================================================

# Communication Services
resource "azurerm_communication_service" "meetings" {
  name = "${normalizedName}-acs"
  location = "global"
  data_location = "United States"
}

# ============================================================================
# Notifications
# ============================================================================

# Event Grid for notifications
resource "azurerm_eventgrid_topic" "notifications" {
  name = "${normalizedName}-notifications"
  location = var.location
  resource_group_name = azurerm_resource_group.main.name
}

# Event Grid subscription for email
resource "azurerm_eventgrid_event_subscription" "email" {
  name = "${normalizedName}-email-sub"
  scope = azurerm_eventgrid_topic.notifications.id
  endpoint = "notifications@${normalizedName}.com"
  event_delivery_schema = "EventGridSchema"
}

resource "azurerm_resource_group" "main" {
  name = "${normalizedName}-rg"
  location = var.location
}
`;
  }

  // GCP
  return `# Terraform for Collaboration Platform - GCP
# Generated for ${name}

# ============================================================================
# Storage and Database
# ============================================================================

# Storage for files
resource "google_storage_bucket" "files" {
  name = "${normalizedName}-files"
  location = var.location
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = ${config.maxFileSize || 90}
    }
    action {
      type = "Delete"
    }
  }
}

# Firestore for messages
resource "google_firestore_database" "messages" {
  name = "${normalizedName}-db"
  location = var.location
  type = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
}

# ============================================================================
# Real-time Communication
# ============================================================================

# Pub/Sub for real-time messaging
resource "google_pubsub_topic" "messages" {
  name = "${normalizedName}-messages"
}

resource "google_pubsub_subscription" "messages" {
  name = "${normalizedName}-messages-sub"
  topic = google_pubsub_topic.messages.id

  ack_deadline_seconds = 20
}

# ============================================================================
# Video Conferencing
# ============================================================================

# Video API for meetings
resource "google_video_live_stream" "meetings" {
  name = "${normalizedName}-meetings"
  location = var.location

  input {
    type = "RTMP_PUSH"
    input_tags {
      key = "env"
      value = "production"
    }
  }
}

# ============================================================================
# Notifications
# ============================================================================

# Cloud Pub/Sub for notifications
resource "google_pubsub_topic" "notifications" {
  name = "${normalizedName}-notifications"
}

# Cloud Tasks for notification delivery
resource "google_cloud_tasks_queue" "notifications" {
  name = "${normalizedName}-notification-queue"
  location = var.location

  rate_limits {
    max_dispatches_per_second = 10
  }

  retry_config {
    max_attempts = 3
    min_backoff = "1s"
    max_backoff = "10s"
  }
}
`;
}

/**
 * Generates a self-contained TypeScript source file implementing a simplified
 * collaboration manager, including enums, interfaces, a manager class, and a
 * usage example.
 *
 * @param name - Name of the organization the code is generated for.
 * @param config - Collaboration configuration (currently unused beyond the name).
 * @returns A TypeScript source code string.
 */
export function generateTypeScript(name: string, config: CollaborationConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  return `// Collaboration Manager - TypeScript
// Generated for ${name}

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// Enums
// ============================================================================

export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest',
  VIEWER = 'viewer'
}

export enum ChannelType {
  TEXT = 'text',
  VOICE = 'voice',
  VIDEO = 'video',
  ANNOUNCEMENT = 'announcement',
  PRIVATE = 'private',
  ARCHIVED = 'archived'
}

export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum MeetingType {
  STANDUP = 'standup',
  SPRINT_PLANNING = 'sprint_planning',
  RETROSPECTIVE = 'retrospective',
  REVIEW = 'review',
  ONE_ON_ONE = 'one_on_one',
  ALL_HANDS = 'all_hands',
  AD_HOC = 'ad_hoc'
}

// ============================================================================
// Interfaces
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  timezone: string;
  joinedAt: Date;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  dueDate?: Date;
  createdAt: Date;
}

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  participantIds: string[];
  scheduledFor: Date;
  duration: number;
}

// ============================================================================
// Manager Class
// ============================================================================

export class CollaborationManager extends EventEmitter {
  private users: Map<string, User> = new Map();
  private messages: Map<string, Message> = new Map();
  private tasks: Map<string, Task> = new Map();
  private meetings: Map<string, Meeting> = new Map();

  constructor(private organization: string) {
    super();
  }

  generateId(prefix: string): string {
    return \`\${prefix}-\${Date.now()}-\${randomUUID().slice(0, 8)}\`;
  }

  // User Management
  createUser(name: string, email: string, timezone: string): User {
    const id = this.generateId('usr');
    const user: User = {
      id,
      name,
      email,
      status: 'offline',
      timezone,
      joinedAt: new Date()
    };
    this.users.set(id, user);
    this.emit('userCreated', user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  updateUserStatus(id: string, status: User['status']): void {
    const user = this.users.get(id);
    if (user) {
      user.status = status;
      this.emit('userStatusChanged', { userId: id, status });
    }
  }

  // Message Management
  sendMessage(channelId: string, authorId: string, content: string): Message {
    const id = this.generateId('msg');
    const message: Message = {
      id,
      channelId,
      authorId,
      content,
      createdAt: new Date()
    };
    this.messages.set(id, message);
    this.emit('messageSent', message);
    return message;
  }

  getChannelMessages(channelId: string, limit = 50): Message[] {
    return Array.from(this.messages.values())
      .filter(m => m.channelId === channelId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Task Management
  createTask(
    title: string,
    priority: TaskPriority,
    assigneeIds: string[],
    dueDate?: Date
  ): Task {
    const id = this.generateId('task');
    const task: Task = {
      id,
      title,
      status: TaskStatus.TODO,
      priority,
      assigneeIds,
      dueDate,
      createdAt: new Date()
    };
    this.tasks.set(id, task);
    this.emit('taskCreated', task);

    // Notify assignees
    assigneeIds.forEach(aid => {
      this.emit('notification', {
        userId: aid,
        type: 'task_assignment',
        taskId: id,
        title
      });
    });

    return task;
  }

  updateTaskStatus(id: string, status: TaskStatus): void {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      this.emit('taskUpdated', task);
    }
  }

  // Meeting Management
  createMeeting(
    title: string,
    type: MeetingType,
    participantIds: string[],
    scheduledFor: Date,
    duration: number
  ): Meeting {
    const id = this.generateId('mtg');
    const meeting: Meeting = {
      id,
      title,
      type,
      participantIds,
      scheduledFor,
      duration
    };
    this.meetings.set(id, meeting);
    this.emit('meetingCreated', meeting);
    return meeting;
  }

  // Analytics
  getMetrics() {
    return {
      users: {
        total: this.users.size,
        online: Array.from(this.users.values()).filter(u => u.status === 'online').length
      },
      messages: this.messages.size,
      tasks: {
        total: this.tasks.size,
        completed: Array.from(this.tasks.values()).filter(t => t.status === TaskStatus.DONE).length
      },
      meetings: this.meetings.size
    };
  }

  getSummary() {
    const metrics = this.getMetrics();
    return {
      organization: this.organization,
      metrics
    };
  }
}

// ============================================================================
// Usage Example
// ============================================================================

const manager = new CollaborationManager('${normalizedName}');

// Create a user
const user = manager.createUser('Alice Johnson', 'alice@example.com', 'America/Los_Angeles');

// Update user status
manager.updateUserStatus(user.id, 'online');

// Send a message
const message = manager.sendMessage('chan-001', user.id, 'Hello team!');

// Create a task
const task = manager.createTask(
  'Implement feature',
  TaskPriority.HIGH,
  [user.id],
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
);

// Create a meeting
const meeting = manager.createMeeting(
  'Sprint Planning',
  MeetingType.SPRINT_PLANNING,
  [user.id],
  new Date(Date.now() + 24 * 60 * 60 * 1000),
  60
);

// Get metrics
const metrics = manager.getMetrics();
console.log('Collaboration Metrics:', metrics);

export { manager as collaborationManager };
`;
}

/**
 * Generates a self-contained Python source file implementing a simplified
 * collaboration manager, including enums, data classes, a manager class, and a
 * usage example.
 *
 * @param name - Name of the organization the code is generated for.
 * @param config - Collaboration configuration (currently unused beyond the name).
 * @returns A Python source code string.
 */
export function generatePython(name: string, config: CollaborationConfig): string {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  return `# Collaboration Manager - Python
# Generated for ${name}

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
import uuid
import json

# ============================================================================
# Enums
# ============================================================================

class TeamRole(Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"
    GUEST = "guest"
    VIEWER = "viewer"

class TaskStatus(Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in-progress"
    IN_REVIEW = "in-review"
    DONE = "done"
    CANCELLED = "cancelled"

class TaskPriority(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class MeetingType(Enum):
    STANDUP = "standup"
    SPRINT_PLANNING = "sprint-planning"
    RETROSPECTIVE = "retrospective"
    REVIEW = "review"
    ONE_ON_ONE = "one-on-one"
    ALL_HANDS = "all-hands"
    AD_HOC = "ad-hoc"

# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class User:
    id: str
    name: str
    email: str
    status: str  # online, away, busy, offline
    timezone: str
    joined_at: datetime = field(default_factory=datetime.now)

@dataclass
class Message:
    id: str
    channel_id: str
    author_id: str
    content: str
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class Task:
    id: str
    title: str
    status: TaskStatus
    priority: TaskPriority
    assignee_ids: List[str]
    due_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class Meeting:
    id: str
    title: str
    meeting_type: str
    participant_ids: List[str]
    scheduled_for: datetime
    duration: int  # minutes

# ============================================================================
# Manager Class
# ============================================================================

class CollaborationManager:
    def __init__(self, organization: str):
        self.organization = organization
        self.users: Dict[str, User] = {}
        self.messages: Dict[str, Message] = {}
        self.tasks: Dict[str, Task] = {}
        self.meetings: Dict[str, Meeting] = {}

    def generate_id(self, prefix: str) -> str:
        timestamp = int(datetime.now().timestamp())
        unique = uuid.uuid4().hex[:8]
        return f"{prefix}-{timestamp}-{unique}"

    # User Management
    def create_user(self, name: str, email: str, timezone: str) -> User:
        user_id = self.generate_id("usr")
        user = User(
            id=user_id,
            name=name,
            email=email,
            status="offline",
            timezone=timezone
        )
        self.users[user_id] = user
        return user

    def get_user(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)

    def update_user_status(self, user_id: str, status: str) -> None:
        user = self.users.get(user_id)
        if user:
            user.status = status

    # Message Management
    def send_message(self, channel_id: str, author_id: str, content: str) -> Message:
        message_id = self.generate_id("msg")
        message = Message(
            id=message_id,
            channel_id=channel_id,
            author_id=author_id,
            content=content
        )
        self.messages[message_id] = message
        return message

    def get_channel_messages(self, channel_id: str, limit: int = 50) -> List[Message]:
        messages = [m for m in self.messages.values() if m.channel_id == channel_id]
        return sorted(messages, key=lambda m: m.created_at, reverse=True)[:limit]

    # Task Management
    def create_task(
        self,
        title: str,
        priority: TaskPriority,
        assignee_ids: List[str],
        due_date: Optional[datetime] = None
    ) -> Task:
        task_id = self.generate_id("task")
        task = Task(
            id=task_id,
            title=title,
            status=TaskStatus.TODO,
            priority=priority,
            assignee_ids=assignee_ids,
            due_date=due_date
        )
        self.tasks[task_id] = task
        return task

    def update_task_status(self, task_id: str, status: TaskStatus) -> None:
        task = self.tasks.get(task_id)
        if task:
            task.status = status

    # Meeting Management
    def create_meeting(
        self,
        title: str,
        meeting_type: str,
        participant_ids: List[str],
        scheduled_for: datetime,
        duration: int
    ) -> Meeting:
        meeting_id = self.generate_id("mtg")
        meeting = Meeting(
            id=meeting_id,
            title=title,
            meeting_type=meeting_type,
            participant_ids=participant_ids,
            scheduled_for=scheduled_for,
            duration=duration
        )
        self.meetings[meeting_id] = meeting
        return meeting

    # Metrics
    def get_metrics(self) -> Dict[str, Any]:
        users_list = list(self.users.values())
        tasks_list = list(self.tasks.values())

        return {
            "users": {
                "total": len(users_list),
                "online": sum(1 for u in users_list if u.status == "online")
            },
            "messages": len(self.messages),
            "tasks": {
                "total": len(tasks_list),
                "completed": sum(1 for t in tasks_list if t.status == TaskStatus.DONE)
            },
            "meetings": len(self.meetings)
        }

    def get_summary(self) -> Dict[str, Any]:
        return {
            "organization": self.organization,
            "metrics": self.get_metrics()
        }

# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    manager = CollaborationManager("${normalizedName}")

    # Create a user
    user = manager.create_user("Alice Johnson", "alice@example.com", "America/Los_Angeles")

    # Update user status
    manager.update_user_status(user.id, "online")

    # Send a message
    message = manager.send_message("chan-001", user.id, "Hello team!")

    # Create a task
    task = manager.create_task(
        title="Implement feature",
        priority=TaskPriority.HIGH,
        assignee_ids=[user.id],
        due_date=datetime.now() + timedelta(days=7)
    )

    # Create a meeting
    meeting = manager.create_meeting(
        title="Sprint Planning",
        meeting_type="sprint-planning",
        participant_ids=[user.id],
        scheduled_for=datetime.now() + timedelta(hours=24),
        duration=60
    )

    # Get metrics
    metrics = manager.get_metrics()
    print("Collaboration Metrics:", json.dumps(metrics, indent=2, default=str))
`;
}

/**
 * Writes collaboration platform files to disk, including Terraform infrastructure
 * code, a language-specific manager implementation, a Markdown guide, and a JSON
 * configuration file.
 *
 * @param config - Collaboration configuration to drive file generation.
 * @param outputDir - Directory where generated files are written.
 * @param language - Target implementation language (`typescript` or `python`).
 * @returns A promise that resolves when all files have been written.
 */
export async function writeCollaborationFiles(
  config: CollaborationConfig,
  outputDir: string,
  language: string
): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const manager = new CollaborationManager(config);

  // Always generate Terraform
  const awsTerraform = generateTerraform('aws', config.organization, config);
  const terraformDir = path.join(outputDir, 'terraform', 'aws');
  await fs.ensureDir(terraformDir);
  await fs.writeFile(path.join(terraformDir, 'main.tf'), awsTerraform);

  // Generate language-specific files
  if (language === 'typescript') {
    const tsCode = generateTypeScript(config.organization, config);
    await fs.writeFile(path.join(outputDir, 'collaboration-manager.ts'), tsCode);

    const packageJson = {
      name: `${config.organization.toLowerCase()}-collaboration`,
      version: '1.0.0',
      description: 'Enterprise collaboration and team management platform',
      main: 'collaboration-manager.ts',
      scripts: {
        dev: 'ts-node collaboration-manager.ts',
        test: 'jest',
      },
      dependencies: {
        '@types/node': '^20.0.0',
        events: '^3.3.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePython(config.organization, config);
    await fs.writeFile(path.join(outputDir, 'collaboration_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'google-cloud-pubsub>=2.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  // Generate markdown and config
  const markdown = generateMarkdown(config.organization, manager);
  await fs.writeFile(path.join(outputDir, 'COLLABORATION_GUIDE.md'), markdown);

  const configJson = {
    organization: config.organization,
    description: config.description,
    enableMessaging: config.enableMessaging ?? true,
    enableFileSharing: config.enableFileSharing ?? true,
    enableCodeReview: config.enableCodeReview ?? true,
    enableTaskManagement: config.enableTaskManagement ?? true,
    enableVideoConferencing: config.enableVideoConferencing ?? true,
    enableAnalytics: config.enableAnalytics ?? true,
    maxFileSize: config.maxFileSize ?? 100,
    maxTeamSize: config.maxTeamSize ?? 1000,
  };
  await fs.writeFile(path.join(outputDir, 'collaboration-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns an example CollaborationConfig with all features enabled and default limits.
 *
 * @returns A fully populated example configuration object.
 */
export function createExampleCollaborationConfig(): CollaborationConfig {
  return {
    organization: 'Acme Corp',
    description: 'Enterprise collaboration platform',
    enableMessaging: true,
    enableFileSharing: true,
    enableCodeReview: true,
    enableTaskManagement: true,
    enableVideoConferencing: true,
    enableAnalytics: true,
    maxFileSize: 100,
    maxTeamSize: 1000,
  };
}

/**
 * Prints a formatted summary of the collaboration configuration to the console,
 * including organization details, enabled features, settings, and expected output files.
 *
 * @param config - Collaboration configuration to display.
 * @param language - Target implementation language (`typescript` or `python`).
 * @param output - Output directory path to include in the summary.
 */
export function displayCollaborationConfig(config: CollaborationConfig, language: string, output: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');

  console.log(chalk.cyan('\n✨ Enterprise Collaboration and Team Management'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Organization:'), config.organization);
  console.log(chalk.yellow('Description:'), config.description || 'N/A');
  console.log(chalk.yellow('Language:'), language);
  console.log(chalk.yellow('Output:'), output);
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.cyan('\n📊 Features:'));
  console.log(chalk.gray('  Messaging:'), config.enableMessaging ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  File Sharing:'), config.enableFileSharing ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Code Review:'), config.enableCodeReview ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Task Management:'), config.enableTaskManagement ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Video Conferencing:'), config.enableVideoConferencing ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('  Analytics:'), config.enableAnalytics ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled'));
  console.log(chalk.gray('\n⚙️  Settings:'));
  console.log(chalk.gray('  Max File Size:'), `${config.maxFileSize || 100} MB`);
  console.log(chalk.gray('  Max Team Size:'), config.maxTeamSize || 1000);
  console.log(chalk.gray('\n📁 Output Files:'));
  console.log(chalk.gray('  - collaboration-manager.' + (language === 'typescript' ? 'ts' : 'py')));
  console.log(chalk.gray('  - COLLABORATION_GUIDE.md'));
  console.log(chalk.gray('  - collaboration-config.json'));
  console.log(chalk.gray('  - terraform/provider/main.tf'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}
