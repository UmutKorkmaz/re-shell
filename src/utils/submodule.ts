import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  branch: string;
  commit: string;
  status: 'clean' | 'modified' | 'untracked' | 'ahead' | 'behind';
}

export interface SubmoduleConfig {
  path: string;
  url: string;
  branch?: string;
  update?: 'checkout' | 'rebase' | 'merge';
}

export async function initializeGitRepository(projectPath: string): Promise<void> {
  try {
    await execAsync('git init', { cwd: projectPath });
    
    // Create initial commit
    await execAsync('git add .', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
  } catch (error) {
    throw new Error(`Failed to initialize Git repository: ${error}`);
  }
}

export async function addSubmodule(
  submodulePath: string,
  repositoryUrl: string,
  branch = 'main',
  targetPath?: string
): Promise<void> {
  const actualPath = targetPath || submodulePath;
  
  try {
    let command = `git submodule add`;
    if (branch !== 'main') {
      command += ` -b ${branch}`;
    }
    command += ` ${repositoryUrl} ${actualPath}`;
    
    await execAsync(command);
    
    // Initialize and update the submodule
    await execAsync(`git submodule update --init --recursive ${actualPath}`);
    
    console.log(`Submodule added: ${repositoryUrl} -> ${actualPath}`);
  } catch (error) {
    throw new Error(`Failed to add submodule: ${error}`);
  }
}

export async function removeSubmodule(submodulePath: string): Promise<void> {
  try {
    // Remove from .gitmodules
    await execAsync(`git submodule deinit -f ${submodulePath}`);
    
    // Remove from .git/modules
    await execAsync(`rm -rf .git/modules/${submodulePath}`);
    
    // Remove from working tree
    await execAsync(`git rm -f ${submodulePath}`);
    
    console.log(`Submodule removed: ${submodulePath}`);
  } catch (error) {
    throw new Error(`Failed to remove submodule: ${error}`);
  }
}

export async function updateSubmodules(specificPath?: string): Promise<void> {
  try {
    const command = specificPath 
      ? `git submodule update --remote --recursive ${specificPath}`
      : 'git submodule update --remote --recursive';
    
    await execAsync(command);
    console.log('Submodules updated successfully');
  } catch (error) {
    throw new Error(`Failed to update submodules: ${error}`);
  }
}

export async function getSubmoduleStatus(): Promise<SubmoduleInfo[]> {
  try {
    const { stdout } = await execAsync('git submodule status --recursive');
    const submodules: SubmoduleInfo[] = [];
    
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const match = line.match(/^([ +-U])([a-f0-9]+) (.+?)( \(.+\))?$/);
      if (match) {
        const [, statusChar, commit, submodulePath] = match;
        
        let status: SubmoduleInfo['status'] = 'clean';
        switch (statusChar) {
          case '-': status = 'untracked'; break;
          case '+': status = 'ahead'; break;
          case 'U': status = 'modified'; break;
          default: status = 'clean';
        }
        
        // Get submodule URL and branch
        const { url, branch } = await getSubmoduleInfo(submodulePath);
        
        submodules.push({
          name: path.basename(submodulePath),
          path: submodulePath,
          url,
          branch,
          commit: commit.substring(0, 8),
          status
        });
      }
    }
    
    return submodules;
  } catch (error: any) {
    // If no submodules exist, return empty array
    if (error.toString().includes('No submodule mapping found')) {
      return [];
    }
    throw new Error(`Failed to get submodule status: ${error}`);
  }
}

async function getSubmoduleInfo(submodulePath: string): Promise<{ url: string; branch: string }> {
  try {
    const { stdout: url } = await execAsync(`git config submodule.${submodulePath}.url`);
    let branch = 'main';
    
    try {
      const { stdout: branchOutput } = await execAsync(`git config submodule.${submodulePath}.branch`);
      branch = branchOutput.trim() || 'main';
    } catch {
      // Branch not configured, use default
    }
    
    return {
      url: url.trim(),
      branch
    };
  } catch (error) {
    return { url: 'unknown', branch: 'main' };
  }
}

export async function createSubmoduleDocumentation(
  projectPath: string,
  submodules: SubmoduleInfo[]
): Promise<void> {
  const docsPath = path.join(projectPath, 'docs');
  await fs.ensureDir(docsPath);
  
  const submoduleDocPath = path.join(docsPath, 'SUBMODULES.md');
  
  const content = `# Submodules

This document describes the Git submodules used in this project.

## Overview

This project uses Git submodules to manage external dependencies and shared components. Each submodule represents a separate repository that can be developed independently.

## Submodules

${submodules.length === 0 ? 'No submodules configured.' : submodules.map((sub: SubmoduleInfo) => `
### ${sub.name}

- **Path**: \`${sub.path}\`
- **Repository**: ${sub.url}
- **Branch**: ${sub.branch}
- **Current Commit**: ${sub.commit}
- **Status**: ${sub.status}
`).join('\n')}

