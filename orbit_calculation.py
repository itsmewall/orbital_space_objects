# orbit_calculation.py

import numpy as np
from math import pi, sin, cos, sqrt, atan2
from scipy.optimize import newton

# Constantes físicas
MU = 3.986004418e14        # Constante gravitacional da Terra (m^3/s^2)
J2 = 1.08263e-3            # Coeficiente zonal de segundo grau da Terra
EARTH_RADIUS = 6378.137e3  # Raio equatorial da Terra em metros

# Função para resolver a Equação de Kepler
def solve_kepler(eccentric_anomaly, mean_anomaly, eccentricity):
    return eccentric_anomaly - eccentricity * sin(eccentric_anomaly) - mean_anomaly

# Função para calcular as perturbações J2
def calculate_j2_perturbations(semi_major_axis, eccentricity, inclination):
    p = semi_major_axis * (1 - eccentricity**2)
    factor = 1.5 * J2 * (EARTH_RADIUS**2) / (p**2)
    raan_dot = -factor * cos(inclination)
    arg_periapsis_dot = factor * (2 - 2.5 * sin(inclination)**2)
    return raan_dot, arg_periapsis_dot

# Função principal para calcular a órbita
def calculate_orbit(semi_major_axis, eccentricity, inclination, raan, arg_periapsis, mean_anomaly_at_epoch=0.0, launch_latitude=0.0, launch_longitude=0.0, num_points=1000):
    # Período orbital
    period = 2 * pi * sqrt(semi_major_axis**3 / MU)
    # Pontos de tempo igualmente espaçados
    time_points = np.linspace(0, period, num_points)
    positions = []

    # Calcula as taxas de variação devido ao J2
    raan_dot, arg_periapsis_dot = calculate_j2_perturbations(semi_major_axis, eccentricity, inclination)

    # Ajuste da anomalia média inicial para que a posição inicial corresponda ao local de lançamento
    # Isto é uma simplificação; para maior precisão, cálculos mais complexos são necessários
    if launch_latitude != 0.0 or launch_longitude != 0.0:
        # Vetor posição inicial do local de lançamento em coordenadas ECEF
        r_earth = EARTH_RADIUS
        x_launch = r_earth * cos(launch_latitude) * cos(launch_longitude)
        y_launch = r_earth * cos(launch_latitude) * sin(launch_longitude)
        z_launch = r_earth * sin(launch_latitude)
        position_launch = np.array([x_launch, y_launch, z_launch])

        # Transformar para o sistema de coordenadas orbitais
        rotation_matrix = get_rotation_matrix(raan, inclination, arg_periapsis)
        position_orbital = np.linalg.inv(rotation_matrix).dot(position_launch)

        # Calcula a anomalia verdadeira inicial
        true_anomaly_initial = atan2(position_orbital[1], position_orbital[0])

        # Converte para anomalia média inicial
        E_initial = 2 * atan2(sqrt(1 - eccentricity) * sin(true_anomaly_initial / 2),
                              sqrt(1 + eccentricity) * cos(true_anomaly_initial / 2))
        mean_anomaly_at_epoch = E_initial - eccentricity * sin(E_initial)

    for time in time_points:
        # Atualiza RAAN e argumento do periapsis
        current_raan = raan + raan_dot * time
        current_arg_periapsis = arg_periapsis + arg_periapsis_dot * time

        # Anomalia média
        mean_anomaly = mean_anomaly_at_epoch + (2 * pi * time) / period

        # Resolve a Equação de Kepler para anomalia excêntrica
        eccentric_anomaly = newton(solve_kepler, mean_anomaly, args=(mean_anomaly, eccentricity))

        # Anomalia verdadeira
        true_anomaly = 2 * np.arctan2(
            sqrt(1 + eccentricity) * sin(eccentric_anomaly / 2),
            sqrt(1 - eccentricity) * cos(eccentric_anomaly / 2)
        )

        # Distância radial
        r = semi_major_axis * (1 - eccentricity * cos(eccentric_anomaly))

        # Coordenadas no plano orbital
        x_orbit = r * cos(true_anomaly)
        y_orbit = r * sin(true_anomaly)
        z_orbit = 0

        # Matriz de rotação para o sistema ECI
        rotation_matrix = get_rotation_matrix(current_raan, inclination, current_arg_periapsis)

        # Vetor posição no plano orbital
        position_orbit = np.array([x_orbit, y_orbit, z_orbit])
        # Aplica a rotação
        position_eci = rotation_matrix.dot(position_orbit)

        # Adiciona a posição ao array
        positions.append({
            "x": float(position_eci[0]),
            "y": float(position_eci[1]),
            "z": float(position_eci[2])
        })

    return positions

def get_rotation_matrix(raan, inclination, arg_periapsis):
    cos_raan = cos(raan)
    sin_raan = sin(raan)
    cos_i = cos(inclination)
    sin_i = sin(inclination)
    cos_arg_periapsis = cos(arg_periapsis)
    sin_arg_periapsis = sin(arg_periapsis)

    # Matriz de rotação
    rotation_matrix = np.array([
        [cos_raan * cos_arg_periapsis - sin_raan * sin_arg_periapsis * cos_i,
         -cos_raan * sin_arg_periapsis - sin_raan * cos_arg_periapsis * cos_i,
         sin_raan * sin_i],
        [sin_raan * cos_arg_periapsis + cos_raan * sin_arg_periapsis * cos_i,
         -sin_raan * sin_arg_periapsis + cos_raan * cos_arg_periapsis * cos_i,
         -cos_raan * sin_i],
        [sin_arg_periapsis * sin_i,
         cos_arg_periapsis * sin_i,
         cos_i]
    ])
    return rotation_matrix
