/**
 * @ai-context Mock for @octokit/rest
 * @ai-invariant Mock all GitHub API calls for testing
 * @ai-connection Provides consistent mock responses for GitHub operations
 */
class MockOctokit {
    constructor() {
        this.rest = {
            issues: {
                create: jest.fn().mockResolvedValue({
                    data: {
                        number: 123,
                        title: 'Test Issue',
                        body: 'Test Body',
                        html_url: 'https://github.com/test/repo/issues/123'
                    }
                }),
                get: jest.fn().mockResolvedValue({
                    data: {
                        number: 123,
                        title: 'Test Issue',
                        body: 'Test Body',
                        state: 'open',
                        created_at: '2025-11-28T00:00:00Z'
                    }
                }),
                update: jest.fn().mockResolvedValue({
                    data: { state: 'closed' }
                }),
                createComment: jest.fn().mockResolvedValue({
                    data: {
                        id: 456,
                        body: 'Test Comment'
                    }
                }),
                listForRepo: jest.fn().mockResolvedValue({
                    data: [
                        {
                            number: 123,
                            title: 'Test Issue',
                            labels: [{ name: 'test' }],
                            state: 'open',
                            created_at: '2025-11-28T00:00:00Z'
                        }
                    ]
                })
            },
            repos: {
                createOrUpdateFileContents: jest.fn().mockResolvedValue({
                    data: {
                        commit: {
                            sha: 'abc123'
                        }
                    }
                }),
                createRelease: jest.fn().mockResolvedValue({
                    data: {
                        id: 789,
                        tag_name: 'v1.0.1',
                        name: 'Release v1.0.1',
                        html_url: 'https://github.com/test/repo/releases/v1.0.1'
                    }
                })
            }
        };
    }
}

module.exports = { Octokit: MockOctokit };
