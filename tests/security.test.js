/**
 * @ai-context Test script for Logger and SecretManager
 */
const Logger = require('../scripts/lib/logger');
const fs = require('fs');
const path = require('path');

async function testSecurity() {
    console.log('🧪 Starting Security Infrastructure Test...');

    // Mock env var
    process.env.TEST_SECRET = 'SUPER_SECRET_PASSWORD_123';

    const logger = new Logger('TestComponent');

    logger.info('This is a normal message');
    logger.warn('This message contains a secret: SUPER_SECRET_PASSWORD_123');
    logger.error('Metadata secret check', { secret: 'SUPER_SECRET_PASSWORD_123', public: 'visible' });

    // Verify log file content
    const logFile = path.join(process.cwd(), '.github/logs/bmad-testcomponent.json.log');

    if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf-8');
        console.log('📄 Log File Content:');
        console.log(content);

        if (content.includes('***REDACTED***') && !content.includes('SUPER_SECRET_PASSWORD_123')) {
            console.log('✅ Secret Masking: SUCCESS');
        } else {
            console.error('❌ Secret Masking: FAILED');
        }

        if (content.includes('"level":"INFO"') && content.includes('"timestamp":')) {
            console.log('✅ JSON Structure: SUCCESS');
        } else {
            console.error('❌ JSON Structure: FAILED');
        }

        // Cleanup
        fs.unlinkSync(logFile);
    } else {
        console.error('❌ Log file not created');
    }
}

testSecurity();
