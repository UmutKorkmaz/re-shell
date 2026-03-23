import { BackendTemplate } from '../types';

export const meteorjsTemplate: BackendTemplate = {
  id: 'meteorjs',
  name: 'Meteor.js Full-Stack Platform',
  displayName: 'Meteor.js',
  description: 'Real-time full-stack JavaScript platform with DDP, MongoDB, and reactive data',
  version: '2.13.3',
  language: 'javascript',
  framework: 'meteorjs',
  tags: ['javascript', 'meteor', 'fullstack', 'realtime', 'mongodb', 'ddp'],
  port: 3000,
  dependencies: {},
  features: ['websockets', 'database', 'authentication', 'rest-api', 'file-upload', 'email', 'queue', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Meteor.js real-time application",
  "scripts": {
    "start": "meteor run",
    "test": "meteor test --driver-package meteortesting:mocha",
    "test:app": "TEST_WATCH=1 meteor test --full-app --driver-package meteortesting:mocha",
    "lint": "eslint .",
    "precommit": "npm run lint"
  },
  "dependencies": {
    "@babel/runtime": "^7.23.5",
    "@reactioncommerce/caching": "^1.1.0",
    "@reactioncommerce/logger": "^1.1.0",
    "bcrypt": "^5.1.1",
    "check": "^0.9.0",
    "classnames": "^2.3.2",
    "dot-env": "^0.1.0",
    "graphql": "^16.8.1",
    "meteor-node-stubs": "^1.2.5",
    "simpl-schema": "^3.4.3",
    "styled-components": "^6.1.1"
  },
  "devDependencies": {
    "@types/meteor": "^2.9.7",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "eslint": "^8.55.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-import-resolver-meteor": "^0.4.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-meteor": "^7.3.0"
  },
  "meteor": {
    "mainModule": {
      "client": "client/main.js",
      "server": "server/main.js"
    }
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM"],
    "allowJs": true,
    "jsx": "react",
    "rootDir": ".",
    "outDir": "dist",
    "removeComments": true,
    "noEmit": true,
    "strict": false,
    "moduleResolution": "node",
    "types": ["meteor-typescript-compiler", "mocha"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["imports/**/*"],
  "exclude": ["node_modules", ".meteor"]
}`,

    '.eslintrc.js': `module.exports = {
  extends: ['airbnb-base', 'plugin:meteor/recommended'],
  plugins: ['meteor'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  globals: {
    Meteor: 'readonly',
    Mongo: 'readonly',
    check: 'readonly',
    Match: 'readonly',
    Template: 'readonly',
    Blaze: 'readonly',
    HTML: 'readonly',
    Session: 'readonly',
    $: 'readonly',
    jQuery: 'readonly',
    _: 'readonly',
    Tracker: 'readonly',
    EJSON: 'readonly',
  },
  rules: {
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'no-underscore-dangle': 'off',
    'consistent-return': 'off',
    'meteor/no-session': 'off',
  },
};`,

    '.gitignore': `node_modules/
.meteor/local/
.meteor/dev_bundle/
npm-debug.log*
.DS_Store
.settings.json
packages/
.mobile-local-build
*.tgz
.claude/
dist/
`,

    'settings-dev.json': `{
  "public": {
    "analyticsId": "GA-XXXXXXXXXX"
  },
  "private": {
    "oauth": {
      "google": {
        "clientId": "your-client-id.apps.googleusercontent.com",
        "secret": "your-secret",
        "loginStyle": "popup"
      },
      "github": {
        "clientId": "your-client-id",
        "secret": "your-secret"
      }
    },
    "email": {
      "mailhog": true
    }
  }
}`,

    'server/main.js': `import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import '../imports/api/index.js';

Meteor.startup(() => {
  // Initialize application
  console.log('Starting Meteor application...');

  // Configure CORS
  WebApp.connectHandlers.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    next();
  });
});`,

    'client/main.js': `import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';
import React from 'react';
import App from '../imports/ui/App.js';

Meteor.startup(() => {
  render(<App />, document.getElementById('app'));
});`,

    'client/main.html': `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>{{projectName}}</title>
</head>

<body>
  <div id="app"></div>
</body>`,

    'imports/api/index.js': `import '../imports/api/users/index.js';
import '../imports/api/tasks/index.js';
import '../imports/api/publications/index.js';`,

    'imports/api/users/index.js': `import './methods.js';
import './publications.js';`,

    'imports/api/users/methods.js': `import { Accounts } from 'meteor/accounts-base';
import { check } from 'meteor/check';

Meteor.methods({
  'users.updateProfile'(profile) {
    check(profile, {
      firstName: String,
      lastName: String,
    });

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    Meteor.users.update(this.userId, {
      $set: { 'profile': profile },
    });

    return Meteor.users.findOne(this.userId);
  },

  'users.getUser'(userId) {
    check(userId, String);

    const user = Meteor.users.findOne(userId);
    if (!user) {
      throw new Meteor.Error('not-found', 'User not found');
    }

    // Return only public fields
    return {
      _id: user._id,
      profile: user.profile,
    };
  },
});`,

    'imports/api/users/publications.js': `import { Meteor } from 'meteor/meteor';

Meteor.publish('users.current', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find(this.userId, {
    fields: {
      profile: 1,
      emails: 1,
      createdAt: 1,
    },
  });
});

Meteor.publish('users.all', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find({}, {
    fields: {
      profile: 1,
      createdAt: 1,
    },
  });
});`,

    'imports/api/tasks/index.js': `import './methods.js';
