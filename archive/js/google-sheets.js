// Google Sheets API integration for the Workout Logger app
class GoogleSheetsManager {
    constructor() {
        this.isInitialized = false;
        this.isSignedIn = false;
        this.gapi = null;
        this.spreadsheetId = null;
        this.retryCount = 0;
        this.maxRetries = CONFIG.APP.SYNC_RETRY_ATTEMPTS;
        this.initPromise = null; // Prevent multiple initialization attempts
    }

    // Initialize Google API
    async init() {
        // Prevent multiple simultaneous initialization attempts
        if (this.initPromise) {
            return await this.initPromise;
        }
        
        if (this.isInitialized) return true;

        this.initPromise = this._performInit();
        const result = await this.initPromise;
        this.initPromise = null;
        return result;
    }

    async _performInit() {
        try {
            console.log('Initializing Google Sheets API...');
            
            // Check if API credentials are configured
            if (!CONFIG.GOOGLE_SHEETS.CLIENT_ID || !CONFIG.GOOGLE_SHEETS.API_KEY) {
                console.warn('Google Sheets API credentials not configured');
                return false;
            }

            // Load Google API script
            await this.loadGoogleAPI();
            
            // Wait a bit for the script to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Initialize gapi client and auth
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Google API initialization timeout'));
                }, 10000); // 10 second timeout
                
