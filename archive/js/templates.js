// Template management for the Workout Logger app
class TemplateManager {
    constructor() {
        this.templates = {
            'upper1': [
                'Bench Press',
                'Bent Over Row',
                'Overhead Press',
                'Pull-ups/Lat Pulldown',
                'Dips',
                'Barbell Curls',
                'Close Grip Bench Press'
            ],
            'upper2': [
                'Incline Dumbbell Press',
                'Cable Row',
                'Dumbbell Shoulder Press',
                'Face Pulls',
                'Dumbbell Flyes',
                'Hammer Curls',
                'Tricep Extensions'
            ],
            'lower1': [
                'Squats',
                'Romanian Deadlifts',
                'Bulgarian Split Squats',
                'Hip Thrusts',
                'Walking Lunges',
                'Calf Raises',
                'Leg Curls'
            ],
            'lower2': [
                'Deadlifts',
                'Front Squats',
                'Step-ups',
                'Glute Bridges',
                'Leg Press',
                'Standing Calf Raises',
                'Leg Extensions'
            ]
        };
        
        this.currentTemplate = null;
        this.loadCustomTemplates();
    }

    loadCustomTemplates() {
        const customTemplates = storageManager.getCustomTemplates();
        Object.assign(this.templates, customTemplates);
        this.updateTemplateButtons();
    }

    updateTemplateButtons() {
        const templateButtonsDiv = document.querySelector('.template-buttons');
        const customButton = templateButtonsDiv.querySelector('button[onclick*="showCustomTemplateCreator"]');
        
        // Remove existing custom template buttons
        const existingCustomButtons = templateButtonsDiv.querySelectorAll('.custom-template-btn');
        existingCustomButtons.forEach(btn => btn.remove());
        
        // Add custom template buttons
        const customTemplates = storageManager.getCustomTemplates();
        Object.keys(customTemplates).forEach(templateName => {
            const button = document.createElement('button');
            button.className = 'template-btn custom-template-btn';
            button.textContent = templateName;
            button.onclick = () => this.selectTemplate(templateName);
            templateButtonsDiv.insertBefore(button, customButton);
        });
    }

    selectTemplate(templateName) {
        this.currentTemplate = templateName;
        
        // Update button states
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.classList.add('active');
        
        // Hide custom template creator
        document.getElementById('customTemplateCreator').style.display = 'none';
        
        // Load exercises for this template
        this.loadExercises(templateName);
    }

    loadExercises(templateName) {
        const exercises = this.templates[templateName];
        if (!exercises) {
            console.error('Template not found:', templateName);
            return;
        }

        const exerciseList = document.getElementById('exerciseList');
        exerciseList.innerHTML = '';

        exercises.forEach(exerciseName => {
            this.addExerciseToList(exerciseName);
        });

        // Add "Add Exercise" button
        this.addExerciseButton();
        
        // Enable log workout button
        document.getElementById('logWorkoutBtn').disabled = false;
    }

