let energyChart, orbitChart, groundTrackChart;

function calculateParameters() {
    const mass = parseFloat(document.getElementById("mass").value);
    const altitude = parseFloat(document.getElementById("altitude").value);
    const eccentricity = parseFloat(document.getElementById("eccentricity").value);
    const inclination = parseFloat(document.getElementById("inclination").value);

    fetch("/calculate_satellite_parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mass, altitude, eccentricity, inclination }),
    })
    .then((response) => response.json())
    .then((data) => {
        const results = data.results;

        // Atualizar resultados
        document.getElementById("velocity").innerText = `Velocidade Orbital: ${results.velocity.toFixed(2)} m/s`;
        document.getElementById("potentialEnergy").innerText = `Energia Potencial: ${results.potential_energy_specific.toFixed(2)} J/kg`;
        document.getElementById("kineticEnergy").innerText = `Energia Cinética: ${results.kinetic_energy_specific.toFixed(2)} J/kg`;
        document.getElementById("totalEnergy").innerText = `Energia Total: ${results.total_energy_specific.toFixed(2)} J/kg`;
        document.getElementById("period").innerText = `Período Orbital: ${(results.period / 3600).toFixed(2)} horas`;
        document.getElementById("apogee").innerText = `Apogeu: ${results.apogee.toFixed(2)} km`;
        document.getElementById("perigee").innerText = `Perigeu: ${results.perigee.toFixed(2)} km`;
        document.getElementById("stability").innerText = `Estabilidade Orbital: ${results.stability}`;

        // Gráfico de Energia
        if (energyChart) energyChart.destroy();
        const energyCtx = document.getElementById("energyChart").getContext("2d");
        energyChart = new Chart(energyCtx, {
            type: "line",
            data: {
                labels: results.graphs.angles.map((angle) => (angle * 180 / Math.PI).toFixed(2)),
                datasets: [
                    {
                        label: "Energia Potencial (J/kg)",
                        data: results.graphs.potential_energies,
                        borderColor: "blue",
                        backgroundColor: "blue",
                        fill: false,
                    },
                    {
                        label: "Energia Cinética (J/kg)",
                        data: results.graphs.kinetic_energies,
                        borderColor: "green",
                        backgroundColor: "green",
                        fill: false,
                    },
                    {
                        label: "Energia Total (J/kg)",
                        data: results.graphs.total_energies,
                        borderColor: "red",
                        backgroundColor: "red",
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Energias Específicas vs Ângulo',
                    },
                    legend: {
                        position: 'top',
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Ângulo (graus)',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Energia Específica (J/kg)',
                        },
                    },
                },
            },
        });

        // Gráfico de Órbita
        if (orbitChart) orbitChart.destroy();
        const orbitCtx = document.getElementById("orbitChart").getContext("2d");
        orbitChart = new Chart(orbitCtx, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Órbita",
                        data: results.graphs.orbit_x.map((x, i) => ({
                            x: x,
                            y: results.graphs.orbit_y[i],
                        })),
                        borderColor: "orange",
                        backgroundColor: "orange",
                        showLine: true,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Trajetória Orbital',
                    },
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Posição X (km)',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Posição Y (km)',
                        },
                    },
                },
            },
        });

        // Gráfico de Ground Track
        if (groundTrackChart) groundTrackChart.destroy();
        const groundCtx = document.getElementById("groundTrackChart").getContext("2d");
        groundTrackChart = new Chart(groundCtx, {
            type: "line",
            data: {
                labels: results.graphs.longitudes.map((lon) => lon.toFixed(2)),
                datasets: [
                    {
                        label: "Ground Track",
                        data: results.graphs.latitudes,
                        borderColor: "red",
                        backgroundColor: "red",
                        fill: false,
                        tension: 0.1,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Ground Track',
                    },
                    legend: {
                        display: false,
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Longitude (graus)',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Latitude (graus)',
                        },
                    },
                },
            },
        });
    })
    .catch((error) => {
        console.error('Erro:', error);
    });
}