                gapi.load('client:auth2', {
                    callback: () => {
                        clearTimeout(timeout);
                        resolve();
                    },
                    onerror: (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
            });

            // Initialize the API client
            await gapi.client.init({
                apiKey: CONFIG.GOOGLE_SHEETS.API_KEY,
                clientId: CONFIG.GOOGLE_SHEETS.CLIENT_ID,
                discoveryDocs: [CONFIG.GOOGLE_SHEETS.DISCOVERY_DOC],
                scope: CONFIG.GOOGLE_SHEETS.SCOPES
            });

            this.gapi = gapi;
            this.isInitialized = true;
            
            // Check if user is already signed in
            const authInstance = gapi.auth2.getAuthInstance();
            if (authInstance) {
                this.isSignedIn = authInstance.isSignedIn.get();
                
                if (this.isSignedIn) {
                    await this.loadUserSpreadsheet();
                }
            }

            this.updateSyncButton();
            return true;
        } catch (error) {
            console.error('Error initializing Google Sheets API:', error);
            this.showError('Failed to initialize Google Sheets integration. Please check your internet connection.');
            return false;
        }
    }

    // Load Google API script
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Sign in to Google
    async signIn() {
        try {
            console.log('Attempting to sign in to Google...');
            
            if (!this.isInitialized) {
                const initialized = await this.init();
                if (!initialized) {
                    this.showError('Failed to initialize Google API. Please check your credentials.');
                    return false;
                }
            }

            const authInstance = this.gapi.auth2.getAuthInstance();
            if (!authInstance) {
                throw new Error('Google Auth instance not available');
            }
            
            // Show loading
            workoutManager.showLoadingOverlay('Connecting to Google...');
            
            const authResult = await authInstance.signIn({
                prompt: 'select_account'
            });
            
            if (authResult && authResult.isSignedIn()) {
                this.isSignedIn = true;
                await this.loadUserSpreadsheet();
                
                storageManager.updateSyncStatus({
                    isConnected: true,
                    error: null
                });
                
                this.updateSyncButton();
                workoutManager.hideLoadingOverlay();
                this.showSuccess('Connected to Google Sheets successfully!');
                
                // Sync pending changes
                setTimeout(() => {
                    this.syncAllData();
                }, 1000);
                
                return true;
            } else {
                throw new Error('Sign in was not successful');
            }
        } catch (error) {
            console.error('Error signing in:', error);
            workoutManager.hideLoadingOverlay();
            
            if (error.error === 'popup_closed_by_user') {
                this.showError('Sign in was cancelled. Please try again.');
            } else {
                this.showError('Failed to sign in to Google. Please check your internet connection and try again.');
            }
            
            return false;
        }
    }

    // Sign out from Google
    async signOut() {
        if (!this.isInitialized) return;

        try {
            const authInstance = this.gapi.auth2.getAuthInstance();
            await authInstance.signOut();
            
            this.isSignedIn = false;
            this.spreadsheetId = null;
            
            storageManager.updateSyncStatus({
                isConnected: false,
                lastSync: null,
                error: null
            });
            
            this.updateSyncButton();
            this.showSuccess('Disconnected from Google Sheets');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }

    // Load or create user's workout spreadsheet
    async loadUserSpreadsheet() {
        try {
            // First, try to find existing workout spreadsheet
            const response = await this.gapi.client.drive.files.list({
                q: "name='Workout Log' and mimeType='application/vnd.google-apps.spreadsheet'",
                spaces: 'drive'
            });

            if (response.result.files && response.result.files.length > 0) {
                // Use existing spreadsheet
                this.spreadsheetId = response.result.files[0].id;
                console.log('Found existing workout spreadsheet:', this.spreadsheetId);
            } else {
                // Create new spreadsheet
                await this.createWorkoutSpreadsheet();
            }

            return true;
        } catch (error) {
            console.error('Error loading spreadsheet:', error);
            
            // Fallback: try to create new spreadsheet
            try {
                await this.createWorkoutSpreadsheet();
                return true;
            } catch (createError) {
                console.error('Error creating spreadsheet:', createError);
                this.showError('Failed to access Google Sheets. Please check permissions.');
                return false;
            }
        }
    }

    // Create new workout spreadsheet
    async createWorkoutSpreadsheet() {
        const spreadsheetBody = {
            properties: {
                title: 'Workout Log'
            },
            sheets: [{
                properties: {
                    title: CONFIG.SPREADSHEET.SHEET_NAME
                }
            }]
        };

        const response = await this.gapi.client.sheets.spreadsheets.create({
            resource: spreadsheetBody
        });

        this.spreadsheetId = response.result.spreadsheetId;
        console.log('Created new workout spreadsheet:', this.spreadsheetId);

        // Add headers
        await this.addHeaders();
        
        this.showSuccess('Created new Workout Log spreadsheet in your Google Drive!');
    }

    // Add headers to spreadsheet
    async addHeaders() {
        const range = `${CONFIG.SPREADSHEET.SHEET_NAME}!A1:F1`;
        const values = [CONFIG.SPREADSHEET.HEADERS];

        await this.gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: { values: values }
        });

        // Format headers
        await this.gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
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

    // Add workout to spreadsheet
    async addWorkoutToSheet(workoutData) {
        if (!this.isSignedIn || !this.spreadsheetId) {
            throw new Error('Not connected to Google Sheets');
        }

        try {
            const rows = this.convertWorkoutToRows(workoutData);
            
            // Get current data to find next row
            const response = await this.gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${CONFIG.SPREADSHEET.SHEET_NAME}!A:A`
            });

            const nextRow = (response.result.values?.length || 0) + 1;
            const range = `${CONFIG.SPREADSHEET.SHEET_NAME}!A${nextRow}`;

            await this.gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: { values: rows }
            });

            console.log('Workout synced to Google Sheets successfully');
            return true;
        } catch (error) {
            console.error('Error adding workout to sheet:', error);
            throw error;
        }
    }

    // Convert workout data to spreadsheet rows
    convertWorkoutToRows(workoutData) {
        const rows = [];
        const date = new Date(workoutData.date).toLocaleDateString();

        Object.entries(workoutData.exercises).forEach(([exercise, sets]) => {
            sets.forEach((set, index) => {
                rows.push([
                    date,
                    workoutData.template,
                    exercise,
                    index + 1,
                    set.weight || '',
                    set.reps || ''
                ]);
            });
        });

        return rows;
    }

    // Sync all pending data
    async syncAllData() {
        if (!this.isSignedIn) return false;

        try {
            workoutManager.showLoadingOverlay('Syncing all data...');
            
            const workoutHistory = storageManager.getWorkoutHistory();
            const syncStatus = storageManager.getSyncStatus();
            
            // Get existing data from sheet to avoid duplicates
            const existingData = await this.getExistingData();
            const existingWorkouts = new Set();
            
            existingData.forEach(row => {
                if (row.length >= 3) {
                    const key = `${row[0]}_${row[1]}_${row[2]}`; // date_template_exercise
                    existingWorkouts.add(key);
                }
            });

            let syncedCount = 0;
            
            for (const workout of workoutHistory) {
                const workoutKey = `${new Date(workout.date).toLocaleDateString()}_${workout.template}`;
                let hasNewData = false;
                
                // Check if this workout has any new exercises
                Object.keys(workout.exercises).forEach(exercise => {
                    const key = `${new Date(workout.date).toLocaleDateString()}_${workout.template}_${exercise}`;
                    if (!existingWorkouts.has(key)) {
                        hasNewData = true;
                    }
                });
                
                if (hasNewData) {
                    await this.addWorkoutToSheet(workout);
                    syncedCount++;
                }
            }

            storageManager.updateSyncStatus({
                lastSync: new Date().toISOString(),
                pendingChanges: 0,
                error: null
            });

            workoutManager.hideLoadingOverlay();
            
            if (syncedCount > 0) {
                this.showSuccess(`Synced ${syncedCount} workouts to Google Sheets!`);
            } else {
                this.showSuccess('All data is up to date!');
            }
            
            return true;
        } catch (error) {
            console.error('Error syncing all data:', error);
            workoutManager.hideLoadingOverlay();
            this.showError('Failed to sync data. Please try again.');
            
            storageManager.updateSyncStatus({
                error: error.message
            });
            
            return false;
        }
    }

    // Get existing data from spreadsheet
    async getExistingData() {
        try {
            const response = await this.gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${CONFIG.SPREADSHEET.SHEET_NAME}!A2:F` // Skip header row
            });

            return response.result.values || [];
        } catch (error) {
            console.error('Error getting existing data:', error);
            return [];
        }
    }

    // Update sync button appearance
    updateSyncButton() {
        const syncBtn = document.getElementById('googleSyncBtn');
        const statusBtn = document.getElementById('syncStatusBtn');
        
        if (!syncBtn) return;

        if (this.isSignedIn) {
            syncBtn.textContent = 'Disconnect Google Sheets';
            syncBtn.classList.add('connected');
            syncBtn.onclick = () => this.signOut();
            
            if (statusBtn) {
                statusBtn.style.display = 'inline-block';
            }
        } else {
            syncBtn.textContent = 'Connect Google Sheets';
            syncBtn.classList.remove('connected', 'syncing');
            syncBtn.onclick = () => this.signIn();
            
            if (statusBtn) {
                statusBtn.style.display = 'none';
            }
        }
    }

    // Show sync status
    showSyncStatus() {
        const syncStatus = storageManager.getSyncStatus();
        const stats = workoutManager.getWorkoutStats();
        
        let statusMessage = `Google Sheets Sync Status:\n\n`;
        statusMessage += `Connected: ${syncStatus.isConnected ? 'Yes' : 'No'}\n`;
        
        if (syncStatus.isConnected) {
            statusMessage += `Last Sync: ${syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}\n`;
            statusMessage += `Pending Changes: ${syncStatus.pendingChanges || 0}\n`;
            
            if (syncStatus.error) {
                statusMessage += `Last Error: ${syncStatus.error}\n`;
            }
            
            statusMessage += `\nTotal Workouts: ${stats.totalWorkouts}\n`;
            statusMessage += `Total Volume: ${stats.totalVolume.toFixed(1)}kg\n`;
        } else {
            statusMessage += `\nClick "Connect Google Sheets" to enable automatic syncing of your workout data.`;
        }

        alert(statusMessage);
    }

    // Show success message
    showSuccess(message) {
        workoutManager.showSuccessMessage(message);
    }

    // Show error message
    showError(message) {
        alert('Google Sheets Error: ' + message);
    }

    // Toggle Google Sheets connection
    async toggleConnection() {
        if (this.isSignedIn) {
            await this.signOut();
        } else {
            await this.signIn();
        }
    }
}

// Global functions for HTML onclick handlers
function toggleGoogleSync() {
    if (!window.GoogleSheetsManager) {
        window.GoogleSheetsManager = new GoogleSheetsManager();
    }
    window.GoogleSheetsManager.toggleConnection();
}

function showSyncStatus() {
    if (window.GoogleSheetsManager) {
        window.GoogleSheetsManager.showSyncStatus();
    }
}

// Initialize Google Sheets manager
window.GoogleSheetsManager = new GoogleSheetsManager();