    addExerciseToList(exerciseName) {
        const exerciseList = document.getElementById('exerciseList');
        const exerciseDiv = document.createElement('div');
        exerciseDiv.className = 'exercise-item fade-in';
        exerciseDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="exercise-name">${exerciseName}</span>
                <button class="remove-exercise" onclick="templateManager.removeExercise(this)">Remove</button>
            </div>
            <div class="sets-container">
                <div class="sets-header">
                    <span>Sets</span>
                    <button class="add-set-btn" onclick="templateManager.addSet(this)">+ Add Set</button>
                </div>
                <div class="sets-list">
                    <div class="set-row">
                        <span class="set-number">1</span>
                        <input type="number" class="set-input" placeholder="Weight" min="0" step="0.5">
                        <span>×</span>
                        <input type="number" class="set-input" placeholder="Reps" min="0" step="1">
                        <button class="remove-set-btn" onclick="templateManager.removeSet(this)" style="visibility: hidden;">×</button>
                    </div>
                </div>
            </div>
        `;
        
        exerciseList.appendChild(exerciseDiv);
    }

    addExerciseButton() {
        const exerciseList = document.getElementById('exerciseList');
        const addButton = document.createElement('button');
        addButton.className = 'add-exercise-btn';
        addButton.textContent = '+ Add Exercise';
        addButton.onclick = () => this.showAddExerciseDialog();
        exerciseList.appendChild(addButton);
    }

    showAddExerciseDialog() {
        const exerciseName = prompt('Enter exercise name:');
        if (exerciseName && exerciseName.trim()) {
            this.addExerciseToList(exerciseName.trim());
            // Re-add the add exercise button
            const existingButton = document.querySelector('.add-exercise-btn');
            if (existingButton) {
                existingButton.remove();
            }
            this.addExerciseButton();
        }
    }

    removeExercise(button) {
        const exerciseItem = button.closest('.exercise-item');
        exerciseItem.remove();
    }

    addSet(button) {
        const setsContainer = button.closest('.sets-container');
        const setsList = setsContainer.querySelector('.sets-list');
        const setCount = setsList.children.length + 1;
        
        const setRow = document.createElement('div');
        setRow.className = 'set-row fade-in';
        setRow.innerHTML = `
            <span class="set-number">${setCount}</span>
            <input type="number" class="set-input" placeholder="Weight" min="0" step="0.5">
            <span>×</span>
            <input type="number" class="set-input" placeholder="Reps" min="0" step="1">
            <button class="remove-set-btn" onclick="templateManager.removeSet(this)">×</button>
        `;
        
        setsList.appendChild(setRow);
        this.updateSetNumbers(setsList);
    }

    removeSet(button) {
        const setRow = button.closest('.set-row');
        const setsList = setRow.parentElement;
        
        if (setsList.children.length > 1) {
            setRow.remove();
            this.updateSetNumbers(setsList);
        }
    }

    updateSetNumbers(setsList) {
        const setRows = setsList.querySelectorAll('.set-row');
        setRows.forEach((row, index) => {
            const setNumber = row.querySelector('.set-number');
            setNumber.textContent = index + 1;
            
            const removeButton = row.querySelector('.remove-set-btn');
            removeButton.style.visibility = setRows.length > 1 ? 'visible' : 'hidden';
        });
    }

    showCustomTemplateCreator() {
        const creator = document.getElementById('customTemplateCreator');
        creator.style.display = creator.style.display === 'none' ? 'block' : 'none';
        
        // Clear previous inputs
        document.getElementById('customTemplateName').value = '';
        document.getElementById('customExercises').value = '';
    }

    createCustomTemplate() {
        const nameInput = document.getElementById('customTemplateName');
        const exercisesInput = document.getElementById('customExercises');
        
        const name = nameInput.value.trim();
        const exercisesText = exercisesInput.value.trim();
        
        if (!name) {
            alert('Please enter a template name');
            return;
        }
        
        if (!exercisesText) {
            alert('Please enter at least one exercise');
            return;
        }
        
        const exercises = exercisesText.split('\n')
            .map(ex => ex.trim())
            .filter(ex => ex.length > 0);
        
        if (exercises.length === 0) {
            alert('Please enter at least one exercise');
            return;
        }
        
        // Save to storage
        storageManager.addCustomTemplate(name, exercises);
        
        // Add to templates
        this.templates[name] = exercises;
        
        // Update UI
        this.updateTemplateButtons();
        
        // Hide creator
        document.getElementById('customTemplateCreator').style.display = 'none';
        
        // Select the new template
        this.selectTemplate(name);
        
        alert(`Template "${name}" created successfully!`);
    }

    getCurrentWorkoutData() {
        if (!this.currentTemplate) {
            return null;
        }

        const exerciseItems = document.querySelectorAll('.exercise-item');
        const exercises = {};

        exerciseItems.forEach(item => {
            const exerciseName = item.querySelector('.exercise-name').textContent;
            const setRows = item.querySelectorAll('.set-row');
            const sets = [];

            setRows.forEach(row => {
                const inputs = row.querySelectorAll('.set-input');
                const weight = inputs[0].value;
                const reps = inputs[1].value;
                
                if (weight || reps) {
                    sets.push({
                        weight: weight || '',
                        reps: reps || ''
                    });
                }
            });

            if (sets.length > 0) {
                exercises[exerciseName] = sets;
            }
        });

        return {
            template: this.currentTemplate,
            exercises: exercises,
            date: new Date().toISOString()
        };
    }

    resetWorkout() {
        this.currentTemplate = null;
        document.getElementById('exerciseList').innerHTML = '';
        document.getElementById('logWorkoutBtn').disabled = true;
        
        // Reset template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Hide custom template creator
        document.getElementById('customTemplateCreator').style.display = 'none';
    }
}

// Initialize template manager
window.templateManager = new TemplateManager();
