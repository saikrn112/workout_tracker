/**
 * Workout UI Controller
 * Handles all UI interactions and workout management
 */

// Global state
let currentTemplate = null;
let workoutData = {};

// Initialize UI when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Workout Logger initialized');
    loadRecentWorkouts();

    // Check for active session on page load
    try {
        const activeSession = await workoutAPI.checkActiveSession();
        if (activeSession) {
            console.log('Found active session on page load');
            displayActiveSession(activeSession);
        }
    } catch (error) {
        console.error('Failed to check for active session:', error);
    }
});

/**
 * Template Management
 */
function renderTemplateButtons(templates) {
    const container = document.getElementById('templateButtons');
    container.innerHTML = '';

    Object.keys(templates).forEach(templateName => {
        const button = document.createElement('button');
        button.className = 'template-btn';
        button.textContent = formatTemplateName(templateName);
        button.onclick = () => selectTemplate(templateName);
        container.appendChild(button);
    });
}

function formatTemplateName(templateName) {
    // Convert template names like "upper1" to "Upper 1"
    return templateName.replace(/([a-zA-Z])(\d)/, '$1 $2')
                      .replace(/^\w/, c => c.toUpperCase());
}

function selectTemplate(templateName) {
    // Update active button
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load template exercises
    currentTemplate = templateName;
    loadTemplate(templateName);

    // Show exercise card
    document.getElementById('exerciseCard').style.display = 'block';
}

function loadTemplate(templateName) {
    const exercises = workoutAPI.templates[templateName] || [];
    const exerciseListDiv = document.getElementById('exerciseList');

    exerciseListDiv.innerHTML = '';
    workoutData = {};

    exercises.forEach(exercise => {
        workoutData[exercise] = [];
        createExerciseItem(exercise);
    });

    // Enable log workout button
    document.getElementById('logWorkoutBtn').disabled = false;
    updateLogButtonState();
}

/**
 * Exercise Management
 */
function createExerciseItem(exerciseName) {
    const exerciseListDiv = document.getElementById('exerciseList');
    const exerciseId = exerciseName.replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    const exerciseDiv = document.createElement('div');
    exerciseDiv.className = 'exercise-item';
    exerciseDiv.innerHTML = `
        <div class="exercise-header">
            <div class="exercise-name">${exerciseName}</div>
            <button class="add-set-btn" onclick="addSet('${exerciseName}')">Add Set</button>
        </div>
        <div class="sets-container" id="sets-${exerciseId}">
            <!-- Sets will be added here -->
        </div>
    `;

    exerciseListDiv.appendChild(exerciseDiv);

    // Add first set automatically
    addSet(exerciseName);
}

function addSet(exerciseName) {
    const exerciseId = exerciseName.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const setsContainer = document.getElementById(`sets-${exerciseId}`);
    const setNumber = workoutData[exerciseName].length + 1;

    // Add to workout data
    workoutData[exerciseName].push({
        weight: '',
        reps: '',
        notes: ''
    });

    const setRow = document.createElement('div');
    setRow.className = 'set-row';
    setRow.innerHTML = `
        <div class="set-number">Set ${setNumber}</div>
        <div class="input-group">
            <div class="input-label">Weight (lbs)</div>
            <input type="number" class="set-input" placeholder="135"
                   onchange="updateSetData('${exerciseName}', ${setNumber - 1}, 'weight', this.value)"
                   onkeypress="handleSetInputKeypress(event, '${exerciseName}', ${setNumber - 1})">
        </div>
        <div class="input-group">
            <div class="input-label">Reps</div>
            <input type="number" class="set-input" placeholder="8"
                   onchange="updateSetData('${exerciseName}', ${setNumber - 1}, 'reps', this.value)"
                   onkeypress="handleSetInputKeypress(event, '${exerciseName}', ${setNumber - 1})">
        </div>
        <button class="remove-set-btn" onclick="removeSet('${exerciseName}', ${setNumber - 1})">×</button>
    `;

    setsContainer.appendChild(setRow);
    updateLogButtonState();

    // Focus on weight input for quick entry
    const weightInput = setRow.querySelector('input[type="number"]');
    weightInput.focus();
}

