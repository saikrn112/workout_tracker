// Secure configuration management with environment support
class ConfigManager {
    constructor() {
        this.config = {};
        this.environment = this.detectEnvironment();
        this.isInitialized = false;

        // Security-first approach - never expose credentials in code
        this.REQUIRED_ENV_VARS = [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_API_KEY'
        ];

        this.initialize();
    }

    detectEnvironment() {
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.')) {
            return 'development';
        } else if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    initialize() {
        try {
            dbg.info('Initializing ConfigManager', { environment: this.environment });

            // Base configuration
            this.config = this.getBaseConfig();

            // Try to load environment-specific config
            this.loadEnvironmentConfig();

            // Validate required configuration
            this.validateConfig();

            this.isInitialized = true;
            dbg.success('ConfigManager initialized successfully');

        } catch (error) {
            dbg.critical('Failed to initialize ConfigManager', { error: error.message });
            this.handleConfigError(error);
        }
    }

    getBaseConfig() {
        return {
            // App settings
            APP: {
                NAME: 'Workout Logger',
                VERSION: '2.1.0',
                MAX_HISTORY_DISPLAY: 10,
                AUTO_SAVE_INTERVAL: 30000,
                SYNC_RETRY_ATTEMPTS: 3,
                SYNC_RETRY_DELAY: 2000,
                OFFLINE_TIMEOUT: 5000
            },

            // Google Sheets API configuration (will be populated from environment)
            GOOGLE_SHEETS: {
                CLIENT_ID: null,
                API_KEY: null,
                DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
                SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
                INIT_TIMEOUT: 15000,
                RETRY_DELAY: 2000,
                MAX_RETRIES: 3
            },

            // Storage configuration
            STORAGE: {
                KEYS: {
                    WORKOUT_HISTORY: 'workoutHistory',
                    CUSTOM_TEMPLATES: 'customTemplates',
                    SYNC_STATUS: 'syncStatus',
                    CONFIG_CACHE: 'configCache',
                    DEBUG_SETTINGS: 'debugSettings'
                },
                ENCRYPTION_ENABLED: false // For future implementation
            },

            // Spreadsheet structure
            SPREADSHEET: {
                HEADERS: ['Date', 'Template', 'Exercise', 'Set', 'Weight', 'Reps', 'Notes'],
                SHEET_NAME: 'Workout Log',
                BATCH_SIZE: 100 // For bulk operations
            },

            // Debug and monitoring
            DEBUG: {
                ENABLED: this.environment === 'development',
                LOG_LEVEL: this.environment === 'development' ? 'DEBUG' : 'INFO',
                PERFORMANCE_MONITORING: true,
                ERROR_REPORTING: true
            },

            // Feature flags
            FEATURES: {
                OFFLINE_MODE: true,
                ANALYTICS: false,
                ADVANCED_CHARTS: true,
                EXPORT_FORMATS: ['csv', 'json'],
                BACKUP_SYNC: true
            }
        };
    }

    loadEnvironmentConfig() {
        // Try multiple sources for environment configuration
        const sources = [
            () => this.loadFromURLParams(),
            () => this.loadFromLocalStorage(),
            () => this.loadFromEnvironmentFile(),
            () => this.loadFromLegacyConfig()
        ];

        for (const source of sources) {
            try {
                const envConfig = source();
                if (envConfig && this.hasRequiredCredentials(envConfig)) {
                    this.mergeConfig(envConfig);
                    dbg.info('Environment config loaded', { source: source.name });
                    return;
                }
            } catch (error) {
                dbg.warn(`Failed to load config from ${source.name}`, { error: error.message });
            }
        }

        dbg.warn('No valid environment config found, using fallback');
    }

    loadFromURLParams() {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('client_id');
        const apiKey = params.get('api_key');

        if (clientId && apiKey) {
            return {
                GOOGLE_SHEETS: {
                    CLIENT_ID: clientId,
                    API_KEY: apiKey
                }
            };
        }
        return null;
    }

    loadFromLocalStorage() {
        const cached = localStorage.getItem(this.config.STORAGE.KEYS.CONFIG_CACHE);
        if (cached) {
            const config = JSON.parse(cached);
            // Validate cache is recent (within 24 hours)
            if (Date.now() - config.timestamp < 24 * 60 * 60 * 1000) {
                return config.data;
            }
        }
        return null;
    }

    loadFromEnvironmentFile() {
        // This would be populated by build process or server
        if (window.ENV_CONFIG) {
            return window.ENV_CONFIG;
        }
        return null;
    }

    loadFromLegacyConfig() {
        // Support for existing config.js file
        if (window.CONFIG && window.CONFIG.GOOGLE_SHEETS) {
            return {
                GOOGLE_SHEETS: {
                    CLIENT_ID: window.CONFIG.GOOGLE_SHEETS.CLIENT_ID,
                    API_KEY: window.CONFIG.GOOGLE_SHEETS.API_KEY
                }
            };
        }
        return null;
    }

    hasRequiredCredentials(config) {
        return config?.GOOGLE_SHEETS?.CLIENT_ID && config?.GOOGLE_SHEETS?.API_KEY;
    }

    mergeConfig(envConfig) {
        // Deep merge configuration
        this.config = this.deepMerge(this.config, envConfig);

        // Cache valid configuration
        if (this.hasRequiredCredentials(envConfig)) {
            this.cacheConfig(envConfig);
        }
    }

    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    cacheConfig(config) {
        try {
            const cacheData = {
                data: config,
                timestamp: Date.now(),
                environment: this.environment
            };
            localStorage.setItem(this.config.STORAGE.KEYS.CONFIG_CACHE, JSON.stringify(cacheData));
        } catch (error) {
            dbg.warn('Failed to cache config', { error: error.message });
        }
    }

    validateConfig() {
        const issues = [];

        // Check for required Google API credentials
        if (!this.config.GOOGLE_SHEETS.CLIENT_ID) {
            issues.push('Missing Google Client ID');
        }

        if (!this.config.GOOGLE_SHEETS.API_KEY) {
            issues.push('Missing Google API Key');
        }

        // Validate Client ID format
        if (this.config.GOOGLE_SHEETS.CLIENT_ID &&
            !this.config.GOOGLE_SHEETS.CLIENT_ID.includes('.apps.googleusercontent.com')) {
            issues.push('Invalid Google Client ID format');
        }

        // Validate API Key format
        if (this.config.GOOGLE_SHEETS.API_KEY &&
            !this.config.GOOGLE_SHEETS.API_KEY.startsWith('AIza')) {
            issues.push('Invalid Google API Key format');
        }

        if (issues.length > 0) {
            const error = new Error(`Configuration validation failed: ${issues.join(', ')}`);
            error.issues = issues;
            throw error;
        }

        dbg.success('Configuration validation passed');
    }

    handleConfigError(error) {
        const errorInfo = {
            message: error.message,
            issues: error.issues || [],
            environment: this.environment,
            hasLegacyConfig: !!window.CONFIG
        };

        // Store error info for debugging
        try {
            localStorage.setItem('config_error', JSON.stringify(errorInfo));
        } catch (e) {
            // Ignore storage errors
        }

        // Show user-friendly error based on environment
        if (this.environment === 'development') {
            this.showDevelopmentError(errorInfo);
        } else {
            this.showProductionError(errorInfo);
        }
    }

    showDevelopmentError(errorInfo) {
        const message = `
Configuration Error:
${errorInfo.issues.join('\n')}

Quick Fix:
1. Add to URL: ?client_id=YOUR_CLIENT_ID&api_key=YOUR_API_KEY
2. Or update js/config.js with valid credentials
3. Or set up environment configuration

Environment: ${errorInfo.environment}
        `.trim();

        console.error(message);
        alert(message);
    }

    showProductionError(errorInfo) {
        console.error('Configuration error in production', errorInfo);
        // In production, show generic message
        alert('App configuration error. Please contact support.');
    }

    // Configuration getters
    get(path) {
        return this.getNestedValue(this.config, path);
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    // Feature flag helpers
    isFeatureEnabled(feature) {
        return this.get(`FEATURES.${feature}`) === true;
    }

    // Environment helpers
    isDevelopment() {
        return this.environment === 'development';
    }

    isProduction() {
        return this.environment === 'production';
    }

    // Debug helpers
    isDebugEnabled() {
        return this.get('DEBUG.ENABLED') === true;
    }

    // Export configuration (without sensitive data)
    exportConfig() {
        const safeConfig = JSON.parse(JSON.stringify(this.config));

        // Remove sensitive information
        if (safeConfig.GOOGLE_SHEETS) {
            safeConfig.GOOGLE_SHEETS.CLIENT_ID = safeConfig.GOOGLE_SHEETS.CLIENT_ID ?
                safeConfig.GOOGLE_SHEETS.CLIENT_ID.substring(0, 10) + '...' : null;
            safeConfig.GOOGLE_SHEETS.API_KEY = safeConfig.GOOGLE_SHEETS.API_KEY ?
                'AIza...' : null;
        }

        return {
            environment: this.environment,
            isInitialized: this.isInitialized,
            config: safeConfig,
            timestamp: new Date().toISOString()
        };
    }

    // Update configuration at runtime
    updateConfig(path, value) {
        const keys = path.split('.');
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        dbg.info(`Configuration updated: ${path}`, { value });
    }

    // Reset configuration
    reset() {
        localStorage.removeItem(this.config.STORAGE.KEYS.CONFIG_CACHE);
        localStorage.removeItem('config_error');
        this.initialize();
    }
}

// Create global config manager instance
window.configManager = new ConfigManager();

// Global convenience getter
window.getConfig = (path) => window.configManager.get(path);