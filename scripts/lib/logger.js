/**
 * @ai-context Structured JSON Logger with Secret Masking
 * @ai-invariant All logs must be structured and sanitized
 */
const fs = require('fs');
const path = require('path');
const SecretManager = require('./secret-manager');

class Logger {
    constructor(componentName) {
        this.componentName = componentName;
        this.secretManager = new SecretManager();
        this.logDir = path.join(process.cwd(), '.github', 'logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * @ai-context Log an info message
     */
    info(message, metadata = {}) {
        this.log('INFO', message, metadata);
    }

    /**
     * @ai-context Log a warning message
     */
    warn(message, metadata = {}) {
        this.log('WARN', message, metadata);
    }

    /**
     * @ai-context Log an error message
     */
    error(message, metadata = {}) {
        this.log('ERROR', message, metadata);
    }

    /**
     * @ai-context Internal log writer
     */
    log(level, message, metadata) {
        const timestamp = new Date().toISOString();

        // Sanitize inputs
        const sanitizedMessage = this.secretManager.mask(message);
        const sanitizedMetadata = this.sanitizeMetadata(metadata);

        const logEntry = {
            timestamp,
            level,
            component: this.componentName,
            message: sanitizedMessage,
            ...sanitizedMetadata
        };

        const jsonLine = JSON.stringify(logEntry);

        // Console output (human readable)
        this.writeToConsole(level, sanitizedMessage, sanitizedMetadata);

        // File output (JSON Lines)
        this.writeToFile(jsonLine);
    }

    sanitizeMetadata(metadata) {
        const sanitized = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'string') {
                sanitized[key] = this.secretManager.mask(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    writeToConsole(level, message, metadata) {
        const colors = {
            INFO: '\x1b[32m', // Green
            WARN: '\x1b[33m', // Yellow
            ERROR: '\x1b[31m', // Red
            RESET: '\x1b[0m'
        };

        const color = colors[level] || colors.RESET;
        const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
        console.log(`${color}[${level}] [${this.componentName}] ${message}${colors.RESET} ${metaStr}`);
    }

    writeToFile(jsonLine) {
        const logFile = path.join(this.logDir, `bmad-${this.componentName.toLowerCase()}.json.log`);
        try {
            fs.appendFileSync(logFile, jsonLine + '\n');
        } catch (error) {
            console.error(`Failed to write log: ${error.message}`);
        }
    }
}

module.exports = Logger;
