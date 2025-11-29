/**
 * @ai-context High-Fidelity GitHub Simulator for Integration Testing
 * @ai-invariant Maintains in-memory state of a virtual repository
 */
class GitHubSimulator {
    constructor() {
        this.reset();
    }

    reset() {
        this.issues = new Map();
        this.pullRequests = new Map();
        this.files = new Map(); // Virtual File System: path -> content
        this.comments = new Map(); // issueId -> [comments]
        this.nextIssueId = 1;
        this.nextPrId = 1;
        this.nextCommentId = 1;

        // Setup default files
        this.files.set('README.md', '# Project');
    }

    getOctokitMock() {
        // Return an object that mimics the Octokit client structure
        return {
            rest: {
                issues: {
                    get: async ({ issue_number }) => {
                        if (!this.issues.has(issue_number)) {
                            throw new Error(`Issue #${issue_number} not found`);
                        }
                        return { data: this.issues.get(issue_number) };
                    },
                    create: async ({ title, body, labels }) => {
                        const id = this.nextIssueId++;
                        const issue = {
                            number: id,
                            title,
                            body,
                            labels: labels ? labels.map(l => ({ name: l })) : [],
                            state: 'open',
                            created_at: new Date().toISOString(),
                            user: { login: 'simulator-user' }
                        };
                        this.issues.set(id, issue);
                        return { data: issue };
                    },
                    update: async ({ issue_number, state, body }) => {
                        if (!this.issues.has(issue_number)) {
                            throw new Error(`Issue #${issue_number} not found`);
                        }
                        const issue = this.issues.get(issue_number);
                        if (state) issue.state = state;
                        if (body) issue.body = body;
                        return { data: issue };
                    },
                    createComment: async ({ issue_number, body }) => {
                        if (!this.comments.has(issue_number)) {
                            this.comments.set(issue_number, []);
                        }
                        const comment = {
                            id: this.nextCommentId++,
                            body,
                            created_at: new Date().toISOString(),
                            user: { login: 'simulator-bot' }
                        };
                        this.comments.get(issue_number).push(comment);
                        return { data: comment };
                    },
                    listComments: async ({ issue_number }) => {
                        return { data: this.comments.get(issue_number) || [] };
                    }
                },
                pulls: {
                    create: async ({ title, body, head, base }) => {
                        const id = this.nextPrId++;
                        const pr = {
                            number: id,
                            title,
                            body,
                            head: { ref: head },
                            base: { ref: base },
                            state: 'open',
                            html_url: `http://github.sim/pulls/${id}`
                        };
                        this.pullRequests.set(id, pr);
                        return { data: pr };
                    }
                },
                repos: {
                    getContent: async ({ path: filePath }) => {
                        if (!this.files.has(filePath)) {
                            const error = new Error('Not Found');
                            error.status = 404;
                            throw error;
                        }
                        const content = this.files.get(filePath);
                        return {
                            data: {
                                content: Buffer.from(content).toString('base64'),
                                encoding: 'base64',
                                sha: 'simulated-sha'
                            }
                        };
                    },
                    createOrUpdateFileContents: async ({ path: filePath, message, content }) => {
                        const decodedContent = Buffer.from(content, 'base64').toString('utf-8');
                        this.files.set(filePath, decodedContent);
                        return {
                            data: {
                                content: { name: filePath },
                                commit: { message }
                            }
                        };
                    }
                }
            }
        };
    }

    // Helper to inspect state during tests
    dumpState() {
        return {
            issues: Array.from(this.issues.values()),
            pullRequests: Array.from(this.pullRequests.values()),
            files: Array.from(this.files.keys())
        };
    }
}

module.exports = GitHubSimulator;
