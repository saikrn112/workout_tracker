// Exercise management and database for the Workout Logger app
class ExerciseManager {
    constructor() {
        this.exerciseDatabase = {
            // Upper body exercises
            'Bench Press': { category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
            'Incline Dumbbell Press': { category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
            'Dumbbell Flyes': { category: 'chest', muscleGroups: ['chest'] },
            'Push-ups': { category: 'chest', muscleGroups: ['chest', 'triceps', 'shoulders'] },
            
            'Bent Over Row': { category: 'back', muscleGroups: ['back', 'biceps'] },
            'Cable Row': { category: 'back', muscleGroups: ['back', 'biceps'] },
            'Pull-ups/Lat Pulldown': { category: 'back', muscleGroups: ['back', 'biceps'] },
            'Face Pulls': { category: 'back', muscleGroups: ['rear delts', 'rhomboids'] },
            
            'Overhead Press': { category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
            'Dumbbell Shoulder Press': { category: 'shoulders', muscleGroups: ['shoulders', 'triceps'] },
            'Lateral Raises': { category: 'shoulders', muscleGroups: ['shoulders'] },
            'Rear Delt Flyes': { category: 'shoulders', muscleGroups: ['rear delts'] },
            
            'Barbell Curls': { category: 'biceps', muscleGroups: ['biceps'] },
            'Hammer Curls': { category: 'biceps', muscleGroups: ['biceps', 'forearms'] },
            'Preacher Curls': { category: 'biceps', muscleGroups: ['biceps'] },
            
            'Close Grip Bench Press': { category: 'triceps', muscleGroups: ['triceps', 'chest'] },
            'Tricep Extensions': { category: 'triceps', muscleGroups: ['triceps'] },
            'Dips': { category: 'triceps', muscleGroups: ['triceps', 'chest'] },
            
            // Lower body exercises
            'Squats': { category: 'legs', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
            'Front Squats': { category: 'legs', muscleGroups: ['quads', 'glutes', 'core'] },
            'Bulgarian Split Squats': { category: 'legs', muscleGroups: ['quads', 'glutes'] },
            'Walking Lunges': { category: 'legs', muscleGroups: ['quads', 'glutes', 'hamstrings'] },
            'Step-ups': { category: 'legs', muscleGroups: ['quads', 'glutes'] },
            
            'Deadlifts': { category: 'legs', muscleGroups: ['hamstrings', 'glutes', 'back'] },
            'Romanian Deadlifts': { category: 'legs', muscleGroups: ['hamstrings', 'glutes'] },
            'Leg Curls': { category: 'legs', muscleGroups: ['hamstrings'] },
            
            'Hip Thrusts': { category: 'glutes', muscleGroups: ['glutes', 'hamstrings'] },
            'Glute Bridges': { category: 'glutes', muscleGroups: ['glutes'] },
            
            'Leg Press': { category: 'legs', muscleGroups: ['quads', 'glutes'] },
            'Leg Extensions': { category: 'legs', muscleGroups: ['quads'] },
            
            'Calf Raises': { category: 'calves', muscleGroups: ['calves'] },
            'Standing Calf Raises': { category: 'calves', muscleGroups: ['calves'] },
            
            // Core exercises
            'Plank': { category: 'core', muscleGroups: ['core'] },
            'Russian Twists': { category: 'core', muscleGroups: ['core', 'obliques'] },
            'Dead Bug': { category: 'core', muscleGroups: ['core'] },
            'Mountain Climbers': { category: 'core', muscleGroups: ['core', 'shoulders'] }
        };
        
        this.categories = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'calves', 'core'];
    }

    searchExercises(query, category = null) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        Object.entries(this.exerciseDatabase).forEach(([name, data]) => {
            const matchesQuery = name.toLowerCase().includes(lowerQuery) || 
                                data.muscleGroups.some(muscle => muscle.toLowerCase().includes(lowerQuery));
            const matchesCategory = !category || data.category === category;

            if (matchesQuery && matchesCategory) {
                results.push({ name, ...data });
            }
        });

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    getExercisesByCategory(category) {
        return Object.entries(this.exerciseDatabase)
            .filter(([name, data]) => data.category === category)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    addCustomExercise(name, category, muscleGroups) {
        if (!name || !category) {
            throw new Error('Exercise name and category are required');
        }

        this.exerciseDatabase[name] = {
            category: category,
            muscleGroups: muscleGroups || [category],
            custom: true
        };

        // Save to localStorage for persistence
        this.saveCustomExercises();
        return true;
    }

    removeCustomExercise(name) {
        if (this.exerciseDatabase[name] && this.exerciseDatabase[name].custom) {
            delete this.exerciseDatabase[name];
            this.saveCustomExercises();
            return true;
        }
        return false;
    }

    saveCustomExercises() {
        const customExercises = {};
        Object.entries(this.exerciseDatabase).forEach(([name, data]) => {
            if (data.custom) {
                customExercises[name] = data;
            }
        });
        storageManager.save('customExercises', customExercises);
    }

    loadCustomExercises() {
        const customExercises = storageManager.load('customExercises', {});
        Object.assign(this.exerciseDatabase, customExercises);
    }

    getExerciseInfo(name) {
        return this.exerciseDatabase[name] || null;
    }

    getAllExercises() {
        return Object.keys(this.exerciseDatabase).sort();
    }

    // Calculate 1RM using Epley formula
    calculateOneRepMax(weight, reps) {
        if (!weight || !reps || reps <= 0) return 0;
        if (reps === 1) return weight;
        return Math.round(weight * (1 + reps / 30));
    }

    // Calculate volume (sets × reps × weight)
    calculateVolume(sets) {
        return sets.reduce((total, set) => {
            const weight = parseFloat(set.weight) || 0;
            const reps = parseInt(set.reps) || 0;
            return total + (weight * reps);
        }, 0);
    }

    // Get exercise statistics from workout history
    getExerciseStats(exerciseName, workoutHistory) {
        const exerciseData = [];
        
        workoutHistory.forEach(workout => {
            if (workout.exercises && workout.exercises[exerciseName]) {
                const sets = workout.exercises[exerciseName];
                sets.forEach((set, index) => {
                    exerciseData.push({
                        date: workout.date,
                        template: workout.template,
                        setNumber: index + 1,
                        weight: parseFloat(set.weight) || 0,
                        reps: parseInt(set.reps) || 0,
                        oneRM: this.calculateOneRepMax(parseFloat(set.weight) || 0, parseInt(set.reps) || 0)
                    });
                });
            }
        });

        return exerciseData.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Get progression data for an exercise
    getProgressionData(exerciseName, workoutHistory) {
        const stats = this.getExerciseStats(exerciseName, workoutHistory);
        const progressionData = [];

        // Group by date and calculate max values
        const dateGroups = {};
        stats.forEach(stat => {
            const date = stat.date.split('T')[0]; // Get date part only
            if (!dateGroups[date]) {
                dateGroups[date] = {
                    date: date,
                    maxWeight: 0,
                    maxReps: 0,
                    maxOneRM: 0,
                    totalVolume: 0
                };
            }
            
            dateGroups[date].maxWeight = Math.max(dateGroups[date].maxWeight, stat.weight);
            dateGroups[date].maxReps = Math.max(dateGroups[date].maxReps, stat.reps);
            dateGroups[date].maxOneRM = Math.max(dateGroups[date].maxOneRM, stat.oneRM);
            dateGroups[date].totalVolume += stat.weight * stat.reps;
        });

        return Object.values(dateGroups).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Suggest next workout weights based on progression
    suggestNextWeight(exerciseName, workoutHistory, targetReps = 8) {
        const progressionData = this.getProgressionData(exerciseName, workoutHistory);
        
        if (progressionData.length === 0) {
            return { suggested: 0, reason: 'No previous data' };
        }

        const lastWorkout = progressionData[progressionData.length - 1];
        const lastWeight = lastWorkout.maxWeight;
        
        if (progressionData.length === 1) {
            return { 
                suggested: lastWeight, 
                reason: 'Use same weight as last time' 
            };
        }

        // Calculate progression rate
        const recentWorkouts = progressionData.slice(-3); // Last 3 workouts
        const weightIncrease = recentWorkouts[recentWorkouts.length - 1].maxWeight - recentWorkouts[0].maxWeight;
        const workoutSpan = recentWorkouts.length - 1;
        
        if (workoutSpan > 0) {
            const avgIncrease = weightIncrease / workoutSpan;
            const suggestedWeight = lastWeight + Math.max(2.5, avgIncrease); // Minimum 2.5 increase
            
            return {
                suggested: Math.round(suggestedWeight * 2) / 2, // Round to nearest 0.5
                reason: `Based on recent progression (+${avgIncrease.toFixed(1)} per workout)`
            };
        }

        return { 
            suggested: lastWeight + 2.5, 
            reason: 'Standard progression (+2.5)' 
        };
    }
}

// Initialize exercise manager
window.exerciseManager = new ExerciseManager();

// Load custom exercises on initialization
window.exerciseManager.loadCustomExercises();
