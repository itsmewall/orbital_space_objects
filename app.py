from flask import Flask, jsonify, render_template, request, send_file
import numpy as np
from math import pi, sqrt, sin, cos, atan2
import matplotlib.pyplot as plt
import io

# Constantes
MU = 3.986004418e14        # Constante gravitacional da Terra (m³/s²)
EARTH_RADIUS = 6378.137e3  # Raio equatorial da Terra (m)

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/physics")
def physics():
    return render_template("physics.html")

@app.route("/calculate_satellite_parameters", methods=["POST"])
def calculate_satellite_parameters():
    try:
        data = request.json
        mass = float(data.get("mass", 0))  # Massa em kg
        altitude = float(data.get("altitude", 0)) * 1000  # Altitude em metros
        eccentricity = float(data.get("eccentricity", 0))
        inclination = float(data.get("inclination", 0))

        # Raio orbital médio
        semi_major_axis = EARTH_RADIUS + altitude
        velocity = sqrt(MU / semi_major_axis)

        # Energias específicas
        potential_energy_specific = -MU / semi_major_axis
        kinetic_energy_specific = velocity**2 / 2
        total_energy_specific = kinetic_energy_specific + potential_energy_specific

        # Período orbital
        period = 2 * pi * sqrt(semi_major_axis**3 / MU)

        # Apogeu e Perigeu
        if eccentricity > 0:
            apogee = semi_major_axis * (1 + eccentricity) - EARTH_RADIUS
            perigee = semi_major_axis * (1 - eccentricity) - EARTH_RADIUS
        else:
            apogee = altitude
            perigee = altitude

        # Verificação de estabilidade
        if perigee < 0:
            stability = "Órbita Inválida - Perigeu abaixo da superfície terrestre"
        elif altitude < 160e3:
            stability = "Degradante - Altitude muito baixa"
        else:
            stability = "Estável"

        # Dados para gráficos
        angles = np.linspace(0, 2 * pi, 1000)
        radii = semi_major_axis * (1 - eccentricity**2) / (1 + eccentricity * np.cos(angles))
        velocities = np.sqrt(MU * (2 / radii - 1 / semi_major_axis))
        potential_energies = -MU / radii
        kinetic_energies = velocities**2 / 2
        total_energies = potential_energies + kinetic_energies

        # Cálculo da ground track
        longitudes = []
        latitudes = []
        time_step = period / 1000  # Passo de tempo para 1000 pontos

        for step in range(1000):
            true_anomaly = angles[step]
            r = radii[step]
            x = r * np.cos(true_anomaly)
            y = r * np.sin(true_anomaly)

            # Latitude e Longitude (simplificação para órbita circular)
            latitude = np.degrees(np.arcsin(np.sin(np.radians(inclination)) * np.sin(true_anomaly)))
            longitude = (step * time_step * 360 / period) % 360 - 180  # Em graus
            latitudes.append(latitude)
            longitudes.append(longitude)

        results = {
            "velocity": velocity,
            "potential_energy_specific": potential_energy_specific,
            "kinetic_energy_specific": kinetic_energy_specific,
            "total_energy_specific": total_energy_specific,
            "period": period,
            "apogee": apogee / 1000,  # metros -> km
            "perigee": perigee / 1000,  # metros -> km
            "stability": stability,
            "graphs": {
                "angles": angles.tolist(),
                "radii": radii.tolist(),
                "velocities": velocities.tolist(),
                "potential_energies": potential_energies.tolist(),
                "kinetic_energies": kinetic_energies.tolist(),
                "total_energies": total_energies.tolist(),
                "orbit_x": (radii * np.cos(angles) / 1000).tolist(),  # km
                "orbit_y": (radii * np.sin(angles) / 1000).tolist(),  # km
                "latitudes": latitudes,
                "longitudes": longitudes,
            },
        }
        return jsonify({"results": results})

    except Exception as e:
        print(f"Erro ao calcular parâmetros físicos: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/generate_energy_plot")
def generate_energy_plot():
    # Exemplo de dados para o gráfico
    angles = np.linspace(0, 2 * pi, 1000)
    radii = EARTH_RADIUS + 500e3 * (1 - 0.01**2) / (1 + 0.01 * np.cos(angles))
    velocities = np.sqrt(MU * (2 / radii - 1 / (EARTH_RADIUS + 500e3)))
    potential_energies = -MU / radii
    kinetic_energies = velocities**2 / 2
    total_energies = potential_energies + kinetic_energies

    plt.figure(figsize=(10, 6))
    plt.plot(angles * 180 / pi, potential_energies, label="Potencial")
    plt.plot(angles * 180 / pi, kinetic_energies, label="Cinética")
    plt.plot(angles * 180 / pi, total_energies, label="Total", linestyle="--")
    plt.xlabel("Ângulo Orbital (°)")
    plt.ylabel("Energia Específica (J/kg)")
    plt.title("Distribuição de Energia na Órbita")
    plt.legend()
    plt.grid()

    img = io.BytesIO()
    plt.savefig(img, format="png")
    img.seek(0)
    plt.close()

    return send_file(img, mimetype="image/png")

if __name__ == "__main__":
    app.run(debug=True)
