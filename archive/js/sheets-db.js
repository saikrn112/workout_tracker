// SQL-like interface for Google Sheets as a database
class SheetsDB {
    constructor() {
        this.isInitialized = false;
        this.isAuthenticated = false;
        this.gapi = null;
        this.spreadsheetId = null;
        this.retryCount = 0;
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, error

        // Cache for better performance
        this.cache = {
            headers: null,
            data: null,
            lastFetch: null,
            ttl: 30000 // 30 seconds
        };

        // SQL-like operation tracking
        this.operationHistory = [];
        this.maxOperationHistory = 100;

        this.initializeEventually();
    }

    async initializeEventually() {
        // Initialize when config is ready
        if (window.configManager?.isInitialized) {
            await this.initialize();
        } else {
            // Wait for config manager
            setTimeout(() => this.initializeEventually(), 100);
        }
    }

    async initialize() {
        if (this.isInitialized) return true;

        const timer = dbg.timer('SheetsDB.initialize');

        try {
            dbg.info('Initializing SheetsDB...');
            this.connectionState = 'connecting';

            // Check configuration
            const clientId = getConfig('GOOGLE_SHEETS.CLIENT_ID');
            const apiKey = getConfig('GOOGLE_SHEETS.API_KEY');

            if (!clientId || !apiKey) {
                throw new Error('Google API credentials not configured');
            }

            // Load Google API
            await this.loadGoogleAPI();

            // Initialize GAPI with retry logic
            await this.initializeGAPI();

            this.isInitialized = true;
            this.connectionState = 'connected';

            dbg.success('SheetsDB initialized successfully');
            this.recordOperation('INIT', 'SUCCESS');

            return true;

        } catch (error) {
            this.connectionState = 'error';
            dbg.apiError('Failed to initialize SheetsDB', error);
            this.recordOperation('INIT', 'ERROR', { error: error.message });
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    async loadGoogleAPI() {
        if (window.gapi) {
            this.gapi = window.gapi;
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                this.gapi = window.gapi;
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load Google API'));
            document.head.appendChild(script);
        });
    }

    async initializeGAPI() {
        const timeout = getConfig('GOOGLE_SHEETS.INIT_TIMEOUT') || 15000;
        const maxRetries = getConfig('GOOGLE_SHEETS.MAX_RETRIES') || 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                dbg.info(`GAPI initialization attempt ${attempt}/${maxRetries}`);

                // Step 1: Load GAPI modules with better error handling
                await new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        dbg.error('GAPI load timeout', { timeout, attempt });
                        reject(new Error(`GAPI load timeout after ${timeout}ms`));
                    }, timeout);

                    // Add more detailed logging
                    dbg.info('Loading GAPI client:auth2 modules...');