function removeSet(exerciseName, setIndex) {
    // Remove from workout data
    workoutData[exerciseName].splice(setIndex, 1);

    // Re-render the exercise sets
    const exerciseId = exerciseName.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const setsContainer = document.getElementById(`sets-${exerciseId}`);
    setsContainer.innerHTML = '';

    // Rebuild sets with correct numbers
    workoutData[exerciseName].forEach((setData, index) => {
        const setRow = document.createElement('div');
        setRow.className = 'set-row';
        setRow.innerHTML = `
            <div class="set-number">Set ${index + 1}</div>
            <div class="input-group">
                <div class="input-label">Weight (lbs)</div>
                <input type="number" class="set-input" placeholder="135" value="${setData.weight || ''}"
                       onchange="updateSetData('${exerciseName}', ${index}, 'weight', this.value)"
                       onkeypress="handleSetInputKeypress(event, '${exerciseName}', ${index})">
            </div>
            <div class="input-group">
                <div class="input-label">Reps</div>
                <input type="number" class="set-input" placeholder="8" value="${setData.reps || ''}"
                       onchange="updateSetData('${exerciseName}', ${index}, 'reps', this.value)"
                       onkeypress="handleSetInputKeypress(event, '${exerciseName}', ${index})">
            </div>
            <button class="remove-set-btn" onclick="removeSet('${exerciseName}', ${index})">×</button>
        `;
        setsContainer.appendChild(setRow);
    });

    updateLogButtonState();
}

function updateSetData(exerciseName, setIndex, field, value) {
    if (!workoutData[exerciseName][setIndex]) {
        workoutData[exerciseName][setIndex] = {};
    }

    workoutData[exerciseName][setIndex][field] = value;
    updateLogButtonState();
}

function handleSetInputKeypress(event, exerciseName, setIndex) {
    if (event.key === 'Enter') {
        // Move to next input or add new set
        const currentInput = event.target;
        const setRow = currentInput.closest('.set-row');
        const inputs = setRow.querySelectorAll('input');
        const currentIndex = Array.from(inputs).indexOf(currentInput);

        if (currentIndex < inputs.length - 1) {
            // Focus next input in same set
            inputs[currentIndex + 1].focus();
        } else {
            // Last input in set, add new set
            addSet(exerciseName);
        }
    }
}

function updateLogButtonState() {
    const logBtn = document.getElementById('logWorkoutBtn');

    // Check if we have any data to log
    let hasData = false;
    for (const exercise in workoutData) {
        if (workoutData[exercise].some(set => set.weight || set.reps)) {
            hasData = true;
            break;
        }
    }

    logBtn.disabled = !hasData || !currentTemplate;
}

/**
 * Workout Logging
 */
async function logWorkout() {
    if (!currentTemplate) {
        showError('Please select a template first');
        return;
    }

    // Update button state
    const logBtn = document.getElementById('logWorkoutBtn');
    const logBtnText = document.getElementById('logBtnText');
    const originalText = logBtnText.textContent;

    logBtn.disabled = true;
    logBtn.classList.add('logging');
    logBtnText.textContent = 'Logging...';

    try {
        // Check if there's an active session, if not start one
        let activeSession = await workoutAPI.checkActiveSession();

        if (!activeSession) {
            console.log('No active session, starting new one');
            await workoutAPI.startSession(currentTemplate); // Send original template name, not formatted
            activeSession = await workoutAPI.checkActiveSession();
        }

        if (!activeSession) {
            throw new Error('Failed to create or find active session');
        }

        // Log each set using the session API
        let loggedSets = 0;
        for (const exercise in workoutData) {
            const sets = workoutData[exercise];
            for (let i = 0; i < sets.length; i++) {
                const set = sets[i];
                if (set.weight || set.reps) { // Only log sets with data
                    try {
                        await workoutAPI.logSet(
                            exercise,
                            i + 1, // set number (1-based)
                            set.weight || '',
                            set.reps || '',
                            set.notes || ''
                        );
                        loggedSets++;
                        console.log(`Logged ${exercise} set ${i + 1}: ${set.weight}lb x ${set.reps} reps`);
                    } catch (setError) {
                        console.error(`Failed to log ${exercise} set ${i + 1}:`, setError);
                        // Continue with other sets
                    }
                }
            }
        }

        if (loggedSets > 0) {
            showSuccess(`Logged ${loggedSets} sets successfully!`);

            // Refresh the active session display
            activeSession = await workoutAPI.checkActiveSession();
            if (activeSession) {
                displayActiveSession(activeSession);
            }

            // Refresh workout history
            loadRecentWorkouts();
        } else {
            showError('No sets with data were logged. Please enter weight or reps.');
        }

    } catch (error) {
        console.error('Failed to log workout:', error);
        showError('Failed to log workout: ' + error.message);
    } finally {
        // Reset button state
        logBtn.disabled = false;
        logBtn.classList.remove('logging');
        logBtnText.textContent = originalText;
        updateLogButtonState();
    }
}

