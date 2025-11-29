/**
 * @ai-context Git State Manager - Manages persistent state in an orphan branch
 * @ai-invariant Operations must NOT affect the current working directory or index
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitStateManager {
    constructor(branchName = 'bmad-state') {
        this.branchName = branchName;
        this.gitEnv = { ...process.env }; // Copy env to modify GIT_INDEX_FILE later
    }

    /**
     * @ai-context Initialize the state branch if it doesn't exist
     */
    init() {
        try {
            execSync(`git rev-parse --verify ${this.branchName}`, { stdio: 'ignore' });
        } catch (e) {
            // Branch doesn't exist, create it as an orphan (empty root commit)
            // We do this by creating a commit on an empty tree and updating the ref
            const emptyTreeHash = execSync('git hash-object -t tree /dev/null').toString().trim();
            const commitHash = execSync(`echo "Initial State" | git commit-tree ${emptyTreeHash}`).toString().trim();
            execSync(`git update-ref refs/heads/${this.branchName} ${commitHash}`);
            console.log(`Initialized state branch: ${this.branchName}`);
        }
    }

    /**
     * @ai-context Read a file from the state branch
     */
    read(filePath) {
        try {
            // Use git show branch:path
            return execSync(`git show ${this.branchName}:${filePath}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        } catch (e) {
            return null; // File not found or branch issue
        }
    }

    /**
     * @ai-context Write a file to the state branch atomically
     */
    write(filePath, content) {
        const tempIndex = `.git/bmad-state-index-${Date.now()}`;
        const env = { ...this.gitEnv, GIT_INDEX_FILE: tempIndex };

        try {
            // 1. Read current branch tree into temp index (if exists)
            try {
                execSync(`git read-tree ${this.branchName}`, { env, stdio: 'ignore' });
            } catch (e) {
                // If branch is empty/new, read-tree might fail or be empty, which is fine
            }

            // 2. Hash the new content
            const blobHash = execSync('git hash-object -w --stdin', { input: content, encoding: 'utf-8' }).toString().trim();

            // 3. Update the temp index with the new blob
            // --cacheinfo <mode> <object> <path>
            execSync(`git update-index --add --cacheinfo 100644 ${blobHash} "${filePath}"`, { env });

            // 4. Write the new tree
            const treeHash = execSync('git write-tree', { env, encoding: 'utf-8' }).toString().trim();

            // 5. Create a new commit
            // Get parent commit if exists
            let parentArg = '';
            try {
                const parentHash = execSync(`git rev-parse ${this.branchName}`, { encoding: 'utf-8' }).toString().trim();
                parentArg = `-p ${parentHash}`;
            } catch (e) { }

            const commitMsg = `Update ${filePath}`;
            const commitHash = execSync(`echo "${commitMsg}" | git commit-tree ${treeHash} ${parentArg}`, { encoding: 'utf-8' }).toString().trim();

            // 6. Update the branch ref
            execSync(`git update-ref refs/heads/${this.branchName} ${commitHash}`);

        } catch (error) {
            console.error(`GitStateManager Write Error: ${error.message}`);
            throw error;
        } finally {
            // Cleanup temp index
            if (fs.existsSync(tempIndex)) {
                fs.unlinkSync(tempIndex);
            }
        }
    }

    /**
     * @ai-context List files in the state branch
     */
    list() {
        try {
            const output = execSync(`git ls-tree -r --name-only ${this.branchName}`, { encoding: 'utf-8' });
            return output.split('\n').filter(Boolean);
        } catch (e) {
            return [];
        }
    }
}

module.exports = GitStateManager;
