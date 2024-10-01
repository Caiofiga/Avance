from flask import Flask, request, session, jsonify
import tempfile
from bokeh.plotting import figure
from bokeh.io import export_svg
import os
from selenium import webdriver
from selenium.webdriver.firefox.service import Service


app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Replace with a secure key

# Sample Bokeh plot
p = figure(title="Simple Line Plot", x_axis_label='X', y_axis_label='Y')
p.line([1, 2, 3, 4, 5], [6, 7, 2, 4, 5], line_width=2)


@app.route('/save_score', methods=['POST'])
def save_score():
    if request.method == 'POST':
        if 'name' not in session:
            session['name'] = request.form['name']
            # Simulate creating a snapshot of the graph and restarting
            with tempfile.NamedTemporaryFile(suffix='.svg', dir='.') as f:
                filename = f.name
                export_svg(p, filename=filename)  # Save the plot as an SVG
                print(f"Graph snapshot saved at: {filename}")

            return jsonify({"message": "Score saved and graph snapshot taken!"})
    return jsonify({"message": "Failed to save score!"})

# Test route to simulate form submission


@app.route('/test_save_score', methods=['GET'])
def test_save_score():
    return '''
        <form method="post" action="/save_score">
            <input type="text" name="name" placeholder="Enter your name" required>
            <button type="submit">Save Score</button>
        </form>
    '''


if __name__ == '__main__':
    # Create 'temp' directory if it doesn't exist
    if not os.path.exists('temp'):
        os.mkdir('temp')

    app.run(debug=True)
