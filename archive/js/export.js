// Export functionality for the Workout Logger app
class ExportManager {
    constructor() {
        this.supportedFormats = ['csv', 'json'];
    }

    // Export workout data to CSV format
    exportToCSV() {
        const workoutHistory = storageManager.getWorkoutHistory();
        
        if (workoutHistory.length === 0) {
            alert('No workout data to export');
            return false;
        }
        
        try {
            let csv = CONFIG.SPREADSHEET.HEADERS.join(',') + '\n';
            
            workoutHistory.forEach(workout => {
                Object.entries(workout.exercises).forEach(([exercise, sets]) => {
                    const setsArray = Array.isArray(sets) ? sets : [sets]; // Handle old format
                    
                    setsArray.forEach((set, index) => {
                        const date = new Date(workout.date).toLocaleDateString();
                        const weight = set.weight || '';
                        const reps = set.reps || set.sets || ''; // Handle old format
                        
                        csv += `"${date}","${workout.template}","${exercise}",${index + 1},"${weight}","${reps}"\n`;
                    });
                });
            });
            
            this.downloadFile(csv, 'text/csv', `workout_log_${new Date().toISOString().split('T')[0]}.csv`);
            return true;
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            alert('Error exporting data. Please try again.');
            return false;
        }
    }

    // Export workout data to JSON format
    exportToJSON() {
        const workoutHistory = storageManager.getWorkoutHistory();
        const customTemplates = storageManager.getCustomTemplates();
        
        if (workoutHistory.length === 0) {
            alert('No workout data to export');
            return false;
        }

        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                version: '2.0',
                workoutHistory: workoutHistory,
                customTemplates: customTemplates,
                stats: workoutManager.getWorkoutStats()
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            this.downloadFile(jsonString, 'application/json', `workout_backup_${new Date().toISOString().split('T')[0]}.json`);
            return true;
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            alert('Error exporting data. Please try again.');
            return false;
        }
    }

    // Import workout data from JSON backup
    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    // Validate import data structure
                    if (!importData.workoutHistory || !Array.isArray(importData.workoutHistory)) {
                        throw new Error('Invalid backup file format');
                    }

                    // Confirm with user before importing
                    const confirmMessage = `Import ${importData.workoutHistory.length} workouts from backup?\n\nThis will merge with your existing data. Current data will not be lost.`;
                    
                    if (confirm(confirmMessage)) {
                        // Merge with existing data
                        const existingHistory = storageManager.getWorkoutHistory();
                        const existingTemplates = storageManager.getCustomTemplates();
                        
                        // Merge workout history (avoid duplicates by date)
                        const existingDates = new Set(existingHistory.map(w => w.date));
                        const newWorkouts = importData.workoutHistory.filter(w => !existingDates.has(w.date));
                        
                        const mergedHistory = [...existingHistory, ...newWorkouts]
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        // Merge custom templates
                        const mergedTemplates = { ...existingTemplates, ...importData.customTemplates };
                        
                        // Save merged data
                        storageManager.saveWorkoutHistory(mergedHistory);
                        storageManager.saveCustomTemplates(mergedTemplates);
                        
                        // Update UI
                        templateManager.loadCustomTemplates();
                        workoutManager.displayWorkoutHistory();
                        
                        alert(`Successfully imported ${newWorkouts.length} new workouts and ${Object.keys(importData.customTemplates || {}).length} custom templates!`);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    console.error('Error importing JSON:', error);
                    alert('Error importing backup file. Please check the file format.');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                alert('Error reading file');
                reject(new Error('File read error'));
            };
            
            reader.readAsText(file);
        });
    }

    // Import workout data from CSV
    importFromCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const lines = csvText.split('\n').filter(line => line.trim());
                    
                    if (lines.length < 2) {
                        throw new Error('CSV file appears to be empty or invalid');
                    }

                    // Parse header
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                    const expectedHeaders = CONFIG.SPREADSHEET.HEADERS;
                    
                    // Validate headers
                    const hasValidHeaders = expectedHeaders.every(header => 
                        headers.some(h => h.toLowerCase() === header.toLowerCase())
                    );
                    
                    if (!hasValidHeaders) {
                        throw new Error('CSV file does not have the expected headers: ' + expectedHeaders.join(', '));
                    }

                    // Parse data
                    const workoutData = {};
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = this.parseCSVLine(lines[i]);
                        if (values.length < 6) continue;
                        
                        const [date, template, exercise, set, weight, reps] = values;
                        const workoutKey = `${date}_${template}`;
                        
                        if (!workoutData[workoutKey]) {
                            workoutData[workoutKey] = {
                                date: new Date(date).toISOString(),
                                template: template,
                                exercises: {}
                            };
                        }
                        
                        if (!workoutData[workoutKey].exercises[exercise]) {
                            workoutData[workoutKey].exercises[exercise] = [];
                        }
                        
                        workoutData[workoutKey].exercises[exercise].push({
                            weight: weight || '',
                            reps: reps || ''
                        });
                    }

                    const importedWorkouts = Object.values(workoutData);
                    
                    if (importedWorkouts.length === 0) {
                        throw new Error('No valid workout data found in CSV');
                    }

                    // Confirm import
                    const confirmMessage = `Import ${importedWorkouts.length} workouts from CSV?\n\nThis will merge with your existing data.`;
                    
                    if (confirm(confirmMessage)) {
                        // Merge with existing data
                        const existingHistory = storageManager.getWorkoutHistory();
                        const existingDates = new Set(existingHistory.map(w => w.date.split('T')[0]));
                        
                        const newWorkouts = importedWorkouts.filter(w => 
                            !existingDates.has(w.date.split('T')[0])
                        );
                        
                        const mergedHistory = [...existingHistory, ...newWorkouts]
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                        
                        storageManager.saveWorkoutHistory(mergedHistory);
                        workoutManager.displayWorkoutHistory();
                        
                        alert(`Successfully imported ${newWorkouts.length} new workouts from CSV!`);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    console.error('Error importing CSV:', error);
                    alert('Error importing CSV file: ' + error.message);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                alert('Error reading file');
                reject(new Error('File read error'));
            };
            
            reader.readAsText(file);
        });
    }

    // Parse CSV line handling quoted values
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    // Download file helper
    downloadFile(content, mimeType, filename) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Create file input for import
    createFileInput(acceptedTypes, onFileSelect) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = acceptedTypes;
        input.style.display = 'none';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                onFileSelect(file);
            }
            document.body.removeChild(input);
        };
        
        document.body.appendChild(input);
        input.click();
    }

    // Show import options dialog
    showImportDialog() {
        const choice = confirm('Choose import format:\n\nOK = JSON Backup\nCancel = CSV File');
        
        if (choice) {
            // Import JSON
            this.createFileInput('.json', (file) => {
                this.importFromJSON(file);
            });
        } else {
            // Import CSV
            this.createFileInput('.csv', (file) => {
                this.importFromCSV(file);
            });
        }
    }

    // Show export options dialog
    showExportDialog() {
        const choice = confirm('Choose export format:\n\nOK = CSV (for Google Sheets)\nCancel = JSON Backup');
        
        if (choice) {
            this.exportToCSV();
        } else {
            this.exportToJSON();
        }
    }
}

// Global functions for HTML onclick handlers
function exportToCSV() {
    exportManager.exportToCSV();
}

function showImportDialog() {
    exportManager.showImportDialog();
}

function showExportDialog() {
    exportManager.showExportDialog();
}

// Initialize export manager
window.exportManager = new ExportManager();