function displayActiveSession(session) {
    console.log('Displaying active session:', session);

    // Update template selection to match active session
    currentTemplate = session.template;

    // Highlight the active template button
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.trim() === session.template) {
            btn.classList.add('active');
        }
    });

    // Load exercises from active session
    workoutData = {};
    for (const exercise in session.exercises) {
        const exerciseSets = session.exercises[exercise];
        workoutData[exercise] = [];

        // Convert session data to workoutData format
        exerciseSets.forEach(setData => {
            const setNum = parseInt(setData.set_number || '1') - 1; // Convert to 0-based index
            if (!workoutData[exercise][setNum]) {
                workoutData[exercise][setNum] = {};
            }
            workoutData[exercise][setNum] = {
                weight: setData.weight_lbs || '',
                reps: setData.reps || '',
                notes: setData.segment_note || ''
            };
        });
    }

    // Show exercise card and render exercises
    document.getElementById('exerciseCard').style.display = 'block';
    renderExercises();
    updateLogButtonState();

    // Show active session indicator
    showSuccess(`Active session: ${session.template} (${session.date})`);
}

function clearWorkout() {
    // Reset template selection
    currentTemplate = null;
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Clear workout data
    workoutData = {};

    // Hide exercise card
    document.getElementById('exerciseCard').style.display = 'none';

    // Clear exercise list
    document.getElementById('exerciseList').innerHTML = '';

    // Disable log button
    document.getElementById('logWorkoutBtn').disabled = true;
}

/**
 * Workout History
 */
async function loadRecentWorkouts() {
    try {
        const workouts = await workoutAPI.getRecentWorkouts(10);
        renderWorkoutHistory(workouts);
    } catch (error) {
        console.error('Failed to load recent workouts:', error);
    }
}

function renderWorkoutHistory(workouts) {
    const historyContainer = document.getElementById('workoutHistory');

    if (!workouts || workouts.length === 0) {
        historyContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No recent workouts found. Start logging to see your history!</p>';
        return;
    }

    // Group workouts by date and template
    const groupedWorkouts = {};
    workouts.forEach(workout => {
        const key = `${workout.date}_${workout.template}`;
        if (!groupedWorkouts[key]) {
            groupedWorkouts[key] = {
                date: workout.date,
                template: workout.template,
                exercises: {}
            };
        }

        const exercise = workout.exercise;
        if (!groupedWorkouts[key].exercises[exercise]) {
            groupedWorkouts[key].exercises[exercise] = [];
        }

        groupedWorkouts[key].exercises[exercise].push({
            set: workout.set,
            weight: workout.weight,
            reps: workout.reps,
            volume: workout.volume
        });
    });

    // Render grouped workouts
    historyContainer.innerHTML = '';
    const sortedWorkouts = Object.values(groupedWorkouts).sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedWorkouts.forEach(workout => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        let exercisesHtml = '';
        Object.entries(workout.exercises).forEach(([exercise, sets]) => {
            const setsText = sets.map(set => {
                if (set.weight && set.reps) {
                    return `${set.weight}lb × ${set.reps}`;
                } else if (set.weight) {
                    return `${set.weight}lb`;
                } else if (set.reps) {
                    return `${set.reps} reps`;
                } else {
                    return 'logged';
                }
            }).join(', ');
            exercisesHtml += `<div><strong>${exercise}:</strong> ${setsText}</div>`;
        });

        historyItem.innerHTML = `
            <div class="history-header">
                <div class="history-date">${formatDate(workout.date)}</div>
                <div class="history-template">${workout.template}</div>
            </div>
            <div class="history-exercises">
                ${exercisesHtml}
            </div>
        `;

        historyContainer.appendChild(historyItem);
    });
}

/**
 * Utility Functions
 */
function showSuccess(message) {
    removeExistingMessages();

    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(successDiv, container.children[1]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
}

function showError(message) {
    removeExistingMessages();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.children[1]);

    // Auto-remove after 7 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 7000);
}

function removeExistingMessages() {
    document.querySelectorAll('.success-message, .error-message').forEach(msg => {
        if (msg.parentNode) {
            msg.parentNode.removeChild(msg);
        }
    });
}

function formatDate(dateString) {
    // Parse date string as local date to avoid timezone issues
    const parts = dateString.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
}

function viewSpreadsheet() {
    const url = workoutAPI.getSpreadsheetURL();
    if (url) {
        window.open(url, '_blank');
    } else {
        showError('Spreadsheet URL not available');
    }
}

async function showStats() {
    try {
        const stats = await workoutAPI.getStats();
        if (stats) {
            const message = `
Workout Statistics:
• Total Workouts: ${stats.total_workouts}
• Total Sets: ${stats.total_sets}
• Unique Exercises: ${stats.unique_exercises}
• Total Volume: ${stats.total_volume.toLocaleString()} lbs

Top Exercises:
${Object.entries(stats.exercise_breakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([exercise, count]) => `• ${exercise}: ${count} sets`)
    .join('\n')}
            `.trim();

            alert(message);
        } else {
            showError('Failed to load statistics');
        }
    } catch (error) {
        showError('Failed to load statistics: ' + error.message);
    }
}