/**
 * Workout API Client
 * Handles communication with the Python backend API
 */

class WorkoutAPI {
    constructor() {
        // Get API URL from environment or default
        this.baseURL = window.CONFIG?.API_BASE_URL || 'http://localhost:5001/api';
        this.isConnected = false;
        this.templates = {};
        this.spreadsheetInfo = null;
        this.activeSession = null;

        // Initialize connection check
        this.checkConnection();

        // Set up periodic connection monitoring
        setInterval(() => this.checkConnection(), 30000); // Check every 30 seconds
    }

    async checkConnection() {
        try {
            updateConnectionStatus('connecting');

            const response = await fetch(`${this.baseURL}/health`);
            const data = await response.json();

            if (data.status === 'healthy') {
                this.isConnected = true;
                this.spreadsheetInfo = {
                    id: data.spreadsheet_id,
                    url: data.spreadsheet_url
                };
                updateConnectionStatus('connected');

                // Load templates if we just connected
                if (Object.keys(this.templates).length === 0) {
                    await this.loadTemplates();
                }

                // Check for active session
                await this.checkActiveSession();

                return true;
            } else {
                throw new Error('Backend unhealthy');
            }
        } catch (error) {
            console.error('Connection check failed:', error);
            this.isConnected = false;
            updateConnectionStatus('disconnected', error.message);
            return false;
        }
    }

    async loadTemplates() {
        try {
            const response = await fetch(`${this.baseURL}/templates`);
            const data = await response.json();

            if (data.success) {
                this.templates = data.templates;
                renderTemplateButtons(this.templates);
                return this.templates;
            } else {
                throw new Error(data.error || 'Failed to load templates');
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            showError('Failed to load workout templates: ' + error.message);
            return {};
        }
    }

    async logWorkout(workoutData) {
        if (!this.isConnected) {
            throw new Error('Not connected to backend');
        }

        try {
            const response = await fetch(`${this.baseURL}/workout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(workoutData)
            });

            const data = await response.json();

            if (data.success) {
                return {
                    success: true,
                    message: data.message,
                    rowsAdded: data.rows_added
                };
            } else {
                throw new Error(data.error || 'Failed to log workout');
            }
        } catch (error) {
            console.error('Failed to log workout:', error);
            throw error;
        }
    }

    async getRecentWorkouts(limit = 20) {
        try {
            const response = await fetch(`${this.baseURL}/workouts?limit=${limit}`);
            const data = await response.json();

            if (data.success) {
                return data.workouts;
            } else {
                throw new Error(data.error || 'Failed to get recent workouts');
            }
        } catch (error) {
            console.error('Failed to get recent workouts:', error);
            return [];
        }
    }

    async getStats() {
        try {
            const response = await fetch(`${this.baseURL}/stats`);
            const data = await response.json();

            if (data.success) {
                return data.stats;
            } else {
                throw new Error(data.error || 'Failed to get statistics');
            }
        } catch (error) {
            console.error('Failed to get stats:', error);
            return null;
        }
    }

    getSpreadsheetURL() {
        return this.spreadsheetInfo?.url || null;
    }

    // Session Management Methods
    async checkActiveSession() {
        try {
            const response = await fetch(`${this.baseURL}/session/active`);
            const data = await response.json();

            if (data.success && data.session) {
                this.activeSession = data.session;
                console.log('Found active session:', this.activeSession);
                return this.activeSession;
            } else {
                this.activeSession = null;
                return null;
            }
        } catch (error) {
            console.error('Failed to check active session:', error);
            this.activeSession = null;
            return null;
        }
    }

    async startSession(template) {
        try {
            const response = await fetch(`${this.baseURL}/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ template })
            });

            const data = await response.json();

            if (data.success) {
                await this.checkActiveSession(); // Refresh active session
                return data;
            } else {
                throw new Error(data.error || 'Failed to start session');
            }
        } catch (error) {
            console.error('Failed to start session:', error);
            throw error;
        }
    }

    async logSet(exercise, setNumber, weight, reps, notes = '') {
        try {
            const response = await fetch(`${this.baseURL}/session/log-set`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    exercise,
                    set_number: setNumber,
                    weight,
                    reps,
                    notes
                })
            });

            const data = await response.json();

            if (data.success) {
                await this.checkActiveSession(); // Refresh active session
                return data;
            } else {
                throw new Error(data.error || 'Failed to log set');
            }
        } catch (error) {
            console.error('Failed to log set:', error);
            throw error;
        }
    }

    async completeSession() {
        try {
            const response = await fetch(`${this.baseURL}/session/complete`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.activeSession = null;
                return data;
            } else {
                throw new Error(data.error || 'Failed to complete session');
            }
        } catch (error) {
            console.error('Failed to complete session:', error);
            throw error;
        }
    }

    async cancelSession() {
        try {
            const response = await fetch(`${this.baseURL}/session/cancel`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.activeSession = null;
                return data;
            } else {
                throw new Error(data.error || 'Failed to cancel session');
            }
        } catch (error) {
            console.error('Failed to cancel session:', error);
            throw error;
        }
    }
}

// Global API instance
const workoutAPI = new WorkoutAPI();

// Connection status management
function updateConnectionStatus(status, message = '') {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = 'status-dot';

    switch (status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected to backend';
            break;
        case 'disconnected':
            statusDot.classList.add('disconnected');
            statusText.textContent = message ? `Disconnected: ${message}` : 'Disconnected from backend';
            break;
        case 'connecting':
            statusDot.classList.add('connecting');
            statusText.textContent = 'Connecting...';
            break;
    }
}

// Utility function for manual connection check
async function checkConnection() {
    await workoutAPI.checkConnection();
}