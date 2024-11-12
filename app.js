// app.js

// Defina o seu token de acesso do Cesium ion aqui
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MmFjZTE5OS00NmQ3LTQ1NDctYWQyMy04MzM0MDIwZDU0MWQiLCJpZCI6MTk3NDUzLCJpYXQiOjE3MDg3MDQ4NTd9.aRZXB2zE3zwVJn8C4cNQTwkvy8keyVMkpyTHqLa-0P8';

// Variáveis globais
var viewer;
var satellites = [];
var isAnimationPaused = false;

// Inicializa o visualizador do Cesium
Cesium.createWorldTerrainAsync().then(function(terrainProvider) {
  viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: terrainProvider,
    animation: false,
    timeline: false,
  });

  // Mantém a Terra centralizada
  viewer.scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
  });

  // Adiciona os listeners aos botões
  document.getElementById('createOrbitButton').addEventListener('click', createOrbit);
  document.getElementById('toggleAnimationButton').addEventListener('click', toggleAnimation);
  document.getElementById('saveSatellitesButton').addEventListener('click', saveSatellitesToFile);
  document.getElementById('loadSatellitesButton').addEventListener('click', function() {
    document.getElementById('loadFileInput').click();
  });
  document.getElementById('loadFileInput').addEventListener('change', loadSatellitesFromFile);

  // Carrega os satélites salvos no Local Storage
  loadSatellitesFromLocalStorage();
});

// Função para converter elementos orbitais em posição ECEF
function orbitalElementsToECEF(a, e, i, raan, argPeriapsis, timeSincePeriapsis, mu) {
  // Calcula o período orbital
  var orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);

  // Calcula a anomalia média
  var meanAnomaly = (2 * Math.PI * timeSincePeriapsis) / orbitalPeriod;

  // Resolve a equação de Kepler para obter a anomalia excêntrica
  var eccentricAnomaly = solveKeplerEquation(meanAnomaly, e);

  // Calcula a anomalia verdadeira
  var trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2)
  );

  // Calcula a distância radial
  var r = a * (1 - e * Math.cos(eccentricAnomaly));

  // Posição no plano orbital
  var xOrbital = r * Math.cos(trueAnomaly);
  var yOrbital = r * Math.sin(trueAnomaly);
  var zOrbital = 0;

  // Matriz de rotação total
  var rotationMatrix = Cesium.Matrix3.multiply(
    Cesium.Matrix3.fromRotationZ(argPeriapsis),
    Cesium.Matrix3.multiply(
      Cesium.Matrix3.fromRotationX(i),
      Cesium.Matrix3.fromRotationZ(raan),
      new Cesium.Matrix3()
    ),
    new Cesium.Matrix3()
  );

  // Aplica as rotações
  var positionECI = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    new Cesium.Cartesian3(xOrbital, yOrbital, zOrbital),
    new Cesium.Cartesian3()
  );

  // Calcula o GMST no tempo atual
  var currentTime = viewer.clock.currentTime;
  var gmst = computeGMST(currentTime);

  // Converte ECI para ECEF
  var rotationZ = Cesium.Matrix3.fromRotationZ(gmst);
  var positionECEF = Cesium.Matrix3.multiplyByVector(
    rotationZ,
    positionECI,
    new Cesium.Cartesian3()
  );

  return positionECEF;
}

// Função para resolver a equação de Kepler usando Newton-Raphson
function solveKeplerEquation(M, e) {
  var E = M;
  var delta = 1e-6;
  var maxIter = 100;
  var iter = 0;

  while (iter < maxIter) {
    var f = E - e * Math.sin(E) - M;
    var fPrime = 1 - e * Math.cos(E);
    var ENew = E - f / fPrime;

    if (Math.abs(ENew - E) < delta) {
      break;
    }

    E = ENew;
    iter++;
  }

  return E;
}

// Função para calcular o GMST
function computeGMST(julianDate) {
  var jd = julianDate.dayNumber + julianDate.secondsOfDay / 86400.0;
  var t = (jd - 2451545.0) / 36525.0;

  var gmstDegrees = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                    + 0.000387933 * t * t - (t * t * t) / 38710000.0;

  // Normaliza para [0, 360)
  gmstDegrees = gmstDegrees % 360.0;
  if (gmstDegrees < 0) {
    gmstDegrees += 360.0;
  }

  // Converte para radianos
  var gmstRadians = Cesium.Math.toRadians(gmstDegrees);

  return gmstRadians;
}

// Função para criar a órbita
function createOrbit() {
  // Verifica se o viewer está pronto
  if (!viewer) {
    alert('O visualizador não está pronto ainda. Por favor, aguarde e tente novamente.');
    return;
  }

  // Obtém os valores dos inputs
  var satelliteName = document.getElementById('satelliteName').value || 'Satélite';
  var satelliteDescription = document.getElementById('satelliteDescription').value || '';
  var modelType = document.getElementById('modelType').value;
  var modelFile = document.getElementById('modelUpload').files[0];

  var semiMajorAxis = parseFloat(document.getElementById('semiMajorAxis').value) * 1000; // km to meters
  var eccentricity = parseFloat(document.getElementById('eccentricity').value);
  var inclination = Cesium.Math.toRadians(parseFloat(document.getElementById('inclination').value));
  var raan = Cesium.Math.toRadians(parseFloat(document.getElementById('raan').value));
  var argPeriapsis = Cesium.Math.toRadians(parseFloat(document.getElementById('argPeriapsis').value));
  var satelliteSpeed = parseFloat(document.getElementById('satelliteSpeed').value);
  var launchLatitude = parseFloat(document.getElementById('launchLatitude').value);
  var launchLongitude = parseFloat(document.getElementById('launchLongitude').value);

  // Validação dos valores
  if (
    isNaN(semiMajorAxis) ||
    isNaN(eccentricity) ||
    isNaN(inclination) ||
    isNaN(raan) ||
    isNaN(argPeriapsis) ||
    isNaN(satelliteSpeed) ||
    isNaN(launchLatitude) ||
    isNaN(launchLongitude)
  ) {
    alert('Por favor, insira valores numéricos válidos.');
    return;
  }

  // Exibe as informações orbitais
  displayOrbitInfo(semiMajorAxis, eccentricity, inclination);

  // Constante gravitacional padrão da Terra (m³/s²)
  var mu = 3.986004418e14;

  // Tempo inicial
  var startTime = viewer.clock.currentTime.clone();
  var totalDuration = 86400 * 5; // Simula 5 dias

  // Propriedade de posição amostrada em referencial FIXED
  var positionProperty = new Cesium.SampledPositionProperty();

  // Intervalo de tempo para amostragem
  var sampleInterval = 60; // a cada 60 segundos

  // Calcula o tempo desde o perigeu
  var timeSincePeriapsis = 0;

  for (var t = 0; t <= totalDuration; t += sampleInterval) {
    var currentTime = Cesium.JulianDate.addSeconds(startTime, t, new Cesium.JulianDate());

    // Calcula a posição ECEF
    var positionECEF = orbitalElementsToECEF(
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argPeriapsis,
      timeSincePeriapsis + t,
      mu
    );

    // Adiciona a amostra
    positionProperty.addSample(currentTime, positionECEF);
  }

  // Define a cor do satélite
  var color = Cesium.Color.fromRandom({ alpha: 1.0 });

  // Configura a representação visual do satélite
  var satelliteGraphics;
  if (modelType === '3dmodel' && modelFile) {
    var modelUri = URL.createObjectURL(modelFile);
    satelliteGraphics = {
      model: {
        uri: modelUri,
        minimumPixelSize: 64,
        maximumScale: 2000,
      },
    };
  } else if (modelType === 'image' && modelFile) {
    var imageUri = URL.createObjectURL(modelFile);
    satelliteGraphics = {
      billboard: {
        image: imageUri,
        width: 32,
        height: 32,
      },
    };
  } else {
    satelliteGraphics = {
      point: {
        pixelSize: 10,
        color: color,
      },
    };
  }

  // Adiciona o satélite
  var satelliteEntity = viewer.entities.add({
    id: satelliteName,
    name: satelliteName,
    description: satelliteDescription,
    position: positionProperty,
    path: {
      resolution: 60,
      material: color,
      width: 2,
      leadTime: 0,
      trailTime: 3600 * 5, // Mostra o rastro das últimas 5 horas
    },
    ...satelliteGraphics,
    // Disponibilidade do satélite
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
      start: startTime,
      stop: Cesium.JulianDate.addSeconds(startTime, totalDuration, new Cesium.JulianDate())
    })]),
  });

  // Armazena o satélite na lista global
  satellites.push({
    name: satelliteName,
    entity: satelliteEntity,
    description: satelliteDescription,
    orbitalParameters: {
      semiMajorAxis: semiMajorAxis,
      eccentricity: eccentricity,
      inclination: inclination,
      raan: raan,
      argPeriapsis: argPeriapsis,
      launchLatitude: launchLatitude,
      launchLongitude: launchLongitude,
    },
    modelType: modelType,
    modelFile: modelFile ? modelFile.name : null,
  });

  // Atualiza a lista de satélites na interface
  updateSatelliteList();

  // Configura o relógio do visualizador com o multiplicador de velocidade
  viewer.clock.multiplier = satelliteSpeed;
  viewer.clock.shouldAnimate = true;

  // Limpa o campo de upload
  document.getElementById('modelUpload').value = '';

  // Mantém a Terra centralizada
  viewer.scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
  });

  // Salva os satélites no Local Storage
  saveSatellitesToLocalStorage();
}

// Função para exibir informações orbitais
function displayOrbitInfo(a, e, i) {
  var infoText = document.getElementById('infoText');
  infoText.innerHTML = `
    Semi-eixo maior: ${(a / 1000).toFixed(2)} km<br>
    Excentricidade: ${e.toFixed(4)}<br>
    Inclinação: ${Cesium.Math.toDegrees(i).toFixed(2)}°
  `;
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
    li.addEventListener('click', function () {
      // Centraliza a câmera no satélite selecionado
      viewer.zoomTo(sat.entity);

      // Exibe informações adicionais
      displaySatelliteInfo(sat);
    });
    satelliteItems.appendChild(li);
  });
}

// Função para exibir informações detalhadas do satélite
function displaySatelliteInfo(sat) {
  alert(`Nome: ${sat.name}\nDescrição: ${sat.description}`);
}

// Função para salvar os satélites no Local Storage
function saveSatellitesToLocalStorage() {
  var satelliteData = satellites.map(function (sat) {
    return {
      name: sat.name,
      description: sat.description,
      orbitalParameters: {
        semiMajorAxis: sat.orbitalParameters.semiMajorAxis / 1000, // metros para km
        eccentricity: sat.orbitalParameters.eccentricity,
        inclination: Cesium.Math.toDegrees(sat.orbitalParameters.inclination),
        raan: Cesium.Math.toDegrees(sat.orbitalParameters.raan),
        argPeriapsis: Cesium.Math.toDegrees(sat.orbitalParameters.argPeriapsis),
        launchLatitude: sat.orbitalParameters.launchLatitude,
        launchLongitude: sat.orbitalParameters.launchLongitude,
      },
      modelType: sat.modelType,
      modelFile: sat.modelFile,
    };
  });

  localStorage.setItem('satellites', JSON.stringify(satelliteData));
}

// Função para carregar satélites do Local Storage
function loadSatellitesFromLocalStorage() {
  var satelliteData = localStorage.getItem('satellites');
  if (satelliteData) {
    try {
      satelliteData = JSON.parse(satelliteData);

      satelliteData.forEach(function (satData) {
        restoreSatellite(satData);
      });

      // Atualiza a lista
      updateSatelliteList();
    } catch (error) {
      console.error('Erro ao carregar satélites do Local Storage:', error);
    }
  }
}

// Função para restaurar um satélite a partir dos dados carregados
function restoreSatellite(satData) {
  var semiMajorAxis = satData.orbitalParameters.semiMajorAxis * 1000; // km para metros
  var eccentricity = satData.orbitalParameters.eccentricity;
  var inclination = Cesium.Math.toRadians(satData.orbitalParameters.inclination);
  var raan = Cesium.Math.toRadians(satData.orbitalParameters.raan);
  var argPeriapsis = Cesium.Math.toRadians(satData.orbitalParameters.argPeriapsis);
  var launchLatitude = satData.orbitalParameters.launchLatitude;
  var launchLongitude = satData.orbitalParameters.launchLongitude;

  var satelliteName = satData.name;
  var satelliteDescription = satData.description;
  var modelType = satData.modelType;
  var modelFileName = satData.modelFile;

  // Constante gravitacional padrão da Terra (m³/s²)
  var mu = 3.986004418e14;

  // Tempo inicial
  var startTime = viewer.clock.currentTime.clone();
  var totalDuration = 86400 * 5; // Simula 5 dias

  // Propriedade de posição amostrada em referencial FIXED
  var positionProperty = new Cesium.SampledPositionProperty();

  // Intervalo de tempo para amostragem
  var sampleInterval = 60; // a cada 60 segundos

  // Calcula o tempo desde o perigeu
  var timeSincePeriapsis = 0;

  for (var t = 0; t <= totalDuration; t += sampleInterval) {
    var currentTime = Cesium.JulianDate.addSeconds(startTime, t, new Cesium.JulianDate());

    // Calcula a posição ECEF
    var positionECEF = orbitalElementsToECEF(
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argPeriapsis,
      timeSincePeriapsis + t,
      mu
    );

    // Adiciona a amostra
    positionProperty.addSample(currentTime, positionECEF);
  }

  // Define a cor do satélite
  var color = Cesium.Color.fromRandom({ alpha: 1.0 });

  // Configura a representação visual do satélite
  var satelliteGraphics;
  if (modelType === '3dmodel' && modelFileName) {
    // Não podemos carregar o modelo localmente sem o arquivo
    satelliteGraphics = {
      point: {
        pixelSize: 10,
        color: color,
      },
    };
  } else if (modelType === 'image' && modelFileName) {
    // Não podemos carregar a imagem localmente sem o arquivo
    satelliteGraphics = {
      point: {
        pixelSize: 10,
        color: color,
      },
    };
  } else {
    satelliteGraphics = {
      point: {
        pixelSize: 10,
        color: color,
      },
    };
  }

  // Adiciona o satélite
  var satelliteEntity = viewer.entities.add({
    id: satelliteName,
    name: satelliteName,
    description: satelliteDescription,
    position: positionProperty,
    path: {
      resolution: 60,
      material: color,
      width: 2,
      leadTime: 0,
      trailTime: 3600 * 5, // Mostra o rastro das últimas 5 horas
    },
    ...satelliteGraphics,
    // Disponibilidade do satélite
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
      start: startTime,
      stop: Cesium.JulianDate.addSeconds(startTime, totalDuration, new Cesium.JulianDate())
    })]),
  });

  // Armazena o satélite na lista global
  satellites.push({
    name: satelliteName,
    entity: satelliteEntity,
    description: satelliteDescription,
    orbitalParameters: {
      semiMajorAxis: semiMajorAxis,
      eccentricity: eccentricity,
      inclination: inclination,
      raan: raan,
      argPeriapsis: argPeriapsis,
      launchLatitude: launchLatitude,
      launchLongitude: launchLongitude,
    },
    modelType: modelType,
    modelFile: modelFileName,
  });
}

// Função para salvar os satélites em um arquivo JSON (opcional)
function saveSatellitesToFile() {
  if (satellites.length === 0) {
    alert('Nenhum satélite para salvar.');
    return;
  }

  var satelliteData = satellites.map(function (sat) {
    return {
      name: sat.name,
      description: sat.description,
      orbitalParameters: {
        semiMajorAxis: sat.orbitalParameters.semiMajorAxis / 1000, // metros para km
        eccentricity: sat.orbitalParameters.eccentricity,
        inclination: Cesium.Math.toDegrees(sat.orbitalParameters.inclination),
        raan: Cesium.Math.toDegrees(sat.orbitalParameters.raan),
        argPeriapsis: Cesium.Math.toDegrees(sat.orbitalParameters.argPeriapsis),
        launchLatitude: sat.orbitalParameters.launchLatitude,
        launchLongitude: sat.orbitalParameters.launchLongitude,
      },
      modelType: sat.modelType,
      modelFile: sat.modelFile,
    };
  });

  var dataStr = JSON.stringify(satelliteData, null, 2);
  var dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

  var exportFileDefaultName = 'satellites.json';

  var linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

// Função para carregar satélites de um arquivo JSON (opcional)
function loadSatellitesFromFile(event) {
  var file = event.target.files[0];
  if (!file) {
    return;
  }

  var reader = new FileReader();
  reader.onload = function (e) {
    var contents = e.target.result;
    try {
      var satelliteData = JSON.parse(contents);

      // Limpa satélites existentes
      viewer.entities.removeAll();
      satellites = [];

      satelliteData.forEach(function (satData) {
        // Restaura o satélite
        restoreSatellite(satData);
      });

      // Atualiza a lista
      updateSatelliteList();

      // Salva os satélites no Local Storage
      saveSatellitesToLocalStorage();

    } catch (error) {
      alert('Erro ao carregar o arquivo: ' + error.message);
    }
  };
  reader.readAsText(file);

  // Limpa o input de arquivo
  event.target.value = '';
}