import './publications.js';
import { Tasks } from './collection.js';`,

    'imports/api/tasks/collection.js': `import { Mongo } from 'meteor/mongo';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

export const Tasks = new Mongo.Collection('tasks');

Tasks.schema = new SimpleSchema({
  text: {
    type: String,
    max: 200,
  },
  completed: {
    type: Boolean,
    defaultValue: false,
  },
  createdAt: {
    type: Date,
    defaultValue: new Date(),
  },
  userId: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  priority: {
    type: String,
    allowedValues: ['low', 'medium', 'high'],
    defaultValue: 'medium',
  },
  dueDate: {
    type: Date,
    optional: true,
  },
});

Tasks.attachSchema(Tasks.schema);`,

    'imports/api/tasks/methods.js': `import { check } from 'meteor/check';
import { Tasks } from './collection.js';

Meteor.methods({
  'tasks.insert'(text) {
    check(text, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    return Tasks.insert({
      text,
      completed: false,
      createdAt: new Date(),
      userId: this.userId,
    });
  },

  'tasks.update'(taskId, updates) {
    check(taskId, String);
    check(updates, Object);

    const task = Tasks.findOne(taskId);
    if (!task) {
      throw new Meteor.Error('not-found', 'Task not found');
    }

    if (task.userId !== this.userId) {
      throw new Meteor.Error('not-authorized', 'You can only update your own tasks');
    }

    Tasks.update(taskId, { $set: updates });
    return Tasks.findOne(taskId);
  },

  'tasks.delete'(taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    if (!task) {
      throw new Meteor.Error('not-found', 'Task not found');
    }

    if (task.userId !== this.userId) {
      throw new Meteor.Error('not-authorized', 'You can only delete your own tasks');
    }

    Tasks.remove(taskId);
  },

  'tasks.toggleComplete'(taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    if (!task) {
      throw new Meteor.Error('not-found', 'Task not found');
    }

    if (task.userId !== this.userId) {
      throw new Meteor.Error('not-authorized', 'You can only update your own tasks');
    }

    Tasks.update(taskId, {
      $set: { completed: !task.completed },
    });
  },
});`,

    'imports/api/tasks/publications.js': `import { Meteor } from 'meteor/meteor';
import { Tasks } from './collection.js';

Meteor.publish('tasks.my', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Tasks.find({ userId: this.userId }, {
    sort: { createdAt: -1 },
  });
});

Meteor.publish('tasks.byId', function(taskId) {
  check(taskId, String);

  if (!this.userId) {
    return this.ready();
  }

  const task = Tasks.findOne(taskId);
  if (!task || task.userId !== this.userId) {
    return this.ready();
  }

  return Tasks.find(taskId);
});`,

    'imports/api/publications/index.js': `import { Meteor } from 'meteor/meteor';

Meteor.publish('userData', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find(this.userId, {
    fields: {
      'profile.firstName': 1,
      'profile.lastName': 1,
      'emails': 1,
      'createdAt': 1,
    },
  });
});`,

    'imports/ui/App.js': `import React from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Tasks } from '../api/tasks/collection.js';