## Working with Submodules

### Initial Setup

When cloning this repository, initialize and update all submodules:

\`\`\`bash
git clone --recursive <repository-url>
# OR
git clone <repository-url>
git submodule update --init --recursive
\`\`\`

### Updating Submodules

Update all submodules to their latest commits:

\`\`\`bash
re-shell submodule update
# OR
git submodule update --remote --recursive
\`\`\`

Update a specific submodule:

\`\`\`bash
re-shell submodule update <path>
# OR
git submodule update --remote <path>
\`\`\`

### Adding New Submodules

\`\`\`bash
re-shell submodule add <repository-url> <path> [--branch <branch>]
\`\`\`

### Removing Submodules

\`\`\`bash
re-shell submodule remove <path>
\`\`\`

### Checking Status

\`\`\`bash
re-shell submodule status
\`\`\`

## Development Workflow

1. **Making Changes**: Work in the submodule directory as you would in any Git repository
2. **Committing**: Commit changes within the submodule first
3. **Updating Parent**: Commit the submodule reference update in the parent repository
4. **Pushing**: Push both the submodule and parent repository changes

## Best Practices

1. Always commit submodule changes before updating the parent repository
2. Use specific branches for submodules rather than tracking HEAD
3. Document any submodule dependencies and their purposes
4. Regularly update submodules to stay current with upstream changes
5. Use \`git submodule foreach\` for bulk operations across all submodules

## Troubleshooting

### Submodule Not Initialized
\`\`\`bash
git submodule update --init <path>
\`\`\`

### Submodule Conflicts
\`\`\`bash
git submodule deinit <path>
git submodule update --init <path>
\`\`\`

### Reset Submodule to Tracked Commit
\`\`\`bash
git submodule update --force <path>
\`\`\`
`;

  await fs.writeFile(submoduleDocPath, content);
}

export async function generateSubmoduleScript(projectPath: string): Promise<void> {
  const scriptsPath = path.join(projectPath, 'scripts');
  await fs.ensureDir(scriptsPath);
  
  const scriptPath = path.join(scriptsPath, 'submodule-helper.sh');
  
  const script = `#!/bin/bash

# Submodule Helper Script
# This script provides utilities for managing Git submodules

set -e

function show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  init                 Initialize all submodules"
    echo "  update [PATH]        Update submodules (all or specific path)"
    echo "  status               Show submodule status"
    echo "  foreach [COMMAND]    Run command in each submodule"
    echo "  clean                Clean all submodules"
    echo "  reset                Reset all submodules to tracked commits"
    echo ""
    echo "Examples:"
    echo "  $0 init"
    echo "  $0 update"
    echo "  $0 update apps/my-app"
    echo "  $0 foreach 'git pull origin main'"
    echo "  $0 status"
}

function init_submodules() {
    echo "Initializing submodules..."
    git submodule update --init --recursive
    echo "Submodules initialized successfully"
}

function update_submodules() {
    local path=$1
    if [ -n "$path" ]; then
        echo "Updating submodule: $path"
        git submodule update --remote --recursive "$path"
    else
        echo "Updating all submodules..."
        git submodule update --remote --recursive
    fi
    echo "Submodules updated successfully"
}

function show_status() {
    echo "Submodule status:"
    git submodule status --recursive
}

function foreach_command() {
    local command=$1
    if [ -z "$command" ]; then
        echo "Error: No command specified for foreach"
        exit 1
    fi
    echo "Running '$command' in each submodule..."
    git submodule foreach --recursive "$command"
}

function clean_submodules() {
    echo "Cleaning submodules..."
    git submodule foreach --recursive 'git clean -fd'
    echo "Submodules cleaned"
}

function reset_submodules() {
    echo "Resetting submodules to tracked commits..."
    git submodule update --force --recursive
    echo "Submodules reset"
}

case "$1" in
    init)
        init_submodules
        ;;
    update)
        update_submodules "$2"
        ;;
    status)
        show_status
        ;;
    foreach)
        foreach_command "$2"
        ;;
    clean)
        clean_submodules
        ;;
    reset)
        reset_submodules
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown command '$1'"
        echo ""
        show_help
        exit 1
        ;;
esac
`;

  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, '755');
}

export async function isGitRepository(dirPath: string = process.cwd()): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: dirPath });
    return true;
  } catch {
    return false;
  }
}
