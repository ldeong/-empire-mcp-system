#!/usr/bin/env node

/**
 * Empire MCP System - GitHub Copilot Coding Agent Trigger
 * Creates GitHub Copilot coding agent sessions for automated development
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class CodingAgentTrigger {
    constructor(repoPath = process.cwd()) {
        this.repoPath = repoPath;
        this.githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_COPILOT_TOKEN;
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds
    }

    /**
     * Execute command with error handling
     */
    execCommand(command, options = {}) {
        try {
            const result = execSync(command, {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                ...options
            });
            return { success: true, output: result.trim() };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                code: error.status,
                output: error.stdout?.toString() || '',
                stderr: error.stderr?.toString() || ''
            };
        }
    }

    /**
     * Validate GitHub CLI and token
     */
    validateGitHubCLI() {
        console.log('🔍 Validating GitHub CLI...');

        // Check if gh CLI is installed
        const ghVersion = this.execCommand('gh --version');
        if (!ghVersion.success) {
            throw new Error('GitHub CLI not found. Please install it first.');
        }

        // Check authentication
        const authStatus = this.execCommand('gh auth status');
        if (!authStatus.success) {
            throw new Error('GitHub CLI not authenticated. Please run: gh auth login');
        }

        console.log('✅ GitHub CLI validated');
        return true;
    }

    /**
     * Get repository information
     */
    getRepositoryInfo() {
        console.log('📋 Getting repository information...');

        const remoteUrl = this.execCommand('git config --get remote.origin.url');
        if (!remoteUrl.success) {
            throw new Error('Failed to get remote URL');
        }

        // Extract owner/repo from URL
        const urlMatch = remoteUrl.output.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
        if (!urlMatch) {
            throw new Error('Could not parse GitHub repository URL');
        }

        const owner = urlMatch[1];
        const repo = urlMatch[2];

        console.log(`📦 Repository: ${owner}/${repo}`);
        return { owner, repo, url: remoteUrl.output };
    }

    /**
     * Generate coding agent task description
     */
    generateTaskDescription(taskType, context = {}) {
        const templates = {
            'feature': `Implement new feature: ${context.featureName || 'Feature'}
Description: ${context.description || 'Add new functionality to the system'}
Requirements:
${context.requirements?.map(req => `- ${req}`).join('\n') || '- Implement core functionality\n- Add tests\n- Update documentation'}

Files to modify:
${context.files?.map(file => `- ${file}`).join('\n') || '- src/new-feature.js\n- tests/new-feature.test.js'}

Acceptance Criteria:
${context.acceptance?.map(criteria => `- ${criteria}`).join('\n') || '- Feature works as expected\n- Tests pass\n- Code is documented'}`,

            'bugfix': `Fix bug: ${context.bugTitle || 'Bug Fix'}
Description: ${context.description || 'Fix identified issue in the system'}
Root Cause: ${context.rootCause || 'TBD'}
Steps to Reproduce:
${context.reproduce?.map(step => `${step}`).join('\n') || '1. Trigger the bug\n2. Observe error'}

Expected Behavior: ${context.expected || 'System works correctly'}
Actual Behavior: ${context.actual || 'System fails with error'}

Files to modify:
${context.files?.map(file => `- ${file}`).join('\n') || '- src/buggy-component.js'}`,

            'refactor': `Refactor: ${context.refactorName || 'Code Refactoring'}
Description: ${context.description || 'Improve code structure and maintainability'}
Goals:
${context.goals?.map(goal => `- ${goal}`).join('\n') || '- Improve readability\n- Reduce complexity\n- Enhance maintainability'}

Files to modify:
${context.files?.map(file => `- ${file}`).join('\n') || '- src/component-to-refactor.js'}

Impact Assessment:
${context.impact?.map(item => `- ${item}`).join('\n') || '- No breaking changes\n- Performance improvements expected'}`,

            'documentation': `Documentation: ${context.docTitle || 'Update Documentation'}
Description: ${context.description || 'Update project documentation'}
Tasks:
${context.tasks?.map(task => `- ${task}`).join('\n') || '- Update README.md\n- Add API documentation\n- Update inline comments'}

Files to modify:
${context.files?.map(file => `- ${file}`).join('\n') || '- README.md\n- docs/api.md'}`,

            'test': `Testing: ${context.testTitle || 'Add Tests'}
Description: ${context.description || 'Add comprehensive test coverage'}
Test Types:
${context.testTypes?.map(type => `- ${type}`).join('\n') || '- Unit tests\n- Integration tests\n- E2E tests'}

Files to modify:
${context.files?.map(file => `- ${file}`).join('\n') || '- tests/new-tests.js\n- src/component.js'}`,

            'custom': context.description || 'Custom development task'
        };

        return templates[taskType] || templates['custom'];
    }

    /**
     * Create GitHub issue for coding agent
     */
    async createGitHubIssue(title, body, labels = ['enhancement']) {
        console.log('📝 Creating GitHub issue...');

        // Try with all labels first
        let createCommand = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "${labels.join(',')}"`;

        let result = this.execCommand(createCommand);
        if (!result.success && result.stderr.includes('not found')) {
            // Try with just 'enhancement' label if custom labels don't exist
            console.log('⚠️  Custom labels not found, using default labels...');
            createCommand = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "enhancement"`;
            result = this.execCommand(createCommand);
        }

        if (!result.success) {
            throw new Error(`Failed to create GitHub issue: ${result.error}`);
        }

        // Extract issue number from output
        const issueMatch = result.output.match(/#(\d+)/);
        const issueNumber = issueMatch ? issueMatch[1] : null;

        console.log(`✅ Issue created: ${result.output}`);
        return { url: result.output, number: issueNumber };
    }

    /**
     * Trigger coding agent session
     */
    async triggerCodingAgent(taskType, context = {}) {
        try {
            console.log('🚀 Starting coding agent trigger process...');

            // Validate GitHub CLI
            this.validateGitHubCLI();

            // Get repository info
            const repoInfo = this.getRepositoryInfo();

            // Generate task description
            const taskDescription = this.generateTaskDescription(taskType, context);

            // Create issue title
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            const issueTitle = `[Coding Agent] ${taskType.charAt(0).toUpperCase() + taskType.slice(1)} - ${timestamp}`;

            // Create GitHub issue
            const issue = await this.createGitHubIssue(issueTitle, taskDescription);

            console.log('🎉 Coding agent session triggered successfully!');
            console.log(`📋 Issue: ${issue.url}`);
            console.log(`🔗 To trigger coding agent: Use "#github-pull-request_copilot-coding-agent" in your next message`);

            return {
                success: true,
                issue: issue,
                taskType,
                description: taskDescription,
                triggerCommand: '#github-pull-request_copilot-coding-agent'
            };

        } catch (error) {
            console.error(`❌ Failed to trigger coding agent: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * List recent coding agent sessions
     */
    listRecentSessions(limit = 5) {
        console.log('📋 Listing recent coding agent sessions...');

        const listCommand = `gh issue list --label "copilot-coding-agent" --limit ${limit} --json number,title,createdAt,url`;

        const result = this.execCommand(listCommand);
        if (!result.success) {
            console.error(`Failed to list issues: ${result.error}`);
            return [];
        }

        try {
            const issues = JSON.parse(result.output);
            console.log(`Found ${issues.length} recent coding agent sessions:`);
            issues.forEach(issue => {
                console.log(`  #${issue.number}: ${issue.title} (${new Date(issue.createdAt).toLocaleDateString()})`);
                console.log(`    ${issue.url}`);
            });
            return issues;
        } catch (error) {
            console.error('Failed to parse issue list:', error);
            return [];
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(`
Empire MCP System - GitHub Copilot Coding Agent Trigger

Usage: node coding-agent-trigger.js <task-type> [options]

Task Types:
  feature     - Implement new feature
  bugfix      - Fix a bug
  refactor    - Refactor code
  documentation - Update documentation
  test        - Add tests
  custom      - Custom task

Options:
  --title, -t     Custom title for the task
  --desc, -d      Task description
  --files, -f     Files to modify (comma-separated)
  --list, -l      List recent coding agent sessions
  --help, -h      Show this help

Examples:
  node coding-agent-trigger.js feature --title "Add user authentication"
  node coding-agent-trigger.js bugfix --desc "Fix login timeout issue"
  node coding-agent-trigger.js refactor --files "src/auth.js,src/user.js"
  node coding-agent-trigger.js --list
        `);
        return;
    }

    const taskType = args[0];
    const options = {};

    // Parse options
    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--title':
            case '-t':
                options.title = args[++i];
                break;
            case '--desc':
            case '-d':
                options.description = args[++i];
                break;
            case '--files':
            case '-f':
                options.files = args[++i].split(',');
                break;
            case '--list':
            case '-l':
                options.list = true;
                break;
        }
    }

    const trigger = new CodingAgentTrigger();

    if (options.list) {
        trigger.listRecentSessions();
        return;
    }

    const result = await trigger.triggerCodingAgent(taskType, options);

    if (result.success) {
        console.log('\n🎯 Next Steps:');
        console.log('1. Copy the issue URL above');
        console.log('2. In your next message, include: #github-pull-request_copilot-coding-agent');
        console.log('3. The coding agent will create a branch and implement the task');
    } else {
        console.error('❌ Trigger failed:', result.error);
        process.exit(1);
    }
}

// Export for use as module
module.exports = CodingAgentTrigger;

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}