/**
 * @ai-context Recovery Persona - Self-healing and rollback automation
 * @ai-invariant Recovery must detect failures and execute safe rollbacks
 * @ai-connection Monitors CI/CD failures and reverts problematic commits
 */
const BasePersona = require('./base-persona-enhanced');

class RecoveryPersona extends BasePersona {
    constructor(githubToken) {
        super('Recovery Agent', 'RECOVERY', githubToken);
    }

    /**
     * @ai-context Execute recovery workflow
     */
    async execute(issueNumber) {
        this.log('Starting recovery analysis');

        try {
            // 1. Check CI/CD status
            const ciStatus = await this.checkCIStatus();

            if (ciStatus.failed) {
                this.log(`CI Failed on commit: ${ciStatus.failedCommit}`);

                // 2. Execute rollback
                await this.rollbackFailedCommit(ciStatus.failedCommit);

                // 3. Create recovery issue
                await this.createRecoveryIssue(issueNumber, ciStatus);

                // 4. Update context
                this.updateActiveContext(`Recovery executed for issue #${issueNumber}: Reverted ${ciStatus.failedCommit}`);
            } else {
                this.log('No failures detected, recovery not needed');
            }

            return { status: 'completed', ciStatus };

        } catch (error) {
            this.log(`Error in Recovery execution: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Check CI/CD status via GitHub API
     */
    async checkCIStatus() {
        try {
            // Get latest commit
            const { data: commits } = await this.octokit.rest.repos.listCommits({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'bmad-github-native-full-cycle',
                per_page: 5
            });

            if (commits.length === 0) {
                return { failed: false };
            }

            const latestCommit = commits[0];

            // Check status of latest commit
            const { data: statuses } = await this.octokit.rest.repos.getCombinedStatusForRef({
                owner: process.env.GITHUB_OWNER || 'helton-godoy',
                repo: process.env.GITHUB_REPO || 'bmad-github-native-full-cycle',
                ref: latestCommit.sha
            });

            const failed = statuses.state === 'failure' || statuses.state === 'error';

            return {
                failed,
                failedCommit: failed ? latestCommit.sha : null,
                commitMessage: failed ? latestCommit.commit.message : null,
                statuses: statuses.statuses
            };

        } catch (error) {
            this.log(`Failed to check CI status: ${error.message}`, 'ERROR');
            return { failed: false, error: error.message };
        }
    }

    /**
     * @ai-context Rollback failed commit
     */
    async rollbackFailedCommit(commitSha) {
        this.log(`Rolling back commit: ${commitSha.substring(0, 7)}`);

        try {
            // Create revert commit
            await this.execCommand(`git revert ${commitSha} --no-edit`);

            this.log(`✅ Rollback executed: reverted ${commitSha.substring(0, 7)}`);

            // Commit the revert
            await this.commit(`Automatic rollback of failed commit ${commitSha.substring(0, 7)}`);

        } catch (error) {
            this.log(`Failed to rollback commit: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * @ai-context Create recovery issue for manual review
     */
    async createRecoveryIssue(originalIssue, ciStatus) {
        const title = `[Recovery] CI Failure - Issue #${originalIssue}`;
        const body = `## Recovery Action Executed

**Original Issue**: #${originalIssue}
**Failed Commit**: \`${ciStatus.failedCommit.substring(0, 7)}\`
**Commit Message**: ${ciStatus.commitMessage}

## CI Failure Details

${ciStatus.statuses.map(s => `- **${s.context}**: ${s.state} - ${s.description || 'No description'}`).join('\n')}

## Actions Taken

✅ Automatic rollback executed via \`git revert\`
✅ Recovery issue created for manual review

## Next Steps

1. Review the failed commit changes
2. Identify the root cause of CI failure
3. Fix the issue and re-open original issue #${originalIssue}

---
*Created by Recovery Persona*`;

        await this.createIssue(title, body, ['recovery', 'bug', 'ci-failure']);
    }
}

module.exports = RecoveryPersona;
