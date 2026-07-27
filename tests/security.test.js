/**
 * @ai-context Test script for Logger and SecretManager
 */
const Logger = require('../scripts/lib/logger');
const fs = require('fs');
const path = require('path');

describe('Security Infrastructure', () => {
    test('masks secrets and outputs valid JSON structure', async () => {
        const logFile = path.join(process.cwd(), '.github/logs/bmad-testcomponent.json.log');
        if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
        }

        // Mock env var
        process.env.TEST_SECRET = 'SUPER_SECRET_PASSWORD_123';

        const logger = new Logger('TestComponent');

        logger.info('This is a normal message');
        logger.warn('This message contains a secret: SUPER_SECRET_PASSWORD_123');
        logger.error('Metadata secret check', { secret: 'SUPER_SECRET_PASSWORD_123', public: 'visible' });

        // Verify log file content
        expect(fs.existsSync(logFile)).toBe(true);

        if (fs.existsSync(logFile)) {
            const content = fs.readFileSync(logFile, 'utf-8');

            expect(content).toContain('***REDACTED***');
            expect(content).not.toContain('SUPER_SECRET_PASSWORD_123');
            expect(content).toContain('"level":"INFO"');
            expect(content).toContain('"timestamp":');

            // Cleanup
            fs.unlinkSync(logFile);
        }
    });
});
