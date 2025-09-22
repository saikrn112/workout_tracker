// Comprehensive testing and diagnostics framework for the Workout App
class TestSuite {
    constructor() {
        this.tests = [];
        this.results = {};
        this.isRunning = false;
        this.currentTest = null;

        // Test categories
        this.categories = {
            CONFIG: 'Configuration',
            AUTH: 'Authentication',
            API: 'API Connectivity',
            DATABASE: 'Database Operations',
            UI: 'User Interface',
            PERFORMANCE: 'Performance',
            INTEGRATION: 'Integration'
        };

        this.setupTests();
    }

    setupTests() {
        // Configuration tests
        this.addTest('config-manager-init', this.categories.CONFIG, 'Configuration Manager Initialization', async () => {
            if (!window.configManager) {
                throw new Error('ConfigManager not found');
            }

            if (!configManager.isInitialized) {
                throw new Error('ConfigManager not initialized');
            }

            const clientId = getConfig('GOOGLE_SHEETS.CLIENT_ID');
            const apiKey = getConfig('GOOGLE_SHEETS.API_KEY');

            if (!clientId) {
                throw new Error('Google Client ID not configured');
            }

            if (!apiKey) {
                throw new Error('Google API Key not configured');
            }

            if (!clientId.includes('.apps.googleusercontent.com')) {
                throw new Error('Invalid Client ID format');
            }

            if (!apiKey.startsWith('AIza')) {
                throw new Error('Invalid API Key format');
            }

            return { clientId: clientId.substring(0, 20) + '...', apiKey: 'AIza...' };
        });

        this.addTest('environment-detection', this.categories.CONFIG, 'Environment Detection', async () => {
            const env = configManager.environment;
            const isDev = configManager.isDevelopment();
            const isProd = configManager.isProduction();

            if (!['development', 'staging', 'production'].includes(env)) {
                throw new Error(`Invalid environment: ${env}`);
            }

            return { environment: env, isDevelopment: isDev, isProduction: isProd };
        });

        // Database tests
        this.addTest('sheets-db-init', this.categories.DATABASE, 'SheetsDB Initialization', async () => {
            if (!window.sheetsDB) {
                throw new Error('SheetsDB not found');
            }

            const connectionState = sheetsDB.getConnectionState();

            if (connectionState === 'error') {
                throw new Error('SheetsDB in error state');
            }

            return { connectionState, isInitialized: sheetsDB.isInitialized };
        });

        this.addTest('google-api-load', this.categories.API, 'Google API Script Loading', async () => {
            // Force reload if needed
            if (!window.gapi) {
                await sheetsDB.loadGoogleAPI();
            }

            if (!window.gapi) {
                throw new Error('Google API not loaded');
            }

            return { gapiLoaded: true, version: gapi.version || 'unknown' };
        });

        this.addTest('gapi-client-init', this.categories.API, 'GAPI Client Initialization', async () => {
            if (!sheetsDB.isInitialized) {
                await sheetsDB.initialize();
            }

            if (!sheetsDB.isInitialized) {
                throw new Error('SheetsDB initialization failed');
            }

            return { gapiInitialized: true };
        });

        this.addTest('authentication-test', this.categories.AUTH, 'Google Authentication', async () => {
            if (!sheetsDB.isAuthenticated) {
                throw new Error('Not authenticated - this is expected on first run');
            }

            const authInstance = gapi.auth2.getAuthInstance();
            if (!authInstance) {
                throw new Error('Auth instance not available');
            }

            const isSignedIn = authInstance.isSignedIn.get();
            const user = authInstance.currentUser.get();
            const profile = user.getBasicProfile();

            return {
                isSignedIn,
                email: profile.getEmail(),
                name: profile.getName()
            };
        });

        this.addTest('spreadsheet-access', this.categories.DATABASE, 'Spreadsheet Access', async () => {
            if (!sheetsDB.isAuthenticated) {
                throw new Error('Authentication required');
            }

            const spreadsheetId = sheetsDB.getSpreadsheetId();

            if (!spreadsheetId) {
                throw new Error('No spreadsheet ID available');
            }

            // Try to read data
            const data = await sheetsDB.select('*', null, null, 5);

            return {
                spreadsheetId: spreadsheetId.substring(0, 20) + '...',
                rowCount: data.length,
                hasData: data.length > 0
            };
        });

        this.addTest('database-operations', this.categories.DATABASE, 'Database CRUD Operations', async () => {
            if (!sheetsDB.isAuthenticated) {
                throw new Error('Authentication required');
            }

            const testData = {
                Date: new Date().toLocaleDateString(),
                Template: 'Test Template',
                Exercise: 'Test Exercise',
                Set: '1',
                Weight: '100',
                Reps: '10',
                Notes: 'Test entry'
            };

            // Test INSERT
            const insertResult = await sheetsDB.insert(testData);

            // Test SELECT
            const selectResult = await sheetsDB.select('*', { Exercise: 'Test Exercise' }, null, 1);

            if (selectResult.length === 0) {
                throw new Error('INSERT or SELECT failed');
            }

            // Test DELETE (cleanup)
            const deleteResult = await sheetsDB.delete({ Exercise: 'Test Exercise' });

            return {
                insertCount: insertResult,
                selectCount: selectResult.length,
                deleteCount: deleteResult
            };
        });

        this.addTest('performance-test', this.categories.PERFORMANCE, 'Performance Benchmarks', async () => {
            const results = {};

            // Test API initialization time
            const initTimer = dbg.timer('init-performance');
            await sheetsDB.initialize();
            results.initTime = dbg.endTimer(initTimer);

            // Test data retrieval time
            if (sheetsDB.isAuthenticated) {
                const selectTimer = dbg.timer('select-performance');
                await sheetsDB.select('*', null, null, 10);
                results.selectTime = dbg.endTimer(selectTimer);
            }

            // Test memory usage
            if (performance.memory) {
                results.memoryUsage = {
                    used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                    total: Math.round(performance.memory.totalJSHeapSize / 1048576)
                };
            }

            return results;
        });

        this.addTest('network-connectivity', this.categories.API, 'Network Connectivity', async () => {
            const isOnline = navigator.onLine;

            if (!isOnline) {
                throw new Error('Browser reports offline status');
            }

            // Test Google API endpoint
            try {
                const response = await fetch('https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest', {
                    method: 'HEAD',
                    mode: 'no-cors'
                });

                return { online: true, googleApiAccessible: true };
            } catch (error) {
                return { online: true, googleApiAccessible: false, error: error.message };
            }
        });

        this.addTest('browser-compatibility', this.categories.UI, 'Browser Compatibility', async () => {
            const features = {
                fetch: typeof fetch !== 'undefined',
                promises: typeof Promise !== 'undefined',
                arrow_functions: (() => true)() === true,
                classes: typeof class {} === 'function',
                localStorage: typeof localStorage !== 'undefined',
                serviceWorker: 'serviceWorker' in navigator,
                es6Modules: typeof Symbol !== 'undefined'
            };

            const unsupported = Object.entries(features)
                .filter(([feature, supported]) => !supported)
                .map(([feature]) => feature);

            if (unsupported.length > 0) {
                throw new Error(`Unsupported features: ${unsupported.join(', ')}`);
            }

            return features;
        });

        this.addTest('debug-system', this.categories.CONFIG, 'Debug System Functionality', async () => {
            if (!window.debugLogger) {
                throw new Error('Debug logger not found');
            }

            if (!window.dbg) {
                throw new Error('Debug shortcuts not available');
            }

            // Test logging
            const testMessage = 'Test log message';
            dbg.info(testMessage);

            const logs = debugLogger.logs;
            const hasTestLog = logs.some(log => log.message === testMessage);

            if (!hasTestLog) {
                throw new Error('Debug logging not working');
            }

            return {
                loggerAvailable: true,
                logCount: logs.length,
                sessionId: debugLogger.sessionId
            };
        });
    }

