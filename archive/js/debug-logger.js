// Enhanced debugging and logging system for the Workout App
class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.isVerbose = this.getVerboseMode();

        // Error categories for better debugging
        this.ERROR_TYPES = {
            AUTH: 'AUTH',
            API: 'API',
            NETWORK: 'NETWORK',
            CONFIG: 'CONFIG',
            DATA: 'DATA',
            UI: 'UI'
        };

        // Initialize console overrides if in verbose mode
        if (this.isVerbose) {
            this.initConsoleOverrides();
        }

        this.info('DebugLogger initialized', { sessionId: this.sessionId });
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getVerboseMode() {
        // Check URL params, localStorage, or default to false
        const urlParams = new URLSearchParams(window.location.search);
        const urlVerbose = urlParams.get('debug') === 'true';
        const storageVerbose = localStorage.getItem('debug_verbose') === 'true';
        return urlVerbose || storageVerbose;
    }

    initConsoleOverrides() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        // Override console methods to capture all logs
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this.log('INFO', args.join(' '), { source: 'console' });
        };

        console.error = (...args) => {
            this.originalConsole.error(...args);
            this.log('ERROR', args.join(' '), { source: 'console' });
        };

        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this.log('WARN', args.join(' '), { source: 'console' });
        };
    }

    log(level, message, context = {}) {
        const logEntry = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            level: level.toUpperCase(),
            message,
            context,
            stack: this.getCallStack(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.logs.push(logEntry);

        // Trim logs if too many
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Output to console with formatting
        this.outputToConsole(logEntry);

        // Store critical errors
        if (level === 'ERROR' || level === 'CRITICAL') {
            this.storeCriticalError(logEntry);
        }

        return logEntry;
    }

    outputToConsole(logEntry) {
        const { timestamp, level, message, context } = logEntry;
        const timeStr = new Date(timestamp).toLocaleTimeString();
        const prefix = `[${timeStr}] [${level}]`;

        const styles = {
            ERROR: 'color: #ff4444; font-weight: bold',
            CRITICAL: 'color: #ff0000; font-weight: bold; background: #ffe6e6',
            WARN: 'color: #ff8800; font-weight: bold',
            INFO: 'color: #0066cc',
            SUCCESS: 'color: #00aa00; font-weight: bold',
            DEBUG: 'color: #666666'
        };

        if (this.isVerbose || ['ERROR', 'CRITICAL', 'WARN'].includes(level)) {
            console.log(`%c${prefix} ${message}`, styles[level] || '');
            if (Object.keys(context).length > 0) {
                console.log('Context:', context);
            }
        }
    }

    getCallStack() {
        const stack = new Error().stack;
        return stack ? stack.split('\n').slice(3, 8).join('\n') : 'No stack available';
    }

    storeCriticalError(logEntry) {
        try {
            const criticalErrors = JSON.parse(localStorage.getItem('critical_errors') || '[]');
            criticalErrors.push(logEntry);

            // Keep only last 50 critical errors
            if (criticalErrors.length > 50) {
                criticalErrors.splice(0, criticalErrors.length - 50);
            }

            localStorage.setItem('critical_errors', JSON.stringify(criticalErrors));
        } catch (e) {
            // Fallback if localStorage fails
            this.originalConsole?.error('Failed to store critical error:', e);
        }
    }

    // Convenience methods
    info(message, context = {}) {
        return this.log('INFO', message, context);
    }

    warn(message, context = {}) {
        return this.log('WARN', message, context);
    }

    error(message, context = {}) {
        return this.log('ERROR', message, context);
    }

    critical(message, context = {}) {
        return this.log('CRITICAL', message, context);
    }

    success(message, context = {}) {
        return this.log('SUCCESS', message, context);
    }

    debug(message, context = {}) {
        return this.log('DEBUG', message, context);
    }

    // Specialized error logging methods
    authError(message, error, context = {}) {
        return this.error(message, {
            ...context,
            type: this.ERROR_TYPES.AUTH,
            error: this.serializeError(error)
        });
    }

    apiError(message, error, context = {}) {
        return this.error(message, {
            ...context,
            type: this.ERROR_TYPES.API,
            error: this.serializeError(error)
        });
    }

    networkError(message, error, context = {}) {
        return this.error(message, {
            ...context,
            type: this.ERROR_TYPES.NETWORK,
            error: this.serializeError(error)
        });
    }

    configError(message, context = {}) {
        return this.error(message, {
            ...context,
            type: this.ERROR_TYPES.CONFIG
        });
    }

    serializeError(error) {
        if (!error) return null;

        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status,
            details: error.details || error.result
        };
    }

    // Performance monitoring
    startTimer(label) {
        const timer = {
            label,
            start: performance.now(),
            sessionId: this.sessionId
        };

        this.debug(`Timer started: ${label}`);
        return timer;
    }

    endTimer(timer) {
        const duration = performance.now() - timer.start;
        const message = `Timer ${timer.label}: ${duration.toFixed(2)}ms`;

        if (duration > 1000) {
            this.warn(message, { performance: true, duration });
        } else {
            this.debug(message, { performance: true, duration });
        }

        return duration;
    }

    // System diagnostics
    getSystemInfo() {
        return {
            sessionId: this.sessionId,
            sessionDuration: Date.now() - this.startTime,
            url: window.location.href,
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled,
            language: navigator.language,
            platform: navigator.platform,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            memory: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
            } : null
        };
    }

    // Export methods for debugging
    exportLogs(format = 'json') {
        const systemInfo = this.getSystemInfo();
        const exportData = {
            systemInfo,
            logs: this.logs,
            criticalErrors: this.getCriticalErrors(),
            exportTime: new Date().toISOString()
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            return this.logsToCSV(this.logs);
        }
    }

    logsToCSV(logs) {
        const headers = ['Timestamp', 'Level', 'Message', 'Type', 'Error', 'Context'];
        const rows = logs.map(log => [
            new Date(log.timestamp).toISOString(),
            log.level,
            log.message,
            log.context?.type || '',
            log.context?.error?.message || '',
            JSON.stringify(log.context)
        ]);

        return [headers, ...rows].map(row =>
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    getCriticalErrors() {
        try {
            return JSON.parse(localStorage.getItem('critical_errors') || '[]');
        } catch (e) {
            return [];
        }
    }

    clearLogs() {
        this.logs = [];
        localStorage.removeItem('critical_errors');
        this.info('Logs cleared');
    }

    // Debug utilities
    enableVerboseMode() {
        localStorage.setItem('debug_verbose', 'true');
        this.isVerbose = true;
        if (!this.originalConsole) {
            this.initConsoleOverrides();
        }
        this.info('Verbose mode enabled');
    }

    disableVerboseMode() {
        localStorage.setItem('debug_verbose', 'false');
        this.isVerbose = false;
        this.info('Verbose mode disabled');
    }

    // Create downloadable debug report
    generateDebugReport() {
        const report = this.exportLogs('json');
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `workout-app-debug-${this.sessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.info('Debug report generated', { filename: a.download });
    }
}

// Create global logger instance
window.debugLogger = new DebugLogger();

// Global convenience functions
window.dbg = {
    info: (msg, ctx) => window.debugLogger.info(msg, ctx),
    warn: (msg, ctx) => window.debugLogger.warn(msg, ctx),
    error: (msg, ctx) => window.debugLogger.error(msg, ctx),
    success: (msg, ctx) => window.debugLogger.success(msg, ctx),
    timer: (label) => window.debugLogger.startTimer(label),
    endTimer: (timer) => window.debugLogger.endTimer(timer),
    report: () => window.debugLogger.generateDebugReport(),
    verbose: () => window.debugLogger.enableVerboseMode(),
    quiet: () => window.debugLogger.disableVerboseMode(),
    clear: () => window.debugLogger.clearLogs()
};