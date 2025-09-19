#!/usr/bin/env node

/**
 * Empire MCP System - Auto-Commit Script
 * Safely commits and pushes changes with error handling and safety checks
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AutoCommitManager {
    constructor(repoPath = process.cwd()) {
        this.repoPath = repoPath;
        this.gitBinary = 'git';
        this.maxCommitSize = 100; // Maximum files per commit
        this.sensitivePatterns = [
            /api[_-]?key/i,
            /secret/i,
            /password/i,
            /token/i,
            /private[_-]?key/i,
            /.env$/,
            /credentials/i
        ];
    }

    /**
     * Execute git command with error handling
     */
    execGit(command, options = {}) {
        try {
            const result = execSync(`${this.gitBinary} ${command}`, {
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
     * Check if file contains sensitive information
     */
    isSensitiveFile(filePath) {
        return this.sensitivePatterns.some(pattern => pattern.test(filePath));
    }

    /**
     * Validate git repository state
     */
    validateRepository() {
        console.log('🔍 Validating repository state...');
        
        // Check if we're in a git repository
        const gitStatus = this.execGit('status --porcelain');
        if (!gitStatus.success) {
            throw new Error(`Not a git repository or git error: ${gitStatus.error}`);
        }

        // Check git configuration
        const userName = this.execGit('config user.name');
        const userEmail = this.execGit('config user.email');
        
        if (!userName.success || !userName.output.trim()) {
            throw new Error('Git user.name not configured');
        }
        
        if (!userEmail.success || !userEmail.output.trim()) {
            throw new Error('Git user.email not configured');
        }

        console.log(`✅ Repository valid - User: ${userName.output} <${userEmail.output}>`);
        return true;
    }

    /**
     * Get repository status and changes
     */
    getRepositoryStatus() {
        const status = this.execGit('status --porcelain');
        if (!status.success) {
            throw new Error(`Failed to get repository status: ${status.error}`);
        }

        const changes = status.output.split('\n').filter(line => line.trim()).map(line => {
            const statusCode = line.substring(0, 2);
            const filePath = line.substring(3);
            return {
                status: statusCode,
                file: filePath,
                type: this.getChangeType(statusCode)
            };
        });

        return {
            hasChanges: changes.length > 0,
            changes,
            changeCount: changes.length
        };
    }

    /**
     * Get change type from git status code
     */
    getChangeType(statusCode) {
        const code = statusCode.trim();
        if (code.includes('M')) return 'modified';
        if (code.includes('A')) return 'added';
        if (code.includes('D')) return 'deleted';
        if (code.includes('R')) return 'renamed';
        if (code.includes('C')) return 'copied';
        if (code.includes('??')) return 'untracked';
        return 'unknown';
    }

    /**
     * Generate commit message based on changes
     */
    generateCommitMessage(changes) {
        const changeTypes = {};
        const fileTypes = {};
        
        changes.forEach(change => {
            changeTypes[change.type] = (changeTypes[change.type] || 0) + 1;
            const ext = path.extname(change.file) || 'other';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const changeTypeStr = Object.entries(changeTypes)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ');

        const primaryType = Object.keys(changeTypes)[0] || 'update';
        
        return {
            title: `Auto-commit: ${changeTypeStr}`,
            body: [
                `Automated commit - ${timestamp}`,
                '',
                'Changes:',
                ...changes.slice(0, 20).map(c => `  ${c.type}: ${c.file}`),
                changes.length > 20 ? `  ... and ${changes.length - 20} more files` : '',
                '',
                `File types: ${Object.entries(fileTypes).map(([ext, count]) => `${ext}(${count})`).join(', ')}`,
                `Total changes: ${changes.length}`
            ].filter(line => line !== '').join('\n')
        };
    }

    /**
     * Safety check for sensitive files
     */
    performSafetyChecks(changes) {
        console.log('🛡️  Performing safety checks...');
        
        const sensitiveFiles = changes.filter(change => this.isSensitiveFile(change.file));
        
        if (sensitiveFiles.length > 0) {
            console.warn('⚠️  Warning: Sensitive files detected:');
            sensitiveFiles.forEach(file => console.warn(`  - ${file.file}`));
            
            // For now, we'll continue but warn. In production, you might want to skip these files
            console.warn('⚠️  Proceeding with caution...');
        }

        // Check for extremely large commits
        if (changes.length > this.maxCommitSize) {
            throw new Error(`Too many changes (${changes.length}). Consider breaking into smaller commits.`);
        }

        console.log('✅ Safety checks passed');
        return true;
    }

    /**
     * Stage changes for commit
     */
    stageChanges(changes) {
        console.log(`📋 Staging ${changes.length} changes...`);
        
        const addResult = this.execGit('add .');
        if (!addResult.success) {
            throw new Error(`Failed to stage changes: ${addResult.error}`);
        }

        console.log('✅ Changes staged successfully');
        return true;
    }

    /**
     * Create commit with generated message
     */
    createCommit(message) {
        console.log('💾 Creating commit...');
        
        const commitResult = this.execGit(`commit -m "${message.title.replace(/"/g, '\\"')}" -m "${message.body.replace(/"/g, '\\"')}"`);
        if (!commitResult.success) {
            throw new Error(`Failed to create commit: ${commitResult.error}`);
        }

        console.log('✅ Commit created successfully');
        console.log(`📝 Commit message: ${message.title}`);
        return true;
    }

    /**
     * Push changes to remote
     */
    pushChanges() {
        console.log('📤 Pushing to remote...');
        
        // Get current branch
        const branchResult = this.execGit('branch --show-current');
        if (!branchResult.success) {
            throw new Error(`Failed to get current branch: ${branchResult.error}`);
        }
        
        const currentBranch = branchResult.output.trim();
        console.log(`📌 Current branch: ${currentBranch}`);

        // Push to origin
        const pushResult = this.execGit(`push origin ${currentBranch}`);
        if (!pushResult.success) {
            throw new Error(`Failed to push to remote: ${pushResult.error}\nSTDERR: ${pushResult.stderr}`);
        }

        console.log('✅ Changes pushed successfully');
        return true;
    }

    /**
     * Main auto-commit process
     */
    async autoCommit(options = {}) {
        const startTime = Date.now();
        
        try {
            console.log('🚀 Starting auto-commit process...');
            console.log(`📁 Repository: ${this.repoPath}`);
            
            // Validate repository
            this.validateRepository();
            
            // Get current status
            const repoStatus = this.getRepositoryStatus();
            
            if (!repoStatus.hasChanges) {
                console.log('📭 No changes to commit');
                return { success: true, message: 'No changes to commit', changes: 0 };
            }

            console.log(`📊 Found ${repoStatus.changeCount} changes`);
            
            // Safety checks
            this.performSafetyChecks(repoStatus.changes);
            
            // Generate commit message
            const commitMessage = this.generateCommitMessage(repoStatus.changes);
            
            if (options.dryRun) {
                console.log('🏃 Dry run mode - no changes will be made');
                console.log('Generated commit message:');
                console.log(`Title: ${commitMessage.title}`);
                console.log(`Body:\n${commitMessage.body}`);
                return { success: true, message: 'Dry run completed', changes: repoStatus.changeCount };
            }

            // Stage changes
            this.stageChanges(repoStatus.changes);
            
            // Create commit
            this.createCommit(commitMessage);
            
            // Push changes (if not skipped)
            if (!options.skipPush) {
                this.pushChanges();
            }

            const duration = Date.now() - startTime;
            const result = {
                success: true,
                message: 'Auto-commit completed successfully',
                changes: repoStatus.changeCount,
                duration,
                commitMessage: commitMessage.title
            };

            console.log(`🎉 Auto-commit completed in ${duration}ms`);
            console.log(`📈 Committed ${result.changes} changes`);
            
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Auto-commit failed after ${duration}ms:`, error.message);
            
            return {
                success: false,
                error: error.message,
                duration
            };
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run') || args.includes('-d'),
        skipPush: args.includes('--skip-push') || args.includes('-s'),
        help: args.includes('--help') || args.includes('-h')
    };

    if (options.help) {
        console.log(`
Empire MCP System - Auto-Commit Script

Usage: node auto-commit.js [options]

Options:
  --dry-run, -d     Simulate commit without making changes
  --skip-push, -s   Create commit but don't push to remote
  --help, -h        Show this help message

Examples:
  node auto-commit.js                # Normal auto-commit
  node auto-commit.js --dry-run      # Preview changes
  node auto-commit.js --skip-push    # Commit locally only
        `);
        return;
    }

    const manager = new AutoCommitManager();
    const result = await manager.autoCommit(options);
    
    if (result.success) {
        console.log(`✅ ${result.message}`);
        process.exit(0);
    } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
    }
}

// Export for use as module
module.exports = AutoCommitManager;

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}