    addTest(id, category, name, testFunction) {
        this.tests.push({
            id,
            category,
            name,
            testFunction,
            status: 'pending', // pending, running, passed, failed, skipped
            result: null,
            error: null,
            duration: null
        });
    }

    async runAllTests() {
        if (this.isRunning) {
            throw new Error('Tests already running');
        }

        this.isRunning = true;
        this.results = {
            startTime: Date.now(),
            endTime: null,
            duration: null,
            passed: 0,
            failed: 0,
            skipped: 0,
            total: this.tests.length
        };

        dbg.info('Starting test suite execution', { testCount: this.tests.length });

        try {
            for (const test of this.tests) {
                await this.runTest(test);
            }
        } finally {
            this.results.endTime = Date.now();
            this.results.duration = this.results.endTime - this.results.startTime;
            this.isRunning = false;

            dbg.info('Test suite completed', this.results);
        }

        return this.getResults();
    }

    async runTest(test) {
        this.currentTest = test;
        test.status = 'running';

        const timer = dbg.timer(`test-${test.id}`);

        try {
            dbg.debug(`Running test: ${test.name}`);

            test.result = await test.testFunction();
            test.status = 'passed';
            test.error = null;

            this.results.passed++;
            dbg.success(`Test passed: ${test.name}`);

        } catch (error) {
            test.status = 'failed';
            test.error = {
                message: error.message,
                stack: error.stack
            };
            test.result = null;

            this.results.failed++;
            dbg.error(`Test failed: ${test.name}`, { error: error.message });

        } finally {
            test.duration = dbg.endTimer(timer);
            this.currentTest = null;
        }
    }

    async runTestById(testId) {
        const test = this.tests.find(t => t.id === testId);
        if (!test) {
            throw new Error(`Test not found: ${testId}`);
        }

        await this.runTest(test);
        return test;
    }

    async runTestsByCategory(category) {
        const categoryTests = this.tests.filter(t => t.category === category);

        for (const test of categoryTests) {
            await this.runTest(test);
        }

        return categoryTests;
    }

