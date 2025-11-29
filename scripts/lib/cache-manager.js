/**
 * @ai-context Simple File-based LRU Cache for API calls
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CacheManager {
    constructor(ttlSeconds = 3600) {
        this.cacheDir = path.join(process.cwd(), '.github', 'cache');
        this.ttlMs = ttlSeconds * 1000;

        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    get(key) {
        const filePath = this.getCachePath(key);
        if (!fs.existsSync(filePath)) return null;

        try {
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtimeMs;

            if (age > this.ttlMs) {
                // Expired
                fs.unlinkSync(filePath);
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn(`Cache read error for ${key}: ${error.message}`);
            return null;
        }
    }

    set(key, value) {
        try {
            const filePath = this.getCachePath(key);
            fs.writeFileSync(filePath, JSON.stringify(value));
        } catch (error) {
            console.warn(`Cache write error for ${key}: ${error.message}`);
        }
    }

    getCachePath(key) {
        const hash = crypto.createHash('md5').update(key).digest('hex');
        return path.join(this.cacheDir, `${hash}.json`);
    }

    clear() {
        if (fs.existsSync(this.cacheDir)) {
            fs.rmdirSync(this.cacheDir, { recursive: true });
            fs.mkdirSync(this.cacheDir);
        }
    }
}

module.exports = CacheManager;
