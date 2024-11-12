import numpy as np
import json
from math import pi, sin, cos, sqrt
from scipy.optimize import newton

# Constante gravitacional da Terra (m³/s²)
MU = 3.986004418e14

# Função para resolver a Equação de Kepler e encontrar a anomalia verdadeira
def solve_kepler(eccentric_anomaly, eccentricity):
    return eccentric_anomaly - eccentricity * sin(eccentric_anomaly)

# Função para calcular posições em uma órbita elíptica usando física orbital
def calculate_orbit(semi_major_axis, eccentricity, inclination, raan, arg_periapsis, num_points=1000):
    # Período orbital usando a terceira lei de Kepler
    period = 2 * pi * sqrt(semi_major_axis**3 / MU)

    # Dividir o período em pontos iguais
    time_points = np.linspace(0, period, num_points)
    
    positions = []

    for time in time_points:
        # Calcula a anomalia média
        mean_anomaly = (2 * pi * time) / period

        # Usa a Equação de Kepler para resolver a anomalia excêntrica
        eccentric_anomaly = newton(solve_kepler, mean_anomaly, args=(eccentricity,))

        # Calcula a anomalia verdadeira a partir da anomalia excêntrica
        true_anomaly = 2 * np.arctan2(
            sqrt(1 + eccentricity) * sin(eccentric_anomaly / 2),
            sqrt(1 - eccentricity) * cos(eccentric_anomaly / 2)
        )

        # Distância radial da órbita para o ponto atual
        r = semi_major_axis * (1 - eccentricity * cos(eccentric_anomaly))

        # Coordenadas no plano orbital (2D)
        x_orbit = r * cos(true_anomaly)
        y_orbit = r * sin(true_anomaly)
        z_orbit = 0

        # Aplicando as rotações para obter coordenadas em 3D
        cos_raan = cos(raan)
        sin_raan = sin(raan)
        cos_i = cos(inclination)
        sin_i = sin(inclination)
        cos_arg_periapsis = cos(arg_periapsis)
        sin_arg_periapsis = sin(arg_periapsis)

        # Matriz de rotação
        rotation_matrix = np.array([
            [cos_raan * cos_arg_periapsis - sin_raan * sin_arg_periapsis * cos_i, -cos_raan * sin_arg_periapsis - sin_raan * cos_arg_periapsis * cos_i, sin_raan * sin_i],
            [sin_raan * cos_arg_periapsis + cos_raan * sin_arg_periapsis * cos_i, -sin_raan * sin_arg_periapsis + cos_raan * cos_arg_periapsis * cos_i, -cos_raan * sin_i],
            [sin_arg_periapsis * sin_i, cos_arg_periapsis * sin_i, cos_i]
        ])

        # Vetor da posição no plano orbital
        position_orbit = np.array([x_orbit, y_orbit, z_orbit])
        # Aplica a rotação para obter a posição em coordenadas 3D
        position_eci = rotation_matrix.dot(position_orbit)
        
        # Adiciona a posição ao array de posições
        positions.append({
            "x": float(position_eci[0]),
            "y": float(position_eci[1]),
            "z": float(position_eci[2])
        })

    return positions

# Função para salvar os dados da órbita e informações do satélite em JSON
def save_orbit_json(positions, name, description, model_type, filename="satellite_data.json"):
    data = {
        "satellite": {
            "name": name,
            "description": description,
            "orbitalParameters": {
                "positions": positions
            },
            "modelType": model_type
        }
    }

    # Salva em JSON
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Dados do satélite salvos em '{filename}'.")

# Parâmetros orbitais de exemplo
semi_major_axis = 7000e3  # em metros
eccentricity = 0.001
inclination = np.radians(45.0)
raan = np.radians(0.0)
arg_periapsis = np.radians(0.0)

# Nome e descrição do satélite
satellite_name = "Satélite de Exemplo"
satellite_description = "Satélite de teste para cálculos avançados de órbita."
model_type = "point"

# Calcula a órbita com física avançada
positions = calculate_orbit(
    semi_major_axis=semi_major_axis,
    eccentricity=eccentricity,
    inclination=inclination,
    raan=raan,
    arg_periapsis=arg_periapsis
)

# Salva as informações em JSON
save_orbit_json(positions, satellite_name, satellite_description, model_type)