                    this.gapi.load('client:auth2', {
                        callback: () => {
                            clearTimeout(timeoutId);
                            dbg.success('GAPI modules loaded successfully');
                            resolve();
                        },
                        onerror: (error) => {
                            clearTimeout(timeoutId);
                            dbg.error('GAPI load error', { error, attempt });
                            reject(new Error(`GAPI load failed: ${JSON.stringify(error)}`));
                        },
                        ontimeout: () => {
                            clearTimeout(timeoutId);
                            dbg.error('GAPI load ontimeout triggered', { attempt });
                            reject(new Error('GAPI load timeout callback triggered'));
                        }
                    });
                });

                // Small delay to ensure GAPI is fully ready
                await this.delay(500);

                // Step 2: Initialize client with better error context
                dbg.info('Initializing GAPI client with credentials...');

                const initConfig = {
                    apiKey: getConfig('GOOGLE_SHEETS.API_KEY'),
                    clientId: getConfig('GOOGLE_SHEETS.CLIENT_ID'),
                    discoveryDocs: [getConfig('GOOGLE_SHEETS.DISCOVERY_DOC')],
                    scope: getConfig('GOOGLE_SHEETS.SCOPES')
                };

                dbg.debug('Client init config', {
                    apiKey: initConfig.apiKey?.substring(0, 10) + '...',
                    clientId: initConfig.clientId?.substring(0, 20) + '...',
                    discoveryDocs: initConfig.discoveryDocs,
                    scope: initConfig.scope
                });

                await this.gapi.client.init(initConfig);

                // Step 3: Verify initialization
                if (!this.gapi.client.sheets) {
                    throw new Error('Sheets API not available after initialization');
                }

                if (!this.gapi.auth2) {
                    throw new Error('Auth2 API not available after initialization');
                }

                dbg.success('GAPI client initialized successfully');
                return;

            } catch (error) {
                const errorDetails = {
                    attempt,
                    maxRetries,
                    error: error.message,
                    gapiAvailable: !!window.gapi,
                    gapiClientAvailable: !!(window.gapi && window.gapi.client),
                    gapiAuth2Available: !!(window.gapi && window.gapi.auth2),
                    origin: window.location.origin,
                    userAgent: navigator.userAgent.substring(0, 100)
                };

                dbg.warn(`GAPI initialization attempt ${attempt} failed`, errorDetails);

                if (attempt === maxRetries) {
                    dbg.error('All GAPI initialization attempts failed', errorDetails);
                    throw new Error(`GAPI initialization failed after ${maxRetries} attempts: ${error.message}`);
                }

                // Exponential backoff with jitter
                const baseDelay = getConfig('GOOGLE_SHEETS.RETRY_DELAY') || 2000;
                const jitter = Math.random() * 1000;
                const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;

                dbg.info(`Retrying in ${delay.toFixed(0)}ms...`);
                await this.delay(delay);
            }
        }
    }

    // Authentication methods
    async authenticate() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const timer = dbg.timer('SheetsDB.authenticate');

        try {
            dbg.info('Authenticating with Google...');

            const authInstance = this.gapi.auth2.getAuthInstance();
            if (!authInstance) {
                throw new Error('Auth instance not available');
            }

            if (authInstance.isSignedIn.get()) {
                this.isAuthenticated = true;
                dbg.info('Already authenticated');
                await this.ensureSpreadsheet();
                return true;
            }

            const authResult = await authInstance.signIn({
                prompt: 'select_account'
            });

            if (authResult && authResult.isSignedIn()) {
                this.isAuthenticated = true;
                await this.ensureSpreadsheet();

                this.recordOperation('AUTH', 'SUCCESS');
                dbg.success('Authentication successful');
                return true;
            }

            throw new Error('Authentication failed');

        } catch (error) {
            this.recordOperation('AUTH', 'ERROR', { error: error.message });

            if (error.error === 'popup_closed_by_user') {
                dbg.warn('Authentication cancelled by user');
                throw new Error('Authentication cancelled');
            }

            dbg.authError('Authentication failed', error);
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    async signOut() {
        if (!this.isAuthenticated) return;

        try {
            const authInstance = this.gapi.auth2.getAuthInstance();
            await authInstance.signOut();

            this.isAuthenticated = false;
            this.spreadsheetId = null;
            this.clearCache();

            this.recordOperation('SIGNOUT', 'SUCCESS');
            dbg.info('Signed out successfully');

        } catch (error) {
            dbg.authError('Sign out failed', error);
        }
    }

    // Spreadsheet management
    async ensureSpreadsheet() {
        if (this.spreadsheetId) return this.spreadsheetId;

        try {
            // Try to find existing spreadsheet
            const existing = await this.findWorkoutSpreadsheet();
            if (existing) {
                this.spreadsheetId = existing;
                dbg.info('Found existing spreadsheet', { id: existing });
                return existing;
            }

            // Create new spreadsheet
            this.spreadsheetId = await this.createSpreadsheet();
            dbg.success('Created new spreadsheet', { id: this.spreadsheetId });
            return this.spreadsheetId;

        } catch (error) {
            dbg.apiError('Failed to ensure spreadsheet', error);
            throw error;
        }
    }

    async findWorkoutSpreadsheet() {
        const response = await this.gapi.client.drive.files.list({
            q: "name='Workout Log' and mimeType='application/vnd.google-apps.spreadsheet'",
            spaces: 'drive'
        });

        const files = response.result.files;
        return files && files.length > 0 ? files[0].id : null;
    }

    async createSpreadsheet() {
        const headers = getConfig('SPREADSHEET.HEADERS');
        const sheetName = getConfig('SPREADSHEET.SHEET_NAME');

        const response = await this.gapi.client.sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: 'Workout Log'
                },
                sheets: [{
                    properties: {
                        title: sheetName,
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: headers.length
                        }
                    }
                }]
            }
        });

        const spreadsheetId = response.result.spreadsheetId;

        // Add headers
        await this.addHeaders(spreadsheetId, headers);

        return spreadsheetId;
    }

    async addHeaders(spreadsheetId, headers) {
        const sheetName = getConfig('SPREADSHEET.SHEET_NAME');
        const range = `${sheetName}!A1:${this.columnNumberToLetter(headers.length)}1`;

        await this.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: { values: [headers] }
        });

        // Format headers
        await this.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: [{
                    repeatCell: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 0,
                            endRowIndex: 1
                        },
                        cell: {
                            userEnteredFormat: {
                                textFormat: { bold: true },
                                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                            }
                        },
                        fields: 'userEnteredFormat(textFormat,backgroundColor)'
                    }
                }]
            }
        });
    }

    // SQL-like interface methods
    async select(columns = '*', whereClause = null, orderBy = null, limit = null) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const timer = dbg.timer(`SheetsDB.select`);

        try {
            const data = await this.getAllData();
            let result = [...data];

            // Apply WHERE clause
            if (whereClause) {
                result = this.applyWhereClause(result, whereClause);
            }

            // Apply ORDER BY
            if (orderBy) {
                result = this.applyOrderBy(result, orderBy);
            }

            // Apply LIMIT
            if (limit) {
                result = result.slice(0, limit);
            }

            // Select specific columns
            if (columns !== '*') {
                result = this.selectColumns(result, columns);
            }

            this.recordOperation('SELECT', 'SUCCESS', {
                rowCount: result.length,
                columns,
                whereClause,
                orderBy,
                limit
            });

            dbg.info(`SELECT completed: ${result.length} rows`, { columns, whereClause });
            return result;

        } catch (error) {
            this.recordOperation('SELECT', 'ERROR', { error: error.message });
            dbg.apiError('SELECT operation failed', error);
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    async insert(data) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const timer = dbg.timer('SheetsDB.insert');

        try {
            const rows = Array.isArray(data) ? data : [data];
            const sheetName = getConfig('SPREADSHEET.SHEET_NAME');

            // Convert objects to arrays if necessary
            const rowArrays = rows.map(row => this.objectToArray(row));

            // Get next available row
            const currentData = await this.getAllData();
            const nextRow = currentData.length + 2; // +1 for header, +1 for next row

            const range = `${sheetName}!A${nextRow}`;

            await this.gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: { values: rowArrays }
            });

            // Clear cache since data changed
            this.clearCache();

            this.recordOperation('INSERT', 'SUCCESS', { rowCount: rows.length });
            dbg.success(`INSERT completed: ${rows.length} rows`);

            return rows.length;

        } catch (error) {
            this.recordOperation('INSERT', 'ERROR', { error: error.message });
            dbg.apiError('INSERT operation failed', error);
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    async update(setClause, whereClause) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const timer = dbg.timer('SheetsDB.update');

        try {
            // This is complex with Google Sheets API - for now, we'll do a full rewrite
            // In a real implementation, you'd want to optimize this
            const data = await this.getAllData();
            const updatedData = data.map(row => {
                if (this.matchesWhereClause(row, whereClause)) {
                    return { ...row, ...setClause };
                }
                return row;
            });

            // Clear the sheet and rewrite (inefficient but works)
            await this.clearSheet();
            await this.writeAllData(updatedData);

            this.recordOperation('UPDATE', 'SUCCESS', { setClause, whereClause });
            dbg.success('UPDATE completed');

            return updatedData.length;

        } catch (error) {
            this.recordOperation('UPDATE', 'ERROR', { error: error.message });
            dbg.apiError('UPDATE operation failed', error);
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    async delete(whereClause) {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const timer = dbg.timer('SheetsDB.delete');

        try {
            const data = await this.getAllData();
            const filteredData = data.filter(row => !this.matchesWhereClause(row, whereClause));

            await this.clearSheet();
            if (filteredData.length > 0) {
                await this.writeAllData(filteredData);
            }

            const deletedCount = data.length - filteredData.length;

            this.recordOperation('DELETE', 'SUCCESS', { deletedCount, whereClause });
            dbg.success(`DELETE completed: ${deletedCount} rows deleted`);

            return deletedCount;

        } catch (error) {
            this.recordOperation('DELETE', 'ERROR', { error: error.message });
            dbg.apiError('DELETE operation failed', error);
            throw error;
        } finally {
            dbg.endTimer(timer);
        }
    }

    // Helper methods for SQL-like operations
    async getAllData() {
        // Check cache first
        if (this.cache.data && this.cache.lastFetch &&
            Date.now() - this.cache.lastFetch < this.cache.ttl) {
            return this.cache.data;
        }

        const sheetName = getConfig('SPREADSHEET.SHEET_NAME');
        const response = await this.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A:Z`
        });

        const values = response.result.values || [];

        if (values.length === 0) {
            this.cache.data = [];
        } else {
            const headers = values[0];
            const dataRows = values.slice(1);

            this.cache.headers = headers;
            this.cache.data = dataRows.map(row => this.arrayToObject(row, headers));
        }

        this.cache.lastFetch = Date.now();
        return this.cache.data;
    }

    applyWhereClause(data, whereClause) {
        return data.filter(row => this.matchesWhereClause(row, whereClause));
    }

    matchesWhereClause(row, whereClause) {
        // Simple WHERE clause implementation
        // Format: { column: value } or { column: { operator: value } }

        for (const [column, condition] of Object.entries(whereClause)) {
            const rowValue = row[column];

            if (typeof condition === 'object' && condition !== null) {
                // Complex condition with operator
                const { operator, value } = condition;

                switch (operator) {
                    case '>':
                        if (!(rowValue > value)) return false;
                        break;
                    case '>=':
                        if (!(rowValue >= value)) return false;
                        break;
                    case '<':
                        if (!(rowValue < value)) return false;
                        break;
                    case '<=':
                        if (!(rowValue <= value)) return false;
                        break;
                    case '!=':
                        if (rowValue === value) return false;
                        break;
                    case 'contains':
                        if (!String(rowValue).includes(value)) return false;
                        break;
                    case 'startsWith':
                        if (!String(rowValue).startsWith(value)) return false;
                        break;
                    default:
                        if (rowValue !== value) return false;
                }
            } else {
                // Simple equality check
                if (rowValue !== condition) return false;
            }
        }

        return true;
    }

    applyOrderBy(data, orderBy) {
        // Format: 'column' or 'column DESC' or { column: 'DESC' }
        let column, direction = 'ASC';

        if (typeof orderBy === 'string') {
            const parts = orderBy.split(' ');
            column = parts[0];
            direction = parts[1] || 'ASC';
        } else {
            column = Object.keys(orderBy)[0];
            direction = orderBy[column];
        }

        return [...data].sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];

            let comparison = 0;
            if (aVal > bVal) comparison = 1;
            if (aVal < bVal) comparison = -1;

            return direction === 'DESC' ? -comparison : comparison;
        });
    }

    selectColumns(data, columns) {
        const columnList = Array.isArray(columns) ? columns : [columns];
        return data.map(row => {
            const selectedRow = {};
            columnList.forEach(col => {
                selectedRow[col] = row[col];
            });
            return selectedRow;
        });
    }

    objectToArray(obj) {
        const headers = this.cache.headers || getConfig('SPREADSHEET.HEADERS');
        return headers.map(header => obj[header] || '');
    }

    arrayToObject(array, headers) {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = array[index] || '';
        });
        return obj;
    }

    async clearSheet() {
        const sheetName = getConfig('SPREADSHEET.SHEET_NAME');
        await this.gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A2:Z`
        });
        this.clearCache();
    }

    async writeAllData(data) {
        const sheetName = getConfig('SPREADSHEET.SHEET_NAME');
        const headers = this.cache.headers || getConfig('SPREADSHEET.HEADERS');
        const rows = data.map(row => this.objectToArray(row));

        if (rows.length > 0) {
            await this.gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A2`,
                valueInputOption: 'RAW',
                resource: { values: rows }
            });
        }

        this.clearCache();
    }

    // Utility methods
    columnNumberToLetter(columnNumber) {
        let temp;
        let letter = '';
        while (columnNumber > 0) {
            temp = (columnNumber - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            columnNumber = (columnNumber - temp - 1) / 26;
        }
        return letter;
    }

    clearCache() {
        this.cache.data = null;
        this.cache.lastFetch = null;
    }

    recordOperation(operation, status, details = {}) {
        const record = {
            timestamp: Date.now(),
            operation,
            status,
            details
        };

        this.operationHistory.push(record);

        if (this.operationHistory.length > this.maxOperationHistory) {
            this.operationHistory = this.operationHistory.slice(-this.maxOperationHistory);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public getters
    getConnectionState() {
        return this.connectionState;
    }

    getSpreadsheetId() {
        return this.spreadsheetId;
    }

    getOperationHistory() {
        return [...this.operationHistory];
    }

    // Export methods for debugging
    exportDiagnostics() {
        return {
            isInitialized: this.isInitialized,
            isAuthenticated: this.isAuthenticated,
            connectionState: this.connectionState,
            spreadsheetId: this.spreadsheetId,
            cacheStatus: {
                hasData: !!this.cache.data,
                lastFetch: this.cache.lastFetch,
                rowCount: this.cache.data?.length || 0
            },
            operationHistory: this.operationHistory,
            config: configManager.exportConfig()
        };
    }
}

// Create global instance
window.sheetsDB = new SheetsDB();