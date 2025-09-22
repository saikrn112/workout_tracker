// Main application initialization and coordination
class WorkoutLoggerApp {
    constructor() {
        this.isInitialized = false;
        this.version = '2.0.0';
    }

    // Initialize the application
    async init() {
        if (this.isInitialized) return;

        try {
            console.log(`Initializing Workout Logger v${this.version}`);
            
            // Initialize managers in order
            this.initializeEventListeners();
            this.setupKeyboardShortcuts();
            this.setupAutoSave();
            
            // Initialize workout manager (includes data migration)
            workoutManager.init();
            
            // Initialize Google Sheets (if configured)
            if (CONFIG.GOOGLE_SHEETS.CLIENT_ID && CONFIG.GOOGLE_SHEETS.API_KEY) {
                await window.GoogleSheetsManager.init();
            } else {
                this.showGoogleSheetsSetupPrompt();
            }
            
            // Setup PWA features
            this.setupPWA();
            
            // Setup online/offline handling
            this.setupNetworkHandling();
            
            this.isInitialized = true;
            console.log('Workout Logger initialized successfully');
            
            // Show welcome message for new users
            this.checkFirstTimeUser();
            
        } catch (error) {
            console.error('Error initializing app:', error);
            alert('Error initializing the app. Please refresh the page.');
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Custom template name input - Enter key
        const customNameInput = document.getElementById('customTemplateName');
        if (customNameInput) {
            customNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    createCustomTemplate();
                }
            });
        }

        // Set inputs - Enter key to move to next input
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('set-input')) {
                const inputs = Array.from(document.querySelectorAll('.set-input'));
                const currentIndex = inputs.indexOf(e.target);
                const nextInput = inputs[currentIndex + 1];
                
                if (nextInput) {
                    nextInput.focus();
                } else {
                    // If it's the last input in a set, add a new set
                    const setRow = e.target.closest('.set-row');
                    const addSetBtn = setRow.closest('.sets-container').querySelector('.add-set-btn');
                    if (addSetBtn) {
                        addSetBtn.click();
                        // Focus the first input of the new set
                        setTimeout(() => {
                            const newSetInputs = setRow.parentElement.lastElementChild.querySelectorAll('.set-input');
                            if (newSetInputs[0]) {
                                newSetInputs[0].focus();
                            }
                        }, 100);
                    }
                }
            }
        });

        // Auto-save on input changes
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('set-input')) {
                this.scheduleAutoSave();
            }
        });

        // Prevent form submission on Enter
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: Save workout
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!document.getElementById('logWorkoutBtn').disabled) {
                    logWorkout();
                }
            }
            
            // Ctrl/Cmd + E: Export data
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                exportToCSV();
            }
            
            // Ctrl/Cmd + G: Toggle Google Sheets
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                toggleGoogleSync();
            }
            
            // Escape: Close any open dialogs
            if (e.key === 'Escape') {
                const customCreator = document.getElementById('customTemplateCreator');
                if (customCreator && customCreator.style.display !== 'none') {
                    customCreator.style.display = 'none';
                }
            }
        });
    }

    // Setup auto-save functionality
    setupAutoSave() {
        this.autoSaveTimeout = null;
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 2000); // Auto-save 2 seconds after last input
    }

    autoSave() {
        // Save current workout state to localStorage for recovery
        const currentWorkout = templateManager.getCurrentWorkoutData();
        if (currentWorkout && Object.keys(currentWorkout.exercises).length > 0) {
            storageManager.save('currentWorkoutDraft', currentWorkout);
        }
    }

    // Setup PWA features
    setupPWA() {
        // Register service worker
        if (ENV.supportsServiceWorker) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });

        // Handle app installed
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.deferredPrompt = null;
        });
    }

    // Show PWA install prompt
    showInstallPrompt() {
        // Create install banner
        const banner = document.createElement('div');
        banner.id = 'install-banner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #4facfe;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 1000;
            font-size: 14px;
        `;
        banner.innerHTML = `
            📱 Install Workout Logger for quick access! 
            <button onclick="app.installPWA()" style="background: white; color: #4facfe; border: none; padding: 5px 10px; margin-left: 10px; border-radius: 4px; cursor: pointer;">Install</button>
            <button onclick="app.dismissInstallPrompt()" style="background: transparent; color: white; border: 1px solid white; padding: 5px 10px; margin-left: 5px; border-radius: 4px; cursor: pointer;">Later</button>
        `;
        
        document.body.appendChild(banner);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.dismissInstallPrompt();
        }, 10000);
    }

    // Install PWA
    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            this.deferredPrompt = null;
        }
        this.dismissInstallPrompt();
    }

    // Dismiss install prompt
    dismissInstallPrompt() {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.remove();
        }
    }

    // Setup network status handling
    setupNetworkHandling() {
        window.addEventListener('online', () => {
            this.showNetworkStatus('Back online! Syncing data...', 'success');
            if (window.GoogleSheetsManager && window.GoogleSheetsManager.isSignedIn) {
                setTimeout(() => {
                    window.GoogleSheetsManager.syncAllData();
                }, 1000);
            }
        });

        window.addEventListener('offline', () => {
            this.showNetworkStatus('You\'re offline. Data will sync when connection is restored.', 'warning');
        });
    }

    // Show network status message
    showNetworkStatus(message, type = 'info') {
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1001;
            font-size: 14px;
            max-width: 300px;
            text-align: center;
        `;
        statusDiv.textContent = message;
        
        document.body.appendChild(statusDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, 5000);
    }

    // Check if this is a first-time user
    checkFirstTimeUser() {
        const workoutHistory = storageManager.getWorkoutHistory();
        const hasSeenWelcome = storageManager.load('hasSeenWelcome', false);
        
        if (workoutHistory.length === 0 && !hasSeenWelcome) {
            this.showWelcomeMessage();
            storageManager.save('hasSeenWelcome', true);
        }
    }

    // Show welcome message for new users
    showWelcomeMessage() {
        setTimeout(() => {
            const message = `Welcome to Workout Logger! 🎉

Here's how to get started:

1. Select a workout template (Upper 1/2, Lower 1/2) or create a custom one
2. Enter your weights and reps for each set
3. Click "Log Workout" when you're done
4. Connect Google Sheets for automatic syncing (optional)

Keyboard shortcuts:
• Ctrl/Cmd + S: Save workout
• Ctrl/Cmd + E: Export data
• Enter: Move to next input or add new set

Your data is saved locally and will sync to Google Sheets when connected.

Ready to start your fitness journey?`;
            
            alert(message);
        }, 1000);
    }

    // Show Google Sheets setup prompt
    showGoogleSheetsSetupPrompt() {
        const syncBtn = document.getElementById('googleSyncBtn');
        if (syncBtn) {
            syncBtn.textContent = 'Setup Google Sheets';
            syncBtn.onclick = () => this.showGoogleSheetsInstructions();
        }
    }

    // Show Google Sheets setup instructions
    showGoogleSheetsInstructions() {
        const instructions = `To enable Google Sheets integration:

1. Go to Google Cloud Console (console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google Sheets API and Google Drive API
4. Create credentials (API Key and OAuth 2.0 Client ID)
5. Add your domain to authorized origins
6. Update the CONFIG object in js/config.js with your credentials

For detailed setup instructions, check the README file.

For now, you can export your data manually and import it into Google Sheets.`;
        
        alert(instructions);
    }

    // Get app statistics
    getAppStats() {
        const workoutStats = workoutManager.getWorkoutStats();
        const syncStatus = storageManager.getSyncStatus();
        
        return {
            version: this.version,
            totalWorkouts: workoutStats.totalWorkouts,
            totalVolume: workoutStats.totalVolume,
            isOnline: navigator.onLine,
            isGoogleConnected: syncStatus.isConnected,
            lastSync: syncStatus.lastSync
        };
    }

    // Reset app data (for debugging/testing)
    resetApp() {
        if (confirm('Are you sure you want to reset all data? This cannot be undone!')) {
            if (confirm('This will delete ALL workout data and custom templates. Are you absolutely sure?')) {
                storageManager.clearAllData();
                location.reload();
            }
        }
    }
}

// Global functions for HTML onclick handlers (maintain compatibility)
window.selectTemplate = (templateName) => templateManager.selectTemplate(templateName);
window.showCustomTemplateCreator = () => templateManager.showCustomTemplateCreator();
window.createCustomTemplate = () => templateManager.createCustomTemplate();
window.logWorkout = () => workoutManager.logWorkout();
window.exportToCSV = () => exportManager.exportToCSV();
window.toggleGoogleSync = () => toggleGoogleSync();
window.showSyncStatus = () => showSyncStatus();

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorkoutLoggerApp();
    window.app.init();
});

// Make app available globally for debugging
window.WorkoutLoggerApp = WorkoutLoggerApp;
