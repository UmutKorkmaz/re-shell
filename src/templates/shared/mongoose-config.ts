// Shared Mongoose configuration for all Node.js backend templates
// This provides comprehensive MongoDB integration with schemas and validation

export interface MongooseConfig {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: Record<string, string>;
  scripts: Record<string, string>;
  postInstallCommands: string[];
}

export const getMongooseConfig = (): MongooseConfig => ({
  dependencies: {
    'mongoose': '^8.1.1',
    'bcrypt': '^5.1.1',
    'uuid': '^9.0.1',
    'validator': '^13.11.0',
    'slugify': '^1.6.6'
  },
  devDependencies: {
    '@types/bcrypt': '^5.0.2',
    '@types/uuid': '^9.0.7',
    '@types/validator': '^13.11.8'
  },
  scripts: {
    'db:seed': 'tsx src/database/seeds/index.ts',
    'db:drop': 'tsx src/database/scripts/drop.ts',
    'db:migrate': 'tsx src/database/scripts/migrate.ts',
    'db:backup': 'tsx src/database/scripts/backup.ts',
    'db:restore': 'tsx src/database/scripts/restore.ts'
  },
  files: {
    'src/config/database.ts': `import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  url: string;
  options: mongoose.ConnectOptions;
}

const getDatabaseConfig = (): DatabaseConfig => {
  const url = process.env.MONGODB_URL || 'mongodb://localhost:27017/myapp';
  
  const options: mongoose.ConnectOptions = {
    // Connection options
    maxPoolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    serverSelectionTimeoutMS: parseInt(process.env.DB_TIMEOUT || '5000'),
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '45000'),
    
    // Buffering options
    bufferMaxEntries: 0,
    bufferCommands: false,
    
    // Retry options
    retryWrites: true,
    retryReads: true,
  };

  return { url, options };
};

// Connection management
let isConnected = false;

export const connectToDatabase = async (): Promise<void> => {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  try {
    const { url, options } = getDatabaseConfig();
    
    await mongoose.connect(url, options);
    
    isConnected = true;
    logger.info('✅ Connected to MongoDB successfully');
    
    // Connection event handlers
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectFromDatabase = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

// Health check function
export const checkDatabaseConnection = async (): Promise<{ 
  status: string; 
  latency?: number; 
  details?: any;
}> => {
  try {
    const start = Date.now();
    
    // Ping the database
    await mongoose.connection.db?.admin().ping();
    
    const latency = Date.now() - start;
    
    return {
      status: 'ok',
      latency,
      details: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
      }
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { 
      status: 'error',
      details: {
        error: error.message,
        readyState: mongoose.connection.readyState,
      }
    };
  }
};

// Graceful shutdown
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Shutting down database connection...');
  await disconnectFromDatabase();
};

// Process event handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('beforeExit', gracefulShutdown);`,
    'src/models/User.ts': `import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import validator from 'validator';

// Enums
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// Interfaces
export interface IUser {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  profile: {
    bio?: string;
    avatar?: string;
    website?: string;
    location?: string;
    birthday?: Date;
    phone?: string;
    social?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
    preferences?: {
      theme: 'light' | 'dark' | 'auto';
      language: string;
      notifications: {
        email: boolean;
        push: boolean;
        sms: boolean;
      };
    };
  };
  verification: {
    isVerified: boolean;
    verificationToken?: string;
    verificationExpires?: Date;
  };
  security: {
    lastLogin?: Date;
    loginAttempts: number;
    lockUntil?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
  };
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
  };
}

// Document interface (includes Mongoose methods)
export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generatePasswordResetToken(): string;
  generateVerificationToken(): string;
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<this>;
  resetLoginAttempts(): Promise<this>;
  toPublicJSON(): Partial<IUser>;
}

// Model interface (includes static methods)
export interface IUserModel extends Model<IUserDocument> {
  findByEmail(email: string): Promise<IUserDocument | null>;
  findByResetToken(token: string): Promise<IUserDocument | null>;
  findByVerificationToken(token: string): Promise<IUserDocument | null>;
  getActiveUsers(limit?: number): Promise<IUserDocument[]>;
  getUserStats(): Promise<{
    total: number;
    active: number;
    verified: number;
    byRole: Record<UserRole, number>;
  }>;
}

// Schema definition
const UserSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
    index: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false, // Don't include in queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING,
    index: true,
  },
  profile: {
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    avatar: {
      type: String,
      validate: [validator.isURL, 'Avatar must be a valid URL'],
    },
    website: {
      type: String,
      validate: [validator.isURL, 'Website must be a valid URL'],
    },
    location: {
      type: String,
      maxlength: [100, 'Location cannot exceed 100 characters'],
    },
    birthday: {
      type: Date,
      validate: {
        validator: function(date: Date) {
          return date < new Date();
        },
        message: 'Birthday must be in the past',
      },
    },
    phone: {
      type: String,
      validate: [validator.isMobilePhone, 'Please provide a valid phone number'],
    },
    social: {
      twitter: String,
      linkedin: String,
      github: String,
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      language: {
        type: String,
        default: 'en',
      },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationToken: String,
    verificationExpires: Date,
  },
  security: {
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: String,
  },
  timestamps: {
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: Date,
  },
}, {
  timestamps: false, // We handle timestamps manually
  versionKey: false,
});

// Indexes for performance
UserSchema.index({ email: 1, status: 1 });
UserSchema.index({ role: 1, 'verification.isVerified': 1 });
UserSchema.index({ 'timestamps.createdAt': -1 });
UserSchema.index({ 'security.passwordResetToken': 1 });
UserSchema.index({ 'verification.verificationToken': 1 });

// Pre-save middleware for password hashing
UserSchema.pre('save', async function(next) {
  // Update timestamps
  this.timestamps.updatedAt = new Date();
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generatePasswordResetToken = function(): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.security.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.security.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return token;
};

UserSchema.methods.generateVerificationToken = function(): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.verification.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verification.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return token;
};

UserSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.security.lockUntil && this.security.lockUntil > new Date());
};

UserSchema.methods.incrementLoginAttempts = function(): Promise<IUserDocument> {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }
  
  const updates: any = { $inc: { 'security.loginAttempts': 1 } };
  
  // If we're locking the account for the first time
  if (this.security.loginAttempts + 1 >= 5 && !this.isAccountLocked()) {
    updates.$set = { 'security.lockUntil': new Date(Date.now() + 2 * 60 * 60 * 1000) }; // 2 hours
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function(): Promise<IUserDocument> {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

UserSchema.methods.toPublicJSON = function(): Partial<IUser> {
  const obj = this.toObject();
  delete obj.password;
  delete obj.security.passwordResetToken;
  delete obj.security.passwordResetExpires;
  delete obj.security.twoFactorSecret;
  delete obj.verification.verificationToken;
  return obj;
};

// Static methods
UserSchema.statics.findByEmail = function(email: string): Promise<IUserDocument | null> {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findByResetToken = function(token: string): Promise<IUserDocument | null> {
  const crypto = require('crypto');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    'security.passwordResetToken': hashedToken,
    'security.passwordResetExpires': { $gt: new Date() }
  });
};

UserSchema.statics.findByVerificationToken = function(token: string): Promise<IUserDocument | null> {
  const crypto = require('crypto');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    'verification.verificationToken': hashedToken,
    'verification.verificationExpires': { $gt: new Date() }
  });
};

UserSchema.statics.getActiveUsers = function(limit: number = 50): Promise<IUserDocument[]> {
  return this.find({ status: UserStatus.ACTIVE })
    .sort({ 'timestamps.lastActiveAt': -1 })
    .limit(limit);
};

UserSchema.statics.getUserStats = async function(): Promise<{
  total: number;
  active: number;
  verified: number;
  byRole: Record<UserRole, number>;
}> {
  const [total, active, verified, roleStats] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ status: UserStatus.ACTIVE }),
    this.countDocuments({ 'verification.isVerified': true }),
    this.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ])
  ]);

  const byRole = {} as Record<UserRole, number>;
  Object.values(UserRole).forEach(role => {
    byRole[role] = 0;
  });
  
  roleStats.forEach(({ _id, count }) => {
    byRole[_id] = count;
  });

  return { total, active, verified, byRole };
};

export const User: IUserModel = mongoose.model<IUserDocument, IUserModel>('User', UserSchema);`,
    'src/models/Post.ts': `import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

// Enums
export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  SCHEDULED = 'scheduled',
}

export enum PostCategory {
  TECHNOLOGY = 'technology',
  BUSINESS = 'business',
  LIFESTYLE = 'lifestyle',
  EDUCATION = 'education',
  HEALTH = 'health',
  ENTERTAINMENT = 'entertainment',
  SPORTS = 'sports',
  NEWS = 'news',
}

// Interfaces
export interface IPost {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: mongoose.Types.ObjectId;
  status: PostStatus;
  category: PostCategory;
  tags: string[];
  featuredImage?: string;
  images?: string[];
  metadata: {
    readingTime: number; // in minutes
    wordCount: number;
    views: number;
    likes: number;
    shares: number;
    comments: number;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
  scheduling: {
    publishAt?: Date;
    unpublishAt?: Date;
  };
  timestamps: {
    createdAt: Date;
    updatedAt: Date;
    publishedAt?: Date;
  };
}

export interface IPostDocument extends IPost, Document {
  generateSlug(): void;
  calculateReadingTime(): void;
  generateExcerpt(): void;
  incrementViews(): Promise<this>;
  addLike(): Promise<this>;
  removeLike(): Promise<this>;
  toPublicJSON(): Partial<IPost>;
}

export interface IPostModel extends Model<IPostDocument> {
  findBySlug(slug: string): Promise<IPostDocument | null>;
  findPublished(options?: {
    category?: PostCategory;
    tags?: string[];
    author?: mongoose.Types.ObjectId;
    limit?: number;
    skip?: number;
  }): Promise<IPostDocument[]>;
  findPopular(limit?: number): Promise<IPostDocument[]>;
  findRecent(limit?: number): Promise<IPostDocument[]>;
  search(query: string): Promise<IPostDocument[]>;
  getPostStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    byCategory: Record<PostCategory, number>;
    avgReadingTime: number;
  }>;
}

// Schema definition
const PostSchema = new Schema<IPostDocument>({
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    index: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true,
  },
  content: {
    type: String,
    required: [true, 'Post content is required'],
    minlength: [10, 'Content must be at least 10 characters long'],
  },
  excerpt: {
    type: String,
    maxlength: [500, 'Excerpt cannot exceed 500 characters'],
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Post author is required'],
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(PostStatus),
    default: PostStatus.DRAFT,
    index: true,
  },
  category: {
    type: String,
    enum: Object.values(PostCategory),
    required: [true, 'Post category is required'],
    index: true,
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
  }],
  featuredImage: {
    type: String,
    validate: {
      validator: function(url: string) {
        return !url || /^https?:\\/\\/.+/.test(url);
      },
      message: 'Featured image must be a valid URL',
    },
  },
  images: [{
    type: String,
    validate: {
      validator: function(url: string) {
        return /^https?:\\/\\/.+/.test(url);
      },
      message: 'Image must be a valid URL',
    },
  }],
  metadata: {
    readingTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    shares: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters'],
    },
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
    },
    keywords: [{
      type: String,
      lowercase: true,
      trim: true,
    }],
    canonicalUrl: String,
  },
  scheduling: {
    publishAt: Date,
    unpublishAt: Date,
  },
  timestamps: {
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    publishedAt: Date,
  },
}, {
  timestamps: false, // We handle timestamps manually
  versionKey: false,
});

// Indexes for performance
PostSchema.index({ status: 1, 'timestamps.publishedAt': -1 });
PostSchema.index({ category: 1, status: 1 });
PostSchema.index({ tags: 1, status: 1 });
PostSchema.index({ author: 1, status: 1 });
PostSchema.index({ 'metadata.views': -1 });
PostSchema.index({ 'metadata.likes': -1 });
PostSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

// Pre-save middleware
PostSchema.pre('save', function(next) {
  // Update timestamps
  this.timestamps.updatedAt = new Date();
  
  // Generate slug if title changed
  if (this.isModified('title')) {
    this.generateSlug();
  }
  
  // Calculate reading time and word count if content changed
  if (this.isModified('content')) {
    this.calculateReadingTime();
    this.generateExcerpt();
  }
  
  // Set published timestamp
  if (this.isModified('status') && this.status === PostStatus.PUBLISHED && !this.timestamps.publishedAt) {
    this.timestamps.publishedAt = new Date();
  }
  
  next();
});

// Instance methods
PostSchema.methods.generateSlug = function(): void {
  let baseSlug = slugify(this.title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  
  this.slug = baseSlug;
};

PostSchema.methods.calculateReadingTime = function(): void {
  const wordsPerMinute = 200;
  const words = this.content.split(/\\s+/).length;
  
  this.metadata.wordCount = words;
  this.metadata.readingTime = Math.ceil(words / wordsPerMinute);
};

PostSchema.methods.generateExcerpt = function(): void {
  if (!this.excerpt && this.content) {
    // Remove HTML tags and get first 150 characters
    const plainText = this.content.replace(/<[^>]*>/g, '');
    this.excerpt = plainText.substring(0, 150).trim() + '...';
  }
};

PostSchema.methods.incrementViews = function(): Promise<IPostDocument> {
  return this.updateOne({ $inc: { 'metadata.views': 1 } });
};

PostSchema.methods.addLike = function(): Promise<IPostDocument> {
  return this.updateOne({ $inc: { 'metadata.likes': 1 } });
};

PostSchema.methods.removeLike = function(): Promise<IPostDocument> {
  return this.updateOne({ $inc: { 'metadata.likes': -1 } });
};

PostSchema.methods.toPublicJSON = function(): Partial<IPost> {
  const obj = this.toObject();
  return obj;
};

// Static methods
PostSchema.statics.findBySlug = function(slug: string): Promise<IPostDocument | null> {
  return this.findOne({ slug }).populate('author', 'name email profile.avatar');
};

PostSchema.statics.findPublished = function(options: {
  category?: PostCategory;
  tags?: string[];
  author?: mongoose.Types.ObjectId;
  limit?: number;
  skip?: number;
} = {}): Promise<IPostDocument[]> {
  const query: any = { status: PostStatus.PUBLISHED };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }
  
  if (options.author) {
    query.author = options.author;
  }
  
  return this.find(query)
    .populate('author', 'name email profile.avatar')
    .sort({ 'timestamps.publishedAt': -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

PostSchema.statics.findPopular = function(limit: number = 10): Promise<IPostDocument[]> {
  return this.find({ status: PostStatus.PUBLISHED })
    .populate('author', 'name email profile.avatar')
    .sort({ 'metadata.views': -1, 'metadata.likes': -1 })
    .limit(limit);
};

PostSchema.statics.findRecent = function(limit: number = 10): Promise<IPostDocument[]> {
  return this.find({ status: PostStatus.PUBLISHED })
    .populate('author', 'name email profile.avatar')
    .sort({ 'timestamps.publishedAt': -1 })
    .limit(limit);
};

PostSchema.statics.search = function(query: string): Promise<IPostDocument[]> {
  return this.find(
    { 
      $text: { $search: query },
      status: PostStatus.PUBLISHED 
    },
    { score: { $meta: 'textScore' } }
  )
    .populate('author', 'name email profile.avatar')
    .sort({ score: { $meta: 'textScore' } })
    .limit(20);
};

PostSchema.statics.getPostStats = async function(): Promise<{
  total: number;
  published: number;
  draft: number;
  byCategory: Record<PostCategory, number>;
  avgReadingTime: number;
}> {
  const [total, published, draft, categoryStats, avgReadingTime] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ status: PostStatus.PUBLISHED }),
    this.countDocuments({ status: PostStatus.DRAFT }),
    this.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $group: { _id: null, avg: { $avg: '$metadata.readingTime' } } }
    ])
  ]);

  const byCategory = {} as Record<PostCategory, number>;
  Object.values(PostCategory).forEach(category => {
    byCategory[category] = 0;
  });
  
  categoryStats.forEach(({ _id, count }) => {
    byCategory[_id] = count;
  });

  return { 
    total, 
    published, 
    draft, 
    byCategory, 
    avgReadingTime: avgReadingTime[0]?.avg || 0 
  };
};

export const Post: IPostModel = mongoose.model<IPostDocument, IPostModel>('Post', PostSchema);`,
    'src/database/seeds/index.ts': `import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectToDatabase, disconnectFromDatabase } from '../../config/database';
import { User, UserRole, UserStatus } from '../../models/User';
import { Post, PostStatus, PostCategory } from '../../models/Post';
import { logger } from '../../utils/logger';

const seedData = {
  users: [
    {
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        bio: 'System administrator with full access privileges',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        website: 'https://admin.example.com',
        location: 'System Center',
        preferences: {
          theme: 'dark' as const,
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
      },
      verification: {
        isVerified: true,
      },
    },
    {
      email: 'user@example.com',
      password: 'user123',
      name: 'John Doe',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      profile: {
        bio: 'Regular user passionate about technology and innovation',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
        location: 'San Francisco, CA',
        social: {
          twitter: '@johndoe',
          github: 'johndoe',
          linkedin: 'john-doe',
        },
        preferences: {
          theme: 'light' as const,
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: true,
          },
        },
      },
      verification: {
        isVerified: true,
      },
    },
    {
      email: 'moderator@example.com',
      password: 'moderator123',
      name: 'Jane Smith',
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      profile: {
        bio: 'Content moderator ensuring quality and community standards',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=moderator',
        location: 'New York, NY',
        website: 'https://janesmith.dev',
        preferences: {
          theme: 'auto' as const,
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
      },
      verification: {
        isVerified: true,
      },
    },
  ],
  posts: [
    {
      title: 'Getting Started with MongoDB and Mongoose',
      content: \`
        MongoDB is a powerful NoSQL database that provides flexibility and scalability for modern applications. 
        Combined with Mongoose, an elegant MongoDB object modeling library for Node.js, developers can build 
        robust data layers with schema validation, middleware, and query building.

        In this comprehensive guide, we'll explore the fundamentals of MongoDB and Mongoose, covering everything 
        from basic setup to advanced features like aggregation pipelines and transactions.

        ## Why Choose MongoDB?

        MongoDB offers several advantages over traditional relational databases:
        
        - **Flexible Schema**: Documents can have varying structures
        - **Horizontal Scaling**: Built-in sharding support
        - **Rich Query Language**: Powerful aggregation framework
        - **High Performance**: Optimized for read and write operations
        
        ## Mongoose Benefits

        Mongoose adds structure and validation to MongoDB:
        
        - **Schema Definition**: Define document structure and validation rules
        - **Middleware Support**: Pre and post hooks for document operations
        - **Type Casting**: Automatic type conversion and validation
        - **Query Building**: Chainable query syntax with type safety
      \`,
      category: PostCategory.TECHNOLOGY,
      status: PostStatus.PUBLISHED,
      tags: ['mongodb', 'mongoose', 'nodejs', 'database', 'nosql'],
      featuredImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
      seo: {
        metaTitle: 'MongoDB & Mongoose Tutorial - Complete Guide',
        metaDescription: 'Learn MongoDB and Mongoose from basics to advanced concepts. Complete guide with examples.',
        keywords: ['mongodb', 'mongoose', 'tutorial', 'nodejs', 'database'],
      },
    },
    {
      title: 'Advanced Mongoose Schemas and Relationships',
      content: \`
        Building complex applications requires sophisticated data modeling. Mongoose provides powerful 
        tools for defining relationships between documents, implementing validation, and creating 
        reusable schema components.

        ## Schema Design Patterns

        ### Embedded Documents
        Use embedded documents for one-to-few relationships where the embedded data is frequently 
        accessed together with the parent document.

        ### Document References
        Use references for one-to-many and many-to-many relationships where documents may be 
        accessed independently.

        ### Hybrid Approach
        Combine embedding and referencing based on access patterns and consistency requirements.

        ## Validation Strategies

        Mongoose offers multiple levels of validation:
        - Built-in validators for common types
        - Custom validators with business logic
        - Schema-level validation rules
        - Application-level validation middleware
      \`,
      category: PostCategory.TECHNOLOGY,
      status: PostStatus.PUBLISHED,
      tags: ['mongoose', 'schemas', 'validation', 'relationships', 'mongodb'],
      featuredImage: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800',
    },
    {
      title: 'MongoDB Performance Optimization Techniques',
      content: \`
        Optimizing MongoDB performance requires understanding indexing strategies, query optimization, 
        and proper schema design. This guide covers essential techniques for building high-performance 
        MongoDB applications.

        ## Indexing Best Practices

        ### Compound Indexes
        Create indexes that support multiple query patterns with careful field ordering.

        ### Partial Indexes
        Use partial indexes to reduce index size and improve performance for conditional queries.

        ### Text Indexes
        Implement full-text search capabilities with proper language support and scoring.

        ## Query Optimization

        - Use explain() to analyze query performance
        - Implement proper pagination with skip() and limit()
        - Utilize aggregation pipelines for complex data transformations
        - Cache frequently accessed data appropriately
      \`,
      category: PostCategory.TECHNOLOGY,
      status: PostStatus.DRAFT,
      tags: ['mongodb', 'performance', 'optimization', 'indexing', 'queries'],
    },
    {
      title: 'Building Scalable APIs with Node.js and MongoDB',
      content: \`
        Creating scalable APIs requires careful consideration of architecture, data modeling, 
        and performance optimization. Learn how to build robust APIs that can handle growth.

        ## Architecture Patterns

        ### Repository Pattern
        Separate data access logic from business logic for better testability and maintainability.

        ### Service Layer
        Implement business logic in dedicated service classes for better organization.

        ### Middleware Pattern
        Use Express middleware for cross-cutting concerns like authentication and logging.

        ## Scalability Considerations

        - Connection pooling and management
        - Caching strategies (Redis integration)
        - Rate limiting and throttling
        - Error handling and monitoring
        - Load balancing and clustering
      \`,
      category: PostCategory.TECHNOLOGY,
      status: PostStatus.PUBLISHED,
      tags: ['nodejs', 'api', 'scalability', 'mongodb', 'architecture'],
      featuredImage: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800',
    },
    {
      title: 'MongoDB Security Best Practices',
      content: \`
        Security is paramount when building production applications. MongoDB provides comprehensive 
        security features that must be properly configured and implemented.

        ## Authentication and Authorization

        ### Role-Based Access Control
        Implement fine-grained permissions with MongoDB's built-in role system.

        ### Network Security
        Configure network encryption and IP whitelisting for secure connections.

        ### Data Encryption
        Enable encryption at rest and in transit for sensitive data protection.

        ## Application Security

        - Input validation and sanitization
        - Query injection prevention
        - Audit logging and monitoring
        - Regular security updates and patches
      \`,
      category: PostCategory.TECHNOLOGY,
      status: PostStatus.ARCHIVED,
      tags: ['mongodb', 'security', 'authentication', 'encryption', 'best-practices'],
    },
  ],
};

async function seedDatabase(): Promise<void> {
  try {
    logger.info('🌱 Starting database seeding...');
    
    await connectToDatabase();
    
    // Clear existing data
    logger.info('Clearing existing data...');
    await User.deleteMany({});
    await Post.deleteMany({});
    
    // Seed users
    logger.info('Seeding users...');
    const createdUsers = [];
    
    for (const userData of seedData.users) {
      const user = new User(userData);
      const savedUser = await user.save();
      createdUsers.push(savedUser);
      logger.info(\`✅ Created user: \${savedUser.name} (\${savedUser.email})\`);
    }
    
    // Seed posts
    logger.info('Seeding posts...');
    const userIds = createdUsers.map(user => user._id);
    
    for (let i = 0; i < seedData.posts.length; i++) {
      const postData = {
        ...seedData.posts[i],
        author: userIds[i % userIds.length], // Rotate through users
      };
      
      const post = new Post(postData);
      const savedPost = await post.save();
      logger.info(\`✅ Created post: \${savedPost.title}\`);
    }
    
    // Update statistics
    const userStats = await User.getUserStats();
    const postStats = await Post.getPostStats();
    
    logger.info('📊 Seeding completed successfully!');
    logger.info(\`   Users: \${userStats.total} (\${userStats.active} active)\`);
    logger.info(\`   Posts: \${postStats.total} (\${postStats.published} published)\`);
    logger.info('');
    logger.info('🔑 Test Credentials:');
    logger.info('   Admin: admin@example.com / admin123');
    logger.info('   User: user@example.com / user123');
    logger.info('   Moderator: moderator@example.com / moderator123');
    
  } catch (error) {
    logger.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase().catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seedDatabase };`,
    'src/services/userService.ts': `import { User, IUserDocument, UserRole, UserStatus } from '../models/User';
import { logger } from '../utils/logger';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  profile?: {
    bio?: string;
    avatar?: string;
    website?: string;
    location?: string;
  };
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  profile?: {
    bio?: string;
    avatar?: string;
    website?: string;
    location?: string;
    phone?: string;
    social?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
    };
    preferences?: {
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
      notifications?: {
        email?: boolean;
        push?: boolean;
        sms?: boolean;
      };
    };
  };
}

export interface PaginatedUsers {
  users: IUserDocument[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class UserService {
  async findById(id: string): Promise<IUserDocument | null> {
    try {
      return await User.findById(id).select('-password');
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      return null;
    }
  }

  async findByEmail(email: string, includePassword = false): Promise<IUserDocument | null> {
    try {
      const query = User.findOne({ email: email.toLowerCase() });
      if (includePassword) {
        query.select('+password');
      }
      return await query;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      return null;
    }
  }

  async createUser(userData: CreateUserData): Promise<IUserDocument> {
    try {
      const user = new User({
        ...userData,
        email: userData.email.toLowerCase(),
        role: userData.role || UserRole.USER,
        status: UserStatus.PENDING,
        timestamps: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const savedUser = await user.save();
      logger.info(\`User created: \${savedUser.email}\`);
      
      return savedUser;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<IUserDocument | null> {
    try {
      const updateData: any = {
        'timestamps.updatedAt': new Date(),
      };

      // Handle top-level fields
      if (updates.name) updateData.name = updates.name;
      if (updates.email) updateData.email = updates.email.toLowerCase();

      // Handle profile updates
      if (updates.profile) {
        Object.keys(updates.profile).forEach(key => {
          updateData[\`profile.\${key}\`] = updates.profile![key as keyof typeof updates.profile];
        });
      }

      const user = await User.findByIdAndUpdate(
        id, 
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        logger.info(\`User updated: \${user.email}\`);
      }

      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndDelete(id);
      if (result) {
        logger.info(\`User deleted: \${result.email}\`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async getUsers(
    page: number = 1,
    limit: number = 20,
    filters: {
      search?: string;
      role?: UserRole;
      status?: UserStatus;
      verified?: boolean;
    } = {}
  ): Promise<PaginatedUsers> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.role) query.role = filters.role;
      if (filters.status) query.status = filters.status;
      if (filters.verified !== undefined) query['verification.isVerified'] = filters.verified;

      // Apply search
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { 'profile.bio': { $regex: filters.search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort({ 'timestamps.createdAt': -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(query),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        users,
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  async verifyPassword(email: string, password: string): Promise<IUserDocument | null> {
    try {
      const user = await this.findByEmail(email, true);
      if (!user) return null;

      if (user.isAccountLocked()) {
        logger.warn(\`Login attempt on locked account: \${email}\`);
        return null;
      }

      const isValid = await user.comparePassword(password);
      
      if (isValid) {
        // Reset login attempts on successful login
        await user.resetLoginAttempts();
        
        // Update last login
        await User.findByIdAndUpdate(user._id, {
          'security.lastLogin': new Date(),
          'timestamps.lastActiveAt': new Date(),
        });
        
        logger.info(\`Successful login: \${email}\`);
        return await this.findById(user._id.toString());
      } else {
        // Increment login attempts on failed login
        await user.incrementLoginAttempts();
        logger.warn(\`Failed login attempt: \${email}\`);
        return null;
      }
    } catch (error) {
      logger.error('Error verifying password:', error);
      return null;
    }
  }

  async getUserStats() {
    try {
      return await User.getUserStats();
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  async updateUserRole(id: string, role: UserRole): Promise<IUserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { 
          role,
          'timestamps.updatedAt': new Date(),
        },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        logger.info(\`User role updated: \${user.email} -> \${role}\`);
      }

      return user;
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<IUserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { 
          status,
          'timestamps.updatedAt': new Date(),
        },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        logger.info(\`User status updated: \${user.email} -> \${status}\`);
      }

      return user;
    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }

  async verifyUser(id: string): Promise<IUserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { 
          'verification.isVerified': true,
          status: UserStatus.ACTIVE,
          'timestamps.updatedAt': new Date(),
          $unset: {
            'verification.verificationToken': '',
            'verification.verificationExpires': '',
          },
        },
        { new: true, runValidators: true }
      ).select('-password');

      if (user) {
        logger.info(\`User verified: \${user.email}\`);
      }

      return user;
    } catch (error) {
      logger.error('Error verifying user:', error);
      throw error;
    }
  }
}`,
    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017/myapp
DB_POOL_SIZE=10
DB_TIMEOUT=5000
DB_SOCKET_TIMEOUT=45000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Application Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=info

# Email Configuration (for user verification)
EMAIL_FROM=noreply@example.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,image/webp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session Configuration
SESSION_SECRET=your-session-secret-change-this-in-production
SESSION_MAX_AGE=86400000`
  },
  postInstallCommands: [
    'echo "📋 MongoDB/Mongoose Setup Instructions:"',
    'echo "1. Install and start MongoDB server"',
    'echo "2. Configure MONGODB_URL in .env"',
    'echo "3. Run: npm run db:seed (to add sample data)"',
    'echo ""',
    'echo "💡 Database Management:"',
    'echo "- npm run db:seed (seed sample data)"',
    'echo "- npm run db:drop (drop all collections)"',
    'echo "- npm run db:migrate (run data migrations)"',
    'echo "- npm run db:backup (backup database)"',
    'echo "- npm run db:restore (restore from backup)"'
  ]
});

export const getMongooseHealthCheck = (): string => `
  async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await mongoose.connection.db?.admin().ping();
      const latency = Date.now() - start;
      
      return { status: 'ok', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'error' };
    }
  }
`;

export const getMongooseDockerCompose = (): string => `
  # Add this to your docker-compose.yml for MongoDB
  mongodb:
    image: mongo:7.0
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_USERNAME:-admin}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_PASSWORD:-password}
      MONGO_INITDB_DATABASE: \${MONGO_DATABASE:-myapp}
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  mongodb_data:
`;

export const getMongooseReadmeSection = (): string => `
## Database Integration (Mongoose/MongoDB)

This template includes comprehensive **Mongoose** integration for flexible MongoDB operations.

### Quick Start

1. **Install and Start MongoDB**:
   \`\`\`bash
   # macOS with Homebrew
   brew install mongodb-community
   brew services start mongodb-community
   
   # Ubuntu/Debian
   sudo apt install mongodb
   sudo systemctl start mongodb
   
   # Windows
   # Download from https://www.mongodb.com/try/download/community
   \`\`\`

2. **Configure Database**:
   \`\`\`bash
   # Copy environment file
   cp .env.example .env
   
   # Edit MONGODB_URL in .env
   MONGODB_URL=mongodb://localhost:27017/myapp
   \`\`\`

3. **Initialize Database**:
   \`\`\`bash
   # Seed database with sample data
   npm run db:seed
   \`\`\`

### Database Commands

- \`npm run db:seed\` - Seed database with sample data
- \`npm run db:drop\` - Drop all collections (destructive)
- \`npm run db:migrate\` - Run data migrations
- \`npm run db:backup\` - Create database backup
- \`npm run db:restore\` - Restore from backup

### Schema Design

The application includes these Mongoose models:

#### User Model
- **Authentication**: Email/password with bcrypt hashing
- **Roles**: USER, ADMIN, MODERATOR with permissions
- **Profile**: Bio, avatar, social links, preferences
- **Security**: Account locking, two-factor auth, password reset
- **Verification**: Email verification workflow

#### Post Model
- **Content**: Title, content, excerpt with auto-generation
- **Metadata**: Reading time, word count, views, likes
- **SEO**: Meta tags, keywords, canonical URLs
- **Categories**: Technology, Business, Lifestyle, etc.
- **Scheduling**: Publish/unpublish automation

### Features

- **🔍 Full-Text Search**: MongoDB text indexes for content search
- **📊 Aggregation**: Complex analytics and reporting queries
- **🔐 Security**: Input validation, query sanitization, rate limiting
- **⚡ Performance**: Optimized indexes and query patterns
- **🔄 Relationships**: Population and virtual fields
- **✅ Validation**: Comprehensive schema validation with custom rules
- **🎯 Middleware**: Pre/post hooks for business logic
- **📈 Statistics**: Built-in analytics and reporting methods

### MongoDB Connection Options

**Local Development:**
\`\`\`
MONGODB_URL=mongodb://localhost:27017/myapp
\`\`\`

**MongoDB Atlas (Cloud):**
\`\`\`
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/myapp
\`\`\`

**Replica Set:**
\`\`\`
MONGODB_URL=mongodb://host1:27017,host2:27017,host3:27017/myapp?replicaSet=rs0
\`\`\`

### Data Modeling Best Practices

1. **Embed vs Reference**: 
   - Embed: One-to-few relationships, data accessed together
   - Reference: One-to-many, many-to-many, independent access

2. **Indexing Strategy**:
   - Single field indexes for equality queries
   - Compound indexes for multi-field queries
   - Text indexes for search functionality

3. **Schema Validation**:
   - Mongoose schema validation for type safety
   - Custom validators for business rules
   - Async validation for external dependencies

### Production Deployment

1. Set production MongoDB connection string
2. Enable authentication and authorization
3. Configure replica sets for high availability
4. Set up monitoring and alerting
5. Implement backup and recovery procedures
`;

export const getMongooseServerIntegration = (): string => `
// Add this to your main server file
import { connectToDatabase } from './config/database';

async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log('✅ Database connected');
    
    // Start your server here
    // ...
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
`;