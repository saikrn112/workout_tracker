// Workout management for the Workout Logger app
class WorkoutManager {
    constructor() {
        this.currentWorkout = null;
        this.isLogging = false;
    }

    // Log a completed workout
    logWorkout() {
        const workoutData = templateManager.getCurrentWorkoutData();
        
        if (!workoutData || Object.keys(workoutData.exercises).length === 0) {
            alert('Please add at least one exercise with sets before logging the workout.');
            return false;
        }

        // Validate that at least one set has data
        let hasValidSets = false;
        Object.values(workoutData.exercises).forEach(sets => {
            sets.forEach(set => {
                if (set.weight || set.reps) {
                    hasValidSets = true;
                }
            });
        });

        if (!hasValidSets) {
            alert('Please enter weight and/or reps for at least one set.');
            return false;
        }

        this.isLogging = true;
        this.showLoadingOverlay('Saving workout...');

        try {
            // Save to local storage
            const success = storageManager.addWorkout(workoutData);
            
            if (success) {
                // Update sync status
                const syncStatus = storageManager.getSyncStatus();
                storageManager.updateSyncStatus({
                    pendingChanges: syncStatus.pendingChanges + 1
                });

                // Trigger sync if online and connected
                if (navigator.onLine && window.GoogleSheetsManager && syncStatus.isConnected) {
                    this.syncWorkout(workoutData);
                }

                // Update UI
                this.displayWorkoutHistory();
                templateManager.resetWorkout();
                
                this.hideLoadingOverlay();
                this.showSuccessMessage('Workout logged successfully!');
                
                return true;
            } else {
                throw new Error('Failed to save workout to local storage');
            }
        } catch (error) {
            console.error('Error logging workout:', error);
            this.hideLoadingOverlay();
            alert('Error logging workout. Please try again.');
            return false;
        } finally {
            this.isLogging = false;
        }
    }

    // Sync workout to Google Sheets
    async syncWorkout(workoutData) {
        if (!window.GoogleSheetsManager) {
            return;
        }

        try {
            await window.GoogleSheetsManager.addWorkoutToSheet(workoutData);
            
            // Update sync status
            const syncStatus = storageManager.getSyncStatus();
            storageManager.updateSyncStatus({
                lastSync: new Date().toISOString(),
                pendingChanges: Math.max(0, syncStatus.pendingChanges - 1),
                error: null
            });
        } catch (error) {
            console.error('Error syncing workout:', error);
            storageManager.updateSyncStatus({
                error: error.message
            });
        }
    }

    // Display workout history
    displayWorkoutHistory() {
        const historyDiv = document.getElementById('workoutHistory');
        const workoutHistory = storageManager.getWorkoutHistory();
        
        if (workoutHistory.length === 0) {
            historyDiv.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No workouts logged yet. Start your first workout!</p>';
            return;
        }
        
        const displayHistory = workoutHistory.slice(0, CONFIG.APP.MAX_HISTORY_DISPLAY);
        
        historyDiv.innerHTML = displayHistory.map(workout => {
            const workoutDate = new Date(workout.date);
            const totalSets = this.calculateTotalSets(workout.exercises);
            const totalVolume = this.calculateTotalVolume(workout.exercises);
            
            return `
                <div class="history-item" onclick="workoutManager.showWorkoutDetails('${workout.date}')">
                    <div class="history-date">${workoutDate.toLocaleDateString()}</div>
                    <div class="history-template">${workout.template.toUpperCase()}</div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
                        ${Object.keys(workout.exercises).length} exercises • ${totalSets} sets • ${totalVolume.toFixed(0)}kg volume
                    </div>
                </div>
            `;
        }).join('');
    }

    // Calculate total sets for a workout
    calculateTotalSets(exercises) {
        let totalSets = 0;
        Object.values(exercises).forEach(sets => {
            if (Array.isArray(sets)) {
                totalSets += sets.length;
            } else {
                totalSets += 1; // Old format compatibility
            }
        });
        return totalSets;
    }

    // Calculate total volume for a workout
    calculateTotalVolume(exercises) {
        let totalVolume = 0;
        Object.values(exercises).forEach(sets => {
            if (Array.isArray(sets)) {
                sets.forEach(set => {
                    const weight = parseFloat(set.weight) || 0;
                    const reps = parseInt(set.reps) || 0;
                    totalVolume += weight * reps;
                });
            } else {
                // Old format compatibility
                const weight = parseFloat(sets.weight) || 0;
                const reps = parseInt(sets.reps || sets.sets) || 0;
                totalVolume += weight * reps;
            }
        });
        return totalVolume;
    }

    // Show detailed view of a specific workout
    showWorkoutDetails(workoutDate) {
        const workoutHistory = storageManager.getWorkoutHistory();
        const workout = workoutHistory.find(w => w.date === workoutDate);
        
        if (!workout) {
            alert('Workout not found');
            return;
        }

        const exerciseDetails = Object.entries(workout.exercises).map(([exercise, sets]) => {
            const setDetails = Array.isArray(sets) ? sets : [sets]; // Handle old format
            const setsText = setDetails.map((set, index) => {
                return `Set ${index + 1}: ${set.weight || '?'}kg × ${set.reps || '?'} reps`;
            }).join('\n    ');
            
            return `${exercise}:\n    ${setsText}`;
        }).join('\n\n');

        const totalVolume = this.calculateTotalVolume(workout.exercises);
        const totalSets = this.calculateTotalSets(workout.exercises);

        alert(`Workout Details - ${new Date(workout.date).toLocaleDateString()}
Template: ${workout.template.toUpperCase()}
Total Sets: ${totalSets}
Total Volume: ${totalVolume.toFixed(1)}kg

Exercises:
${exerciseDetails}`);
    }

    // Get workout statistics
    getWorkoutStats() {
        const workoutHistory = storageManager.getWorkoutHistory();
        
        if (workoutHistory.length === 0) {
            return {
                totalWorkouts: 0,
                totalVolume: 0,
                totalSets: 0,
                averageVolume: 0,
                favoriteTemplate: null,
                streak: 0
            };
        }

        let totalVolume = 0;
        let totalSets = 0;
        const templateCounts = {};
        
        workoutHistory.forEach(workout => {
            totalVolume += this.calculateTotalVolume(workout.exercises);
            totalSets += this.calculateTotalSets(workout.exercises);
            
            templateCounts[workout.template] = (templateCounts[workout.template] || 0) + 1;
        });

        const favoriteTemplate = Object.entries(templateCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

        const streak = this.calculateWorkoutStreak(workoutHistory);

        return {
            totalWorkouts: workoutHistory.length,
            totalVolume: totalVolume,
            totalSets: totalSets,
            averageVolume: totalVolume / workoutHistory.length,
            favoriteTemplate: favoriteTemplate,
            streak: streak
        };
    }

    // Calculate current workout streak
    calculateWorkoutStreak(workoutHistory) {
        if (workoutHistory.length === 0) return 0;

        const sortedWorkouts = workoutHistory
            .map(w => new Date(w.date))
            .sort((a, b) => b - a);

        let streak = 1;
        const today = new Date();
        const lastWorkout = sortedWorkouts[0];
        
        // Check if last workout was within the last 7 days
        const daysSinceLastWorkout = Math.floor((today - lastWorkout) / (1000 * 60 * 60 * 24));
        if (daysSinceLastWorkout > 7) return 0;

        for (let i = 1; i < sortedWorkouts.length; i++) {
            const daysBetween = Math.floor((sortedWorkouts[i-1] - sortedWorkouts[i]) / (1000 * 60 * 60 * 24));
            if (daysBetween <= 7) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    // Show loading overlay
    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageElement = overlay.querySelector('p');
        messageElement.textContent = message;
        overlay.style.display = 'flex';
    }

    // Hide loading overlay
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }

    // Show success message
    showSuccessMessage(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: 600;
            animation: slideInRight 0.3s ease-out;
        `;
        successDiv.textContent = message;
        
        // Add animation keyframes if not already added
        if (!document.querySelector('#success-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'success-animation-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (successDiv.parentNode) {
                    successDiv.parentNode.removeChild(successDiv);
                }
            }, 300);
        }, 3000);
    }

    // Initialize workout manager
    init() {
        // Migrate old data format if needed
        storageManager.migrateOldData();
        
        // Display workout history
        this.displayWorkoutHistory();
        
        // Set up auto-save interval
        setInterval(() => {
            if (this.currentWorkout && !this.isLogging) {
                // Auto-save current workout state (if needed)
                console.log('Auto-save triggered');
            }
        }, CONFIG.APP.AUTO_SAVE_INTERVAL);
    }
}

// Global functions for HTML onclick handlers
function logWorkout() {
    workoutManager.logWorkout();
}

function selectTemplate(templateName) {
    templateManager.selectTemplate(templateName);
}

function showCustomTemplateCreator() {
    templateManager.showCustomTemplateCreator();
}

function createCustomTemplate() {
    templateManager.createCustomTemplate();
}

// Initialize workout manager
window.workoutManager = new WorkoutManager();
