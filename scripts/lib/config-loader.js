/**
 * @ai-context Configuration Loader for BMAD Critical Fixes
 * @ai-invariant Provides centralized configuration management with environment variable overrides
 * @ai-connection Integrates with all BMAD components for consistent configuration
 */

const fs = require('fs');
const path = require('path');

/**
 * Configuration loader that merges default config, file config, and environment variables
 */
class ConfigLoader {
    constructor(configPath = 'config/bmad-critical-fixes.json') {
        this.configPath = configPath;
        this.config = this.loadConfiguration();
    }

    /**
     * Load configuration from file and merge with environment variables
     */
    loadConfiguration() {
        try {
            // Load default configuration
            const defaultConfig = this.getDefaultConfig();

            // Load file configuration if it exists
            let fileConfig = {};
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf-8');
                fileConfig = JSON.parse(configContent);
            }

            // Merge configurations (environment > file > default)
            const mergedConfig = this.deepMerge(defaultConfig, fileConfig);
            const finalConfig = this.applyEnvironmentOverrides(mergedConfig);

            return finalConfig;

        } catch (error) {
            console.warn(`Failed to load configuration: ${error.message}`);
            return this.getDefaultConfig();
        }
    }

    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            version: '1.0.0',
            components: {
                errorRecoveryManager: {
                    enabled: true,
                    maxRetries: 3,
                    maxRecoveryAttempts: 2,
                    enableRecoveryPersona: true,
                    backoffConfig: {
                        initialDelay: 1000,
                        maxDelay: 30000,
                        multiplier: 2,
                        jitterFactor: 0.1,
                        timeout: 60000
                    }
                },
                stateCacheManager: {
                    enabled: true,
                    stateFile: 'workflow-state.json',
                    backupFile: 'workflow-state.backup.json',
                    lockTimeout: 30000,
                    maxStateSize: 10485760
                },
                loopDetector: {
                    enabled: true,
                    maxTransitions: 3,
                    timeWindow: 3600000,
                    historyFile: 'transition-history.json'
                },
                enhancedGatekeeper: {
                    enabled: true,
                    requireContextUpdate: true,
                    developmentMode: false,
                    skipTests: false,
                    maxRetries: 3,
                    bypassEnabled: false
                },
                commitHandler: {
                    enabled: true,
                    maxRetries: 2,
                    validateStaging: true,
                    validateFormat: true,
                    enableRollback: true
                }
            },
            integration: {
                orchestrator: {
                    stateRestoration: true,
                    errorRecovery: true,
                    loopDetection: true
                },
                personas: {
                    commitHandlerIntegration: true,
                    errorRecoveryIntegration: true,
                    statePersistence: true
                },
                gatekeeper: {
                    enhancedValidation: true,
                    developmentBypass: true,
                    errorReporting: true
                }
            },
            monitoring: {
                enabled: true,
                logLevel: 'info',
                metricsCollection: true,
                healthChecks: true
            },
            development: {
                bypassEnabled: false,
                debugMode: false,
                verboseLogging: false,
                skipValidation: false
            }
        };
    }

    /**
     * Apply environment variable overrides
     */
    applyEnvironmentOverrides(config) {
        const envMappings = {
            // Error Recovery Manager
            'BMAD_ERROR_RECOVERY_ENABLED': 'components.errorRecoveryManager.enabled',
            'BMAD_MAX_RETRIES': 'components.errorRecoveryManager.maxRetries',
            'BMAD_MAX_RECOVERY_ATTEMPTS': 'components.errorRecoveryManager.maxRecoveryAttempts',
            'BMAD_RECOVERY_PERSONA_ENABLED': 'components.errorRecoveryManager.enableRecoveryPersona',
            'BMAD_EXPONENTIAL_BACKOFF_INITIAL_DELAY': 'components.errorRecoveryManager.backoffConfig.initialDelay',
            'BMAD_EXPONENTIAL_BACKOFF_MAX_DELAY': 'components.errorRecoveryManager.backoffConfig.maxDelay',
            'BMAD_EXPONENTIAL_BACKOFF_MULTIPLIER': 'components.errorRecoveryManager.backoffConfig.multiplier',

            // State Cache Manager
            'BMAD_STATE_CACHE_ENABLED': 'components.stateCacheManager.enabled',
            'BMAD_STATE_FILE': 'components.stateCacheManager.stateFile',
            'BMAD_STATE_BACKUP_FILE': 'components.stateCacheManager.backupFile',
            'BMAD_STATE_LOCK_TIMEOUT': 'components.stateCacheManager.lockTimeout',
            'BMAD_STATE_MAX_SIZE': 'components.stateCacheManager.maxStateSize',

            // Loop Detector
            'BMAD_LOOP_DETECTION_ENABLED': 'components.loopDetector.enabled',
            'BMAD_LOOP_DETECTION_MAX_TRANSITIONS': 'components.loopDetector.maxTransitions',
            'BMAD_LOOP_DETECTION_TIME_WINDOW': 'components.loopDetector.timeWindow',
            'BMAD_LOOP_DETECTION_HISTORY_FILE': 'components.loopDetector.historyFile',

            // Enhanced Gatekeeper
            'BMAD_ENHANCED_GATEKEEPER_ENABLED': 'components.enhancedGatekeeper.enabled',
            'BMAD_REQUIRE_CONTEXT_UPDATE': 'components.enhancedGatekeeper.requireContextUpdate',
            'BMAD_DEV_MODE': 'components.enhancedGatekeeper.developmentMode',
            'BMAD_SKIP_TESTS': 'components.enhancedGatekeeper.skipTests',
            'BMAD_ENABLE_BYPASS': 'components.enhancedGatekeeper.bypassEnabled',

            // Commit Handler
            'BMAD_COMMIT_VALIDATION_ENABLED': 'components.commitHandler.enabled',
            'BMAD_COMMIT_STAGING_VALIDATION': 'components.commitHandler.validateStaging',
            'BMAD_COMMIT_FORMAT_VALIDATION': 'components.commitHandler.validateFormat',
            'BMAD_COMMIT_ROLLBACK_ENABLED': 'components.commitHandler.enableRollback',

            // Development
            'BMAD_SKIP_VALIDATION': 'development.skipValidation',
            'DEBUG': 'development.debugMode'
        };

        const result = JSON.parse(JSON.stringify(config)); // Deep clone

        for (const [envVar, configPath] of Object.entries(envMappings)) {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this.setNestedProperty(result, configPath, this.parseEnvValue(envValue));
            }
        }

        return result;
    }

    /**
     * Parse environment variable value to appropriate type
     */
    parseEnvValue(value) {
        // Boolean values
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Numeric values
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

        // String values
        return value;
    }

    /**
     * Set nested property using dot notation
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (
                    typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof target[key] === 'object' &&
                    target[key] !== null &&
                    !Array.isArray(target[key])
                ) {
                    result[key] = this.deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }

    /**
     * Get configuration for a specific component
     */
    getComponentConfig(componentName) {
        return this.config.components[componentName] || {};
    }

    /**
     * Get integration configuration
     */
    getIntegrationConfig() {
        return this.config.integration || {};
    }

    /**
     * Get monitoring configuration
     */
    getMonitoringConfig() {
        return this.config.monitoring || {};
    }

    /**
     * Get development configuration
     */
    getDevelopmentConfig() {
        return this.config.development || {};
    }

    /**
     * Check if a component is enabled
     */
    isComponentEnabled(componentName) {
        const componentConfig = this.getComponentConfig(componentName);
        return componentConfig.enabled !== false;
    }

    /**
     * Get full configuration
     */
    getFullConfig() {
        return this.config;
    }

    /**
     * Reload configuration from file
     */
    reload() {
        this.config = this.loadConfiguration();
        return this.config;
    }

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        // Validate required components
        const requiredComponents = [
            'errorRecoveryManager',
            'stateCacheManager',
            'loopDetector',
            'enhancedGatekeeper',
            'commitHandler'
        ];

        for (const component of requiredComponents) {
            if (!this.config.components[component]) {
                errors.push(`Missing configuration for component: ${component}`);
            }
        }

        // Validate numeric values
        const numericValidations = [
            { path: 'components.errorRecoveryManager.maxRetries', min: 1, max: 10 },
            { path: 'components.stateCacheManager.lockTimeout', min: 1000, max: 300000 },
            { path: 'components.loopDetector.maxTransitions', min: 1, max: 20 }
        ];

        for (const validation of numericValidations) {
            const value = this.getNestedProperty(this.config, validation.path);
            if (typeof value !== 'number' || value < validation.min || value > validation.max) {
                errors.push(`Invalid value for ${validation.path}: must be between ${validation.min} and ${validation.max}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get nested property using dot notation
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }
}

module.exports = ConfigLoader;