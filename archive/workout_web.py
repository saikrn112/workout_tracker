#!/usr/bin/env python3
"""
Workout Web Dashboard - Flask-based web interface
A modern web dashboard for workout data management with Google Sheets backend.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from flask import Flask, render_template_string, request, jsonify, send_file
from workout_db import WorkoutDB, WorkoutEntry

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'workout-app-secret-key-change-in-production'

# Global database instance
db = None

def get_db():
    """Get database instance with lazy initialization"""
    global db
    if db is None:
        db = WorkoutDB()
    return db

# HTML Templates (embedded for simplicity)
BASE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workout Logger - {{ title }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        }

        .header h1 {
            font-size: 2.5em;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }

        .nav {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }

        .nav a, .btn {
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            display: inline-block;
        }

        .nav a:hover, .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .btn-secondary {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
        }

        .btn-success {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
        }

        .btn-danger {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #2c3e50;
        }

        .form-group input, .form-group select, .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s;
        }

        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
        }

        .table-container {
            overflow-x: auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }

        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.95);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }

        .alert {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .alert-info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        @media (max-width: 768px) {
            .container { padding: 10px; }
            .nav { flex-direction: column; }
            .header h1 { font-size: 2em; }
            .stats-grid { grid-template-columns: 1fr; }
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💪 Workout Logger</h1>
            <p>Manage your workout data with Google Sheets backend</p>
            <div class="nav">
                <a href="/">🏠 Dashboard</a>
                <a href="/log">📝 Log Workout</a>
                <a href="/view">📊 View Data</a>
                <a href="/stats">📈 Statistics</a>
                <a href="/query">🔍 Query</a>
                <a href="/tools">🛠️ Tools</a>
            </div>
        </div>

        {% block content %}{% endblock %}
    </div>

    <script>
        // Utility functions
        function showAlert(message, type = 'info') {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.textContent = message;

            const container = document.querySelector('.container');
            container.insertBefore(alertDiv, container.children[1]);

            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }

        function showLoading(show = true) {
            let loadingDiv = document.getElementById('loading');
            if (show && !loadingDiv) {
                loadingDiv = document.createElement('div');
                loadingDiv.id = 'loading';
                loadingDiv.className = 'loading';
                loadingDiv.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
                document.body.appendChild(loadingDiv);
            } else if (!show && loadingDiv) {
                loadingDiv.remove();
            }
        }

        // Auto-submit forms with loading states
        document.addEventListener('DOMContentLoaded', function() {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                form.addEventListener('submit', function() {
                    showLoading(true);
                });
            });
        });
    </script>
</body>
</html>
"""

DASHBOARD_TEMPLATE = BASE_TEMPLATE.replace(
    '{% block content %}{% endblock %}',
    """
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">{{ stats.total_workouts }}</div>
            <div class="stat-label">Total Workouts</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{{ stats.total_sets }}</div>
            <div class="stat-label">Total Sets</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{{ "{:,.0f}".format(stats.total_volume) }}</div>
            <div class="stat-label">Total Volume (lbs)</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{{ stats.unique_exercises }}</div>
            <div class="stat-label">Unique Exercises</div>
        </div>
    </div>

    <div class="card">
        <h2>🗓️ Recent Workouts</h2>
        {% if recent_workouts %}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Template</th>
                            <th>Exercise</th>
                            <th>Set</th>
                            <th>Weight</th>
                            <th>Reps</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for entry in recent_workouts %}
                        <tr>
                            <td>{{ entry.date }}</td>
                            <td>{{ entry.template }}</td>
                            <td>{{ entry.exercise }}</td>
                            <td>{{ entry.set_number }}</td>
                            <td>{{ entry.weight or '' }}</td>
                            <td>{{ entry.reps or '' }}</td>
                            <td>{{ entry.notes or '' }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        {% else %}
            <p>No workout data found. <a href="/log">Log your first workout!</a></p>
        {% endif %}
    </div>

    <div class="card">
        <h2>🔗 Quick Links</h2>
        <div class="nav">
            <a href="{{ spreadsheet_url }}" target="_blank">📊 View Google Sheet</a>
            <a href="/backup">💾 Backup Data</a>
            <a href="/api/stats">📋 API Stats</a>
        </div>
    </div>
    """
)

@app.route('/')
def dashboard():
    """Main dashboard"""
    try:
        db = get_db()
        stats = db.get_stats()

        # Get recent workouts (last 20 entries)
        recent_workouts = db.select(order_by="date DESC", limit=20)

        return render_template_string(
            DASHBOARD_TEMPLATE,
            title="Dashboard",
            stats=stats,
            recent_workouts=recent_workouts,
            spreadsheet_url=db.get_spreadsheet_url()
        )
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return f"Error loading dashboard: {e}", 500

@app.route('/log', methods=['GET', 'POST'])
def log_workout():
    """Log workout page"""
    if request.method == 'POST':
        try:
            db = get_db()

            # Parse form data
            entries = []

            # Handle single entry or multiple entries
            if 'exercises' in request.form:
                # Multiple exercises (JSON format from advanced form)
                exercises_data = json.loads(request.form['exercises'])

                for exercise_data in exercises_data:
                    for i, set_data in enumerate(exercise_data['sets'], 1):
                        entry = WorkoutEntry(
                            date=request.form['date'],
                            template=request.form['template'],
                            exercise=exercise_data['name'],
                            set_number=i,
                            weight=float(set_data['weight']) if set_data['weight'] else None,
                            reps=int(set_data['reps']) if set_data['reps'] else None,
                            notes=set_data.get('notes')
                        )
                        entries.append(entry)
            else:
                # Single entry (simple form)
                entry = WorkoutEntry(
                    date=request.form['date'],
                    template=request.form['template'],
                    exercise=request.form['exercise'],
                    set_number=int(request.form['set_number']),
                    weight=float(request.form['weight']) if request.form['weight'] else None,
                    reps=int(request.form['reps']) if request.form['reps'] else None,
                    notes=request.form['notes'] if request.form['notes'] else None
                )
                entries.append(entry)

            # Insert entries
            if entries:
                count = db.insert(entries)
                return render_template_string(
                    BASE_TEMPLATE.replace(
                        '{% block content %}{% endblock %}',
                        f'<div class="alert alert-success">✅ Successfully logged {count} sets!</div>'
                        '<div class="card"><h2>What\'s next?</h2>'
                        '<div class="nav">'
                        '<a href="/log">Log Another Workout</a>'
                        '<a href="/view">View All Data</a>'
                        '<a href="/">Back to Dashboard</a>'
                        '</div></div>'
                    ),
                    title="Workout Logged"
                )

        except Exception as e:
            logger.error(f"Log workout error: {e}")
            return render_template_string(
                BASE_TEMPLATE.replace(
                    '{% block content %}{% endblock %}',
                    f'<div class="alert alert-error">❌ Error logging workout: {e}</div>'
                ),
                title="Error"
            ), 400

    # GET request - show form
    log_form = """
    <div class="card">
        <h2>📝 Log Workout</h2>
        <form method="POST">
            <div class="form-group">
                <label for="date">Date:</label>
                <input type="date" id="date" name="date" value="{{ today }}" required>
            </div>

            <div class="form-group">
                <label for="template">Workout Template:</label>
                <input type="text" id="template" name="template" placeholder="e.g., Upper 1, Lower 2" required>
            </div>

            <div class="form-group">
                <label for="exercise">Exercise:</label>
                <input type="text" id="exercise" name="exercise" placeholder="e.g., Bench Press, Squat" required>
            </div>

            <div class="form-group">
                <label for="set_number">Set Number:</label>
                <input type="number" id="set_number" name="set_number" value="1" min="1" required>
            </div>

            <div class="form-group">
                <label for="weight">Weight (lbs):</label>
                <input type="number" id="weight" name="weight" step="0.1" placeholder="135">
            </div>

            <div class="form-group">
                <label for="reps">Reps:</label>
                <input type="number" id="reps" name="reps" placeholder="8">
            </div>

            <div class="form-group">
                <label for="notes">Notes (optional):</label>
                <textarea id="notes" name="notes" rows="2" placeholder="Felt strong, good form"></textarea>
            </div>

            <button type="submit" class="btn btn-success">💾 Log Set</button>
        </form>
    </div>

    <div class="card">
        <h3>💡 Pro Tips</h3>
        <ul>
            <li>Log each set individually for detailed tracking</li>
            <li>Use consistent exercise names for better analytics</li>
            <li>Notes help track form, RPE, and progress</li>
            <li>Template names help organize your split routine</li>
        </ul>
    </div>
    """

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', log_form),
        title="Log Workout",
        today=datetime.now().strftime('%Y-%m-%d')
    )

@app.route('/view')
def view_data():
    """View all workout data"""
    try:
        db = get_db()

        # Get filter parameters
        exercise_filter = request.args.get('exercise', '')
        template_filter = request.args.get('template', '')
        limit = int(request.args.get('limit', 100))

        # Build where clause
        where = {}
        if exercise_filter:
            where['exercise'] = exercise_filter
        if template_filter:
            where['template'] = template_filter

        # Get filtered data
        entries = db.select(
            where=where if where else None,
            order_by="date DESC",
            limit=limit
        )

        # Get unique exercises and templates for filters
        all_entries = db.select()
        unique_exercises = sorted(set(e.exercise for e in all_entries if e.exercise))
        unique_templates = sorted(set(e.template for e in all_entries if e.template))

        view_template = """
        <div class="card">
            <h2>📊 Workout Data</h2>

            <form method="GET" style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <div class="form-group">
                        <label for="exercise">Filter by Exercise:</label>
                        <select id="exercise" name="exercise">
                            <option value="">All Exercises</option>
                            {% for exercise in unique_exercises %}
                            <option value="{{ exercise }}" {% if exercise == exercise_filter %}selected{% endif %}>{{ exercise }}</option>
                            {% endfor %}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="template">Filter by Template:</label>
                        <select id="template" name="template">
                            <option value="">All Templates</option>
                            {% for template in unique_templates %}
                            <option value="{{ template }}" {% if template == template_filter %}selected{% endif %}>{{ template }}</option>
                            {% endfor %}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="limit">Limit Results:</label>
                        <select id="limit" name="limit">
                            <option value="50" {% if limit == 50 %}selected{% endif %}>50</option>
                            <option value="100" {% if limit == 100 %}selected{% endif %}>100</option>
                            <option value="200" {% if limit == 200 %}selected{% endif %}>200</option>
                            <option value="500" {% if limit == 500 %}selected{% endif %}>500</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>&nbsp;</label>
                        <button type="submit" class="btn">🔍 Filter</button>
                    </div>
                </div>
            </form>

            {% if entries %}
                <p><strong>Showing {{ entries|length }} entries</strong></p>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Template</th>
                                <th>Exercise</th>
                                <th>Set</th>
                                <th>Weight</th>
                                <th>Reps</th>
                                <th>Volume</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for entry in entries %}
                            <tr>
                                <td>{{ entry.date }}</td>
                                <td>{{ entry.template }}</td>
                                <td>{{ entry.exercise }}</td>
                                <td>{{ entry.set_number }}</td>
                                <td>{{ entry.weight or '-' }}</td>
                                <td>{{ entry.reps or '-' }}</td>
                                <td>
                                    {% if entry.weight and entry.reps %}
                                        {{ (entry.weight * entry.reps)|round(1) }}
                                    {% else %}
                                        -
                                    {% endif %}
                                </td>
                                <td>{{ entry.notes or '' }}</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            {% else %}
                <div class="alert alert-info">No entries found matching your criteria.</div>
            {% endif %}
        </div>
        """

        return render_template_string(
            BASE_TEMPLATE.replace('{% block content %}{% endblock %}', view_template),
            title="View Data",
            entries=entries,
            unique_exercises=unique_exercises,
            unique_templates=unique_templates,
            exercise_filter=exercise_filter,
            template_filter=template_filter,
            limit=limit
        )

    except Exception as e:
        logger.error(f"View data error: {e}")
        return f"Error loading data: {e}", 500

@app.route('/stats')
def stats():
    """Statistics page"""
    try:
        db = get_db()
        stats = db.get_stats()

        stats_template = """
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{{ stats.total_workouts }}</div>
                <div class="stat-label">Total Workouts</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ stats.total_sets }}</div>
                <div class="stat-label">Total Sets</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ "{:,.0f}".format(stats.total_volume) }}</div>
                <div class="stat-label">Total Volume (lbs)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{{ stats.unique_exercises }}</div>
                <div class="stat-label">Unique Exercises</div>
            </div>
        </div>

        {% if stats.date_range.earliest %}
        <div class="card">
            <h2>📅 Date Range</h2>
            <p><strong>First Workout:</strong> {{ stats.date_range.earliest }}</p>
            <p><strong>Latest Workout:</strong> {{ stats.date_range.latest }}</p>
        </div>
        {% endif %}

        <div class="card">
            <h2>🏋️ Exercise Breakdown</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Exercise</th>
                            <th>Total Sets</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for exercise, count in exercise_breakdown %}
                        <tr>
                            <td>{{ exercise }}</td>
                            <td>{{ count }}</td>
                            <td>{{ "%.1f"|format((count / stats.total_sets * 100)) }}%</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <h2>📋 Template Breakdown</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Total Sets</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for template, count in template_breakdown %}
                        <tr>
                            <td>{{ template }}</td>
                            <td>{{ count }}</td>
                            <td>{{ "%.1f"|format((count / stats.total_sets * 100)) }}%</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
        """

        # Sort exercise and template breakdowns
        exercise_breakdown = sorted(stats['exercise_breakdown'].items(), key=lambda x: x[1], reverse=True)
        template_breakdown = sorted(stats['template_breakdown'].items(), key=lambda x: x[1], reverse=True)

        return render_template_string(
            BASE_TEMPLATE.replace('{% block content %}{% endblock %}', stats_template),
            title="Statistics",
            stats=stats,
            exercise_breakdown=exercise_breakdown,
            template_breakdown=template_breakdown
        )

    except Exception as e:
        logger.error(f"Stats error: {e}")
        return f"Error loading statistics: {e}", 500

@app.route('/query', methods=['GET', 'POST'])
def query():
    """Advanced query interface"""
    results = None
    error = None

    if request.method == 'POST':
        try:
            db = get_db()

            # Build where clause from form
            where = {}

            if request.form.get('exercise'):
                where['exercise'] = request.form['exercise']

            if request.form.get('template'):
                where['template'] = request.form['template']

            if request.form.get('date_from'):
                where['date'] = {"operator": ">=", "value": request.form['date_from']}

            if request.form.get('min_weight'):
                where['weight'] = {"operator": ">=", "value": float(request.form['min_weight'])}

            if request.form.get('min_reps'):
                where['reps'] = {"operator": ">=", "value": int(request.form['min_reps'])}

            # Execute query
            results = db.select(
                where=where if where else None,
                order_by=request.form.get('order_by', 'date DESC'),
                limit=int(request.form.get('limit', 100))
            )

        except Exception as e:
            error = str(e)
            logger.error(f"Query error: {e}")

    query_template = """
    <div class="card">
        <h2>🔍 Advanced Query</h2>

        {% if error %}
        <div class="alert alert-error">❌ Query Error: {{ error }}</div>
        {% endif %}

        <form method="POST">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div class="form-group">
                    <label for="exercise">Exercise:</label>
                    <input type="text" id="exercise" name="exercise" placeholder="e.g., Bench Press">
                </div>

                <div class="form-group">
                    <label for="template">Template:</label>
                    <input type="text" id="template" name="template" placeholder="e.g., Upper 1">
                </div>

                <div class="form-group">
                    <label for="date_from">Date From:</label>
                    <input type="date" id="date_from" name="date_from">
                </div>

                <div class="form-group">
                    <label for="min_weight">Min Weight:</label>
                    <input type="number" id="min_weight" name="min_weight" step="0.1" placeholder="135">
                </div>

                <div class="form-group">
                    <label for="min_reps">Min Reps:</label>
                    <input type="number" id="min_reps" name="min_reps" placeholder="5">
                </div>

                <div class="form-group">
                    <label for="order_by">Order By:</label>
                    <select id="order_by" name="order_by">
                        <option value="date DESC">Date (Newest First)</option>
                        <option value="date ASC">Date (Oldest First)</option>
                        <option value="weight DESC">Weight (Heaviest First)</option>
                        <option value="weight ASC">Weight (Lightest First)</option>
                        <option value="exercise ASC">Exercise (A-Z)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="limit">Limit:</label>
                    <select id="limit" name="limit">
                        <option value="50">50</option>
                        <option value="100" selected>100</option>
                        <option value="200">200</option>
                        <option value="500">500</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>&nbsp;</label>
                    <button type="submit" class="btn">🔍 Query</button>
                </div>
            </div>
        </form>
    </div>

    {% if results is not none %}
    <div class="card">
        <h3>📊 Query Results ({{ results|length }} entries)</h3>

        {% if results %}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Template</th>
                            <th>Exercise</th>
                            <th>Set</th>
                            <th>Weight</th>
                            <th>Reps</th>
                            <th>Volume</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for entry in results %}
                        <tr>
                            <td>{{ entry.date }}</td>
                            <td>{{ entry.template }}</td>
                            <td>{{ entry.exercise }}</td>
                            <td>{{ entry.set_number }}</td>
                            <td>{{ entry.weight or '-' }}</td>
                            <td>{{ entry.reps or '-' }}</td>
                            <td>
                                {% if entry.weight and entry.reps %}
                                    {{ (entry.weight * entry.reps)|round(1) }}
                                {% else %}
                                    -
                                {% endif %}
                            </td>
                            <td>{{ entry.notes or '' }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        {% else %}
            <div class="alert alert-info">No results found matching your criteria.</div>
        {% endif %}
    </div>
    {% endif %}
    """

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', query_template),
        title="Query",
        results=results,
        error=error
    )

@app.route('/tools')
def tools():
    """Tools and utilities page"""
    tools_template = """
    <div class="card">
        <h2>🛠️ Tools & Utilities</h2>
        <p>Manage your workout data with these helpful tools.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <div class="card">
            <h3>💾 Backup & Restore</h3>
            <p>Create backups of your workout data or restore from previous backups.</p>
            <div class="nav">
                <a href="/backup" class="btn btn-success">Create Backup</a>
                <a href="/restore" class="btn btn-secondary">Restore Data</a>
            </div>
        </div>

        <div class="card">
            <h3>📊 Export Data</h3>
            <p>Export your workout data in various formats.</p>
            <div class="nav">
                <a href="/api/export/csv" class="btn">📄 Export CSV</a>
                <a href="/api/export/json" class="btn">📋 Export JSON</a>
            </div>
        </div>

        <div class="card">
            <h3>🔗 External Links</h3>
            <p>Quick access to external tools and resources.</p>
            <div class="nav">
                <a href="{{ spreadsheet_url }}" target="_blank" class="btn">📊 Google Sheet</a>
                <a href="/api/stats" class="btn">📋 API Stats</a>
            </div>
        </div>

        <div class="card">
            <h3>🏆 Personal Records</h3>
            <p>Find your personal records by exercise.</p>
            <div class="nav">
                <a href="/pr" class="btn">🏆 View PRs</a>
            </div>
        </div>
    </div>
    """

    try:
        db = get_db()
        spreadsheet_url = db.get_spreadsheet_url()
    except:
        spreadsheet_url = "#"

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', tools_template),
        title="Tools",
        spreadsheet_url=spreadsheet_url
    )

@app.route('/backup')
def backup():
    """Create data backup"""
    try:
        db = get_db()
        filename = db.backup_to_json()

        return send_file(
            filename,
            as_attachment=True,
            download_name=f"workout_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )

    except Exception as e:
        logger.error(f"Backup error: {e}")
        return f"Backup failed: {e}", 500

# API Endpoints
@app.route('/api/stats')
def api_stats():
    """API endpoint for statistics"""
    try:
        db = get_db()
        stats = db.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export/csv')
def api_export_csv():
    """Export data as CSV"""
    try:
        db = get_db()
        entries = db.select()

        # Create CSV content
        import io
        output = io.StringIO()
        output.write("Date,Template,Exercise,Set,Weight,Reps,Notes\n")

        for entry in entries:
            row = entry.to_row()
            output.write(",".join(f'"{field}"' for field in row) + "\n")

        # Create response
        from flask import Response
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={"Content-Disposition": f"attachment; filename=workout_data_{datetime.now().strftime('%Y%m%d')}.csv"}
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export/json')
def api_export_json():
    """Export data as JSON"""
    try:
        db = get_db()
        entries = db.select()

        data = {
            "export_timestamp": datetime.now().isoformat(),
            "total_entries": len(entries),
            "entries": [entry.__dict__ for entry in entries]
        }

        from flask import Response
        return Response(
            json.dumps(data, indent=2),
            mimetype='application/json',
            headers={"Content-Disposition": f"attachment; filename=workout_data_{datetime.now().strftime('%Y%m%d')}.json"}
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Workout Web Dashboard...")
    print("📊 Open http://localhost:8010 in your browser")
    app.run(debug=True, host='0.0.0.0', port=8010)