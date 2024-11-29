// static/app.js

// Defina o seu token de acesso do Cesium Ion aqui
Cesium.Ion.defaultAccessToken = '__pycache__ node_modules static static/app.js static/styles.css static/tle_data.json templates templates/index.html .gitignore app.py orbit_calculation.py package-lock.json package.json save.txt teste1.json token.tx';

// Variáveis globais
var viewer;
var satellites = [];
var isAnimationPaused = false;

// Função principal para inicializar o Cesium Viewer
function initializeViewer() {
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: Cesium.createWorldTerrain(),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: false,
        fullscreenButton: false
    });

    // Mantém a Terra centralizada
    viewer.scene.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
    });

    // Adiciona os listeners aos botões
    document.getElementById('createOrbitButton').addEventListener('click', createOrbit);
    document.getElementById('toggleAnimationButton').addEventListener('click', toggleAnimation);

    // Adiciona listener para o controle de velocidade da animação
    document.getElementById('animationSpeed').addEventListener('input', updateAnimationSpeed);

    // Define a velocidade inicial da animação
    updateAnimationSpeed();
}

// Inicializa o viewer
initializeViewer();

// Função para criar a órbita
function createOrbit() {
    // Obtém os valores dos inputs
    var satelliteName = document.getElementById('satelliteName').value || 'Satélite';

    var semiMajorAxis = parseFloat(document.getElementById('semiMajorAxis').value); // km
    var eccentricity = parseFloat(document.getElementById('eccentricity').value);
    var inclination = parseFloat(document.getElementById('inclination').value); // graus
    var raan = parseFloat(document.getElementById('raan').value); // graus
    var argPeriapsis = parseFloat(document.getElementById('argPeriapsis').value); // graus
    var meanAnomaly = parseFloat(document.getElementById('meanAnomaly').value); // graus

    var launchLatitude = parseFloat(document.getElementById('launchLatitude').value);
    var launchLongitude = parseFloat(document.getElementById('launchLongitude').value);

    // Validação dos valores
    if (!validateInputs(semiMajorAxis, eccentricity, inclination, raan, argPeriapsis, meanAnomaly, launchLatitude, launchLongitude)) {
        return;
    }

    // Prepara os dados para enviar ao servidor
    var data = {
        semiMajorAxis: semiMajorAxis,
        eccentricity: eccentricity,
        inclination: inclination,
        raan: raan,
        argPeriapsis: argPeriapsis,
        meanAnomaly: meanAnomaly,
        launchLatitude: launchLatitude,
        launchLongitude: launchLongitude
    };

    // Mostra um indicador de carregamento
    showLoadingIndicator(true);

    // Faz a requisição ao servidor Flask
    fetch('/calculate_orbit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        showLoadingIndicator(false);
        if (!response.ok) {
            return response.json().then(errData => {
                throw new Error(errData.error || 'Erro ao calcular a órbita.');
            });
        }
        return response.json();
    })
    .then(result => {
        var positionsData = result.positions;

        // Cria a propriedade de posição
        var positionProperty = createPositionProperty(positionsData);

        // Define uma cor única para o satélite
        var color = Cesium.Color.fromRandom({ alpha: 1.0 });

        // Adiciona o satélite ao viewer
        var satelliteEntity = viewer.entities.add({
            id: satelliteName,
            name: satelliteName,
            position: positionProperty,
            path: {
                resolution: 60, // Define a resolução do caminho (em segundos)
                material: color,
                width: 2,
                leadTime: 0,
                trailTime: 86400, // Mostra a trilha de 1 dia
            },
            point: {
                pixelSize: 8,
                color: color,
            },
        });

        // Armazena o satélite na lista global
        satellites.push({
            name: satelliteName,
            entity: satelliteEntity,
        });

        // Atualiza a lista de satélites na interface
        updateSatelliteList();

        // Configura o relógio do visualizador
        viewer.clock.shouldAnimate = true;

        // Centraliza a visualização no satélite recém-adicionado
        viewer.zoomTo(satelliteEntity);

    })
    .catch(error => {
        showLoadingIndicator(false);
        console.error('Erro ao calcular a órbita:', error);
        alert('Ocorreu um erro ao calcular a órbita: ' + error.message);
    });
}

// Função para criar a propriedade de posição a partir dos dados recebidos
function createPositionProperty(positionsData) {
    var positionProperty = new Cesium.SampledPositionProperty();
    var startTime = viewer.clock.currentTime.clone();
    var totalDuration = 86400; // 1 dia em segundos
    var sampleInterval = totalDuration / positionsData.length;

    positionsData.forEach((pos, index) => {
        var time = Cesium.JulianDate.addSeconds(startTime, index * sampleInterval, new Cesium.JulianDate());
        var position = new Cesium.Cartesian3(pos.x, pos.y, pos.z);
        positionProperty.addSample(time, position);
    });

    return positionProperty;
}

// Função para validar os inputs
function validateInputs(semiMajorAxis, eccentricity, inclination, raan, argPeriapsis, meanAnomaly, launchLatitude, launchLongitude) {
    var errorMessage = '';

    if (isNaN(semiMajorAxis) || semiMajorAxis <= 0) {
        errorMessage += 'O semi-eixo maior deve ser um número positivo.\n';
    }
    if (isNaN(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
        errorMessage += 'A excentricidade deve ser um número entre 0 (inclusive) e 1 (exclusivo).\n';
    }
    if (isNaN(inclination) || inclination < 0 || inclination > 180) {
        errorMessage += 'A inclinação deve ser um número entre 0 e 180 graus.\n';
    }
    if (isNaN(raan) || raan < 0 || raan >= 360) {
        errorMessage += 'O RAAN deve ser um número entre 0 e 360 graus.\n';
    }
    if (isNaN(argPeriapsis) || argPeriapsis < 0 || argPeriapsis >= 360) {
        errorMessage += 'O argumento do perigeu deve ser um número entre 0 e 360 graus.\n';
    }
    if (isNaN(meanAnomaly) || meanAnomaly < 0 || meanAnomaly >= 360) {
        errorMessage += 'A anomalia média deve ser um número entre 0 e 360 graus.\n';
    }
    if (isNaN(launchLatitude) || launchLatitude < -90 || launchLatitude > 90) {
        errorMessage += 'A latitude de lançamento deve ser um número entre -90 e 90 graus.\n';
    }
    if (isNaN(launchLongitude) || launchLongitude < -180 || launchLongitude > 180) {
        errorMessage += 'A longitude de lançamento deve ser um número entre -180 e 180 graus.\n';
    }

    if (errorMessage) {
        alert('Erros nos parâmetros orbitais:\n\n' + errorMessage);
        return false;
    }

    return true;
}

// Função para atualizar a velocidade da animação
function updateAnimationSpeed() {
    var speedSlider = document.getElementById('animationSpeed');
    var speed = parseFloat(speedSlider.value);

    // Ajusta a multiplicação da velocidade do relógio
    viewer.clock.multiplier = speed;

    // Atualiza o label ou exibe o valor da velocidade, se desejar
}

// Função para pausar e retomar a animação
function toggleAnimation() {
    isAnimationPaused = !isAnimationPaused;
    viewer.clock.shouldAnimate = !isAnimationPaused;
    var button = document.getElementById('toggleAnimationButton');
    button.textContent = isAnimationPaused ? 'Retomar Animação' : 'Pausar Animação';
}

// Função para atualizar a lista de satélites na interface
function updateSatelliteList() {
    var satelliteItems = document.getElementById('satelliteItems');
    satelliteItems.innerHTML = '';

    satellites.forEach(function (sat, index) {
        var li = document.createElement('li');
        li.textContent = sat.name;

        // Botão para remover o satélite
        var removeButton = document.createElement('button');
        removeButton.textContent = 'Remover';
        removeButton.style.marginLeft = '10px';
        removeButton.addEventListener('click', function (e) {
            e.stopPropagation();
            removeSatellite(index);
        });

        li.appendChild(removeButton);

        li.addEventListener('click', function () {
            // Centraliza a câmera no satélite selecionado
            viewer.zoomTo(sat.entity);
        });
        satelliteItems.appendChild(li);
    });
}

// Função para remover um satélite
function removeSatellite(index) {
    var sat = satellites[index];
    // Remove a entidade do viewer
    viewer.entities.remove(sat.entity);
    // Remove o satélite do array
    satellites.splice(index, 1);
    // Atualiza a lista
    updateSatelliteList();
}

// Função para mostrar ou ocultar um indicador de carregamento
function showLoadingIndicator(show) {
    var loadingIndicator = document.getElementById('loadingIndicator');
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.textContent = 'Calculando órbita...';
        loadingIndicator.style.position = 'absolute';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';
        loadingIndicator.style.padding = '20px';
        loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.fontSize = '18px';
        loadingIndicator.style.borderRadius = '10px';
        document.body.appendChild(loadingIndicator);
    }
    loadingIndicator.style.display = show ? 'block' : 'none';
}