export const App = () => {
  const { user, tasks, loading } = useTracker(() => {
    const subscription = Meteor.subscribe('tasks.my');

    return {
      user: Meteor.user(),
      tasks: Tasks.find({}, { sort: { createdAt: -1 } }).fetch(),
      loading: !subscription.ready(),
    };
  });

  const addTask = (text) => {
    Meteor.call('tasks.insert', text);
  };

  const toggleTask = (taskId) => {
    Meteor.call('tasks.toggleComplete', taskId);
  };

  const deleteTask = (taskId) => {
    Meteor.call('tasks.delete', taskId);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>{{projectName}}</h1>
      <form onSubmit={(e) => {
        e.preventDefault();
        const input = e.target.elements.task;
        if (input.value.trim()) {
          addTask(input.value);
          input.value = '';
        }
      }}>
        <input name="task" placeholder="Add a task..." />
        <button type="submit">Add</button>
      </form>

      <ul>
        {tasks.map(task => (
          <li key={task._id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task._id)}
            />
            <span style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
              {task.text}
            </span>
            <button onClick={() => deleteTask(task._id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};`,

    'README.md': `# {{projectName}}

A real-time full-stack application built with Meteor.js.

## Features

- Real-time data synchronization using DDP
- User authentication with OAuth
- Reactive UI updates
- MongoDB integration
- File upload support
- Email system
- Scheduled tasks
- WebSocket support
- Hot code reload

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- MongoDB 4.4 or higher
- Meteor 2.13.3 or higher

### Installation

1. Install Meteor:
\`\`\`bash
curl https://install.meteor.com/ | sh
\`\`\`

2. Install dependencies:
\`\`\`bash
meteor npm install
\`\`\`

3. Run the development server:
\`\`\`bash
meteor run --settings settings-dev.json
\`\`\`

The app will be available at http://localhost:3000

## API Endpoints

### Methods (via DDP)

#### Authentication
- \`users.login(email, password)\` - Login user
- \`users.logout()\` - Logout user
- \`users.register(email, password)\` - Register new user

#### Tasks
- \`tasks.insert(text)\` - Create a new task
- \`tasks.update(taskId, updates)\` - Update a task
- \`tasks.delete(taskId)\` - Delete a task
- \`tasks.toggleComplete(taskId)\` - Toggle task completion

### Publications

- \`userData\` - Current user data
- \`tasks.my\` - User's tasks
- \`tasks.byId\` - Single task by ID

## Default Credentials

For development, create an account through the UI or use OAuth providers configured in settings-dev.json.

## Docker

Run with Docker Compose:
\`\`\`bash
docker-compose up
\`\`\`

## License

MIT
`,

    'Dockerfile': `FROM abernix/meteord:base

ENV METEOR_ALLOW_UNSAFE_PACKAGE_UPDATE=3000

RUN mkdir -p /app

COPY . /app

WORKDIR /app

RUN bash -c " \\
    # Install app dependencies \\
    (cd programs/server && npm install) || true \\
"

ENV PORT=3000
ENV ROOT_URL=http://localhost:3000

EXPOSE 3000

CMD ["node", "main.js"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ROOT_URL=http://localhost:3000
      - MONGO_URL=mongodb://mongo:27017/meteor
      - MONGO_OPLOG_URL=mongodb://mongo:27017/local
      - MAIL_URL=smtp://mailhog:1025
      - NODE_ENV=development
    depends_on:
      - mongo
      - mailhog
    volumes:
      - ./settings-dev.json:/app/settings.json
    command: node main.js --settings /app/settings.json

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
      - mongo_config:/data/configdb
    command: mongod --replSet rs0 --oplogSize 128

  mongo-init:
    image: mongo:6.0
    depends_on:
      - mongo
    restart: "no"
    command: >
      bash -c "sleep 10 && mongosh --host mongo:27017 --eval
      'rs.initiate({ _id: rs0, members: [{ _id: 0, host: mongo:27017 }] })'"

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  mongo_data:
  mongo_config:
`,

    '.dockerignore': `node_modules/
.meteor/local/
.meteor/dev_bundle/
npm-debug.log*
.DS_Store
.git/
.gitignore
*.md
.dockerignore
Dockerfile
docker-compose.yml
`
  },

  postInstall: [
    `echo "Setting up Meteor.js backend..."
echo "1. Install Meteor: curl https://install.meteor.com/ | sh"
echo "2. Copy settings-dev.json and configure OAuth providers"
echo "3. Run: meteor npm install"
echo "4. Start: meteor run --settings settings-dev.json"
echo "Or use Docker: docker-compose up"`
  ]
};
