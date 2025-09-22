// Storage management for the Workout Logger app
class StorageManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.setupOnlineStatusListeners();
    }

    setupOnlineStatusListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.triggerSync();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    // Local storage operations
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    // Workout history management
    getWorkoutHistory() {
        return this.load(CONFIG.STORAGE_KEYS.WORKOUT_HISTORY, []);
    }

    saveWorkoutHistory(history) {
        return this.save(CONFIG.STORAGE_KEYS.WORKOUT_HISTORY, history);
    }

    addWorkout(workout) {
        const history = this.getWorkoutHistory();
        history.unshift(workout); // Add to beginning
        return this.saveWorkoutHistory(history);
    }

    // Custom templates management
    getCustomTemplates() {
        return this.load(CONFIG.STORAGE_KEYS.CUSTOM_TEMPLATES, {});
    }

    saveCustomTemplates(templates) {
        return this.save(CONFIG.STORAGE_KEYS.CUSTOM_TEMPLATES, templates);
    }

    addCustomTemplate(name, exercises) {
        const templates = this.getCustomTemplates();
        templates[name] = exercises;
        return this.saveCustomTemplates(templates);
    }

    removeCustomTemplate(name) {
        const templates = this.getCustomTemplates();
        delete templates[name];
        return this.saveCustomTemplates(templates);
    }

    // Sync status management
    getSyncStatus() {
        return this.load(CONFIG.STORAGE_KEYS.SYNC_STATUS, {
            isConnected: false,
            lastSync: null,
            pendingChanges: 0,
            error: null
        });
    }

    updateSyncStatus(status) {
        const currentStatus = this.getSyncStatus();
        const newStatus = { ...currentStatus, ...status };
        return this.save(CONFIG.STORAGE_KEYS.SYNC_STATUS, newStatus);
    }

    // Data migration for backward compatibility
    migrateOldData() {
        const history = this.getWorkoutHistory();
        let migrated = false;

        const migratedHistory = history.map(workout => {
            if (workout.exercises) {
                const migratedExercises = {};
                
                Object.entries(workout.exercises).forEach(([exercise, sets]) => {
                    if (!Array.isArray(sets)) {
                        // Convert old format to new format
                        migratedExercises[exercise] = [{
                            weight: sets.weight || '',
                            reps: sets.reps || sets.sets || ''
                        }];
                        migrated = true;
                    } else {
                        migratedExercises[exercise] = sets;
                    }
                });
                
                return { ...workout, exercises: migratedExercises };
            }
            return workout;
        });

        if (migrated) {
            this.saveWorkoutHistory(migratedHistory);
            console.log('Data migration completed');
        }

        return migrated;
    }

    // Export data for backup
    exportAllData() {
        return {
            workoutHistory: this.getWorkoutHistory(),
            customTemplates: this.getCustomTemplates(),
            syncStatus: this.getSyncStatus(),
            exportDate: new Date().toISOString()
        };
    }

    // Import data from backup
    importData(data) {
        try {
            if (data.workoutHistory) {
                this.saveWorkoutHistory(data.workoutHistory);
            }
            if (data.customTemplates) {
                this.saveCustomTemplates(data.customTemplates);
            }
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data (for reset functionality)
    clearAllData() {
        const keys = Object.values(CONFIG.STORAGE_KEYS);
        keys.forEach(key => this.remove(key));
    }

    // Trigger sync when online
    triggerSync() {
        if (this.isOnline && window.GoogleSheetsManager) {
            window.GoogleSheetsManager.syncData();
        }
    }
}

// Initialize storage manager
window.storageManager = new StorageManager();
