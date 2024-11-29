# app.py

from flask import Flask, jsonify, render_template, request
import os
import numpy as np
from orbit_calculation import calculate_orbit

app = Flask(__name__)

# Rota principal para servir a página HTML
@app.route('/')
def index():
    return render_template('index.html')

# Endpoint para calcular a órbita
@app.route('/calculate_orbit', methods=['POST'])
def calculate_orbit_endpoint():
    data = request.json
    try:
        semi_major_axis = float(data['semiMajorAxis']) * 1000  # km para metros
        eccentricity = float(data['eccentricity'])
        inclination = np.radians(float(data['inclination']))   # graus para radianos
        raan = np.radians(float(data['raan']))                 # graus para radianos
        arg_periapsis = np.radians(float(data['argPeriapsis'])) # graus para radianos
        mean_anomaly = np.radians(float(data['meanAnomaly']))  # graus para radianos

        launch_latitude = np.radians(float(data.get('launchLatitude', 0.0)))  # graus para radianos
        launch_longitude = np.radians(float(data.get('launchLongitude', 0.0)))  # graus para radianos

        positions = calculate_orbit(
            semi_major_axis=semi_major_axis,
            eccentricity=eccentricity,
            inclination=inclination,
            raan=raan,
            arg_periapsis=arg_periapsis,
            mean_anomaly_at_epoch=mean_anomaly,
            launch_latitude=launch_latitude,
            launch_longitude=launch_longitude
        )

        return jsonify({"positions": positions})

    except Exception as e:
        print(f"Erro ao calcular a órbita: {e}")
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
