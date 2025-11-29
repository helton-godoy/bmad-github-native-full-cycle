/**
 * @ai-context Centralized Secret Manager for Secure Access and Masking
 * @ai-invariant Secrets must never be logged in plain text
 */
class SecretManager {
    constructor() {
        this.secrets = new Map();
        this.maskedValues = new Set();
        this.loadSecrets();
    }

    loadSecrets() {
        // Load standard secrets from process.env
        const sensitiveKeys = [
            'GITHUB_TOKEN',
            'NPM_TOKEN',
            'DB_PASSWORD',
            'API_KEY'
        ];

        sensitiveKeys.forEach(key => {
            if (process.env[key]) {
                this.secrets.set(key, process.env[key]);
                this.maskedValues.add(process.env[key]);
            }
        });
    }

    /**
     * @ai-context Get a secret securely
     */
    get(key) {
        // Try internal map first, then process.env
        if (this.secrets.has(key)) {
            return this.secrets.get(key);
        }
        const value = process.env[key];
        if (value) {
            // If found in env but not in map (dynamic secret), track it for masking
            if (key.includes('TOKEN') || key.includes('KEY') || key.includes('PASSWORD') || key.includes('SECRET')) {
                this.maskedValues.add(value);
            }
            return value;
        }
        return undefined;
    }

    /**
     * @ai-context Validate required secrets are present
     */
    validateRequired(keys) {
        const missing = keys.filter(key => !this.get(key));
        if (missing.length > 0) {
            throw new Error(`Missing required secrets: ${missing.join(', ')}`);
        }
        return true;
    }

    /**
     * @ai-context Mask secrets in a string
     */
    mask(text) {
        if (!text || typeof text !== 'string') return text;

        let maskedText = text;
        this.maskedValues.forEach(secret => {
            if (secret && secret.length > 4) { // Don't mask short common strings
                // Escape special regex characters in the secret
                const escapedSecret = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedSecret, 'g');
                maskedText = maskedText.replace(regex, '***REDACTED***');
            }
        });
        return maskedText;
    }
}

module.exports = SecretManager;