    getResults() {
        return {
            summary: this.results,
            tests: this.tests.map(test => ({
                id: test.id,
                category: test.category,
                name: test.name,
                status: test.status,
                result: test.result,
                error: test.error,
                duration: test.duration
            })),
            categories: this.getResultsByCategory()
        };
    }

    getResultsByCategory() {
        const byCategory = {};

        Object.values(this.categories).forEach(category => {
            byCategory[category] = {
                total: 0,
                passed: 0,
                failed: 0,
                pending: 0
            };
        });

        this.tests.forEach(test => {
            const category = test.category;
            byCategory[category].total++;

            switch (test.status) {
                case 'passed':
                    byCategory[category].passed++;
                    break;
                case 'failed':
                    byCategory[category].failed++;
                    break;
                default:
                    byCategory[category].pending++;
            }
        });

        return byCategory;
    }

    // Quick diagnostic methods
    async quickDiagnostic() {
        dbg.info('Running quick diagnostic...');

        const essentialTests = [
            'config-manager-init',
            'sheets-db-init',
            'network-connectivity',
            'browser-compatibility'
        ];

        const results = [];

        for (const testId of essentialTests) {
            try {
                const test = await this.runTestById(testId);
                results.push({
                    name: test.name,
                    status: test.status,
                    error: test.error?.message
                });
            } catch (error) {
                results.push({
                    name: testId,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }

    // Generate test report
    generateReport(format = 'html') {
        const results = this.getResults();

        if (format === 'html') {
            return this.generateHTMLReport(results);
        } else if (format === 'json') {
            return JSON.stringify(results, null, 2);
        } else if (format === 'text') {
            return this.generateTextReport(results);
        }
    }

    generateHTMLReport(results) {
        const { summary, tests, categories } = results;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Workout App Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .category { margin-bottom: 20px; }
        .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .passed { border-left-color: #28a745; background: #d4edda; }
        .failed { border-left-color: #dc3545; background: #f8d7da; }
        .pending { border-left-color: #ffc107; background: #fff3cd; }
        .error { color: #721c24; margin-top: 5px; font-family: monospace; font-size: 12px; }
        .result { margin-top: 5px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>
    <h1>Workout App Test Report</h1>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> ${summary.total}</p>
        <p><strong>Passed:</strong> ${summary.passed}</p>
        <p><strong>Failed:</strong> ${summary.failed}</p>
        <p><strong>Duration:</strong> ${summary.duration}ms</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>

    ${Object.entries(categories).map(([category, stats]) => `
        <div class="category">
            <h2>${category} (${stats.passed}/${stats.total} passed)</h2>
            ${tests.filter(t => t.category === category).map(test => `
                <div class="test ${test.status}">
                    <strong>${test.name}</strong> - ${test.status}
                    ${test.duration ? `<span style="float: right;">${test.duration}ms</span>` : ''}
                    ${test.error ? `<div class="error">Error: ${test.error.message}</div>` : ''}
                    ${test.result ? `<div class="result">Result: ${JSON.stringify(test.result, null, 2)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;

        return html;
    }

    generateTextReport(results) {
        const { summary, tests } = results;

        let report = `WORKOUT APP TEST REPORT\n`;
        report += `========================\n\n`;
        report += `Summary:\n`;
        report += `  Total: ${summary.total}\n`;
        report += `  Passed: ${summary.passed}\n`;
        report += `  Failed: ${summary.failed}\n`;
        report += `  Duration: ${summary.duration}ms\n\n`;

        Object.values(this.categories).forEach(category => {
            const categoryTests = tests.filter(t => t.category === category);
            if (categoryTests.length > 0) {
                report += `${category}:\n`;
                categoryTests.forEach(test => {
                    const status = test.status.toUpperCase().padEnd(7);
                    report += `  [${status}] ${test.name}`;
                    if (test.duration) report += ` (${test.duration}ms)`;
                    report += `\n`;
                    if (test.error) {
                        report += `            Error: ${test.error.message}\n`;
                    }
                });
                report += `\n`;
            }
        });

        return report;
    }

    // Download report
    downloadReport(format = 'html') {
        const report = this.generateReport(format);
        const mimeTypes = {
            html: 'text/html',
            json: 'application/json',
            text: 'text/plain'
        };

        const blob = new Blob([report], { type: mimeTypes[format] });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `workout-app-test-report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        dbg.info('Test report downloaded', { format, filename: a.download });
    }

    // Reset all tests
    reset() {
        this.tests.forEach(test => {
            test.status = 'pending';
            test.result = null;
            test.error = null;
            test.duration = null;
        });

        this.results = {};
        this.isRunning = false;
        this.currentTest = null;

        dbg.info('Test suite reset');
    }
}

// Create global test suite instance
window.testSuite = new TestSuite();

// Global convenience functions
window.runTests = () => window.testSuite.runAllTests();
window.quickTest = () => window.testSuite.quickDiagnostic();
window.testReport = (format) => window.testSuite.downloadReport(format);