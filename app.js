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

  // Cria a órbita inicial ao carregar a página
  createOrbit();
});

// Função para converter elementos orbitais em posição ECI
function orbitalElementsToCartesian(a, e, i, raan, argPeriapsis, trueAnomaly) {
  var p = a * (1 - e * e);
  var r = p / (1 + e * Math.cos(trueAnomaly));
  var xOrbital = r * Math.cos(trueAnomaly);
  var yOrbital = r * Math.sin(trueAnomaly);
  var zOrbital = 0;

  // Matriz de rotação total
  var rotationMatrix = Cesium.Matrix3.multiply(
    Cesium.Matrix3.multiply(
      Cesium.Matrix3.fromRotationZ(raan),
      Cesium.Matrix3.fromRotationX(i),
      new Cesium.Matrix3()
    ),
    Cesium.Matrix3.fromRotationZ(argPeriapsis),
    new Cesium.Matrix3()
  );

  // Aplica as rotações
  var positionECI = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    new Cesium.Cartesian3(xOrbital, yOrbital, zOrbital),
    new Cesium.Cartesian3()
  );

  return positionECI;
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

// Função para calcular a anomalia verdadeira inicial com base na posição de lançamento
function calculateInitialTrueAnomaly(a, e, i, raan, argPeriapsis, launchLatitude, launchLongitude, gmst) {
  // Converte o launchLatitude e launchLongitude em posição ECEF
  var launchPositionECEF = Cesium.Cartesian3.fromDegrees(launchLongitude, launchLatitude, 0);

  // Converte a posição de lançamento ECEF para ECI no tempo inicial
  var rotationMatrix = Cesium.Matrix3.fromRotationZ(-gmst);
  var launchPositionECI = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    launchPositionECEF,
    new Cesium.Cartesian3()
  );

  // Inverte as rotações para obter a anomalia verdadeira
  var rotationMatrixTotal = Cesium.Matrix3.multiply(
    Cesium.Matrix3.fromRotationZ(argPeriapsis),
    Cesium.Matrix3.multiply(
      Cesium.Matrix3.fromRotationX(i),
      Cesium.Matrix3.fromRotationZ(raan),
      new Cesium.Matrix3()
    ),
    new Cesium.Matrix3()
  );

  var rotationMatrixTotalTranspose = Cesium.Matrix3.transpose(rotationMatrixTotal, new Cesium.Matrix3());

  var positionInOrbitalPlane = Cesium.Matrix3.multiplyByVector(
    rotationMatrixTotalTranspose,
    launchPositionECI,
    new Cesium.Cartesian3()
  );

  var x = positionInOrbitalPlane.x;
  var y = positionInOrbitalPlane.y;

  var initialTrueAnomaly = Math.atan2(y, x);

  return initialTrueAnomaly;
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

  // Calcula o período orbital
  var orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);

  // Tempo inicial
  var startTime = viewer.clock.currentTime.clone();

  // Número de amostras para uma órbita suave
  var totalSamples = 1000;

  // Calcula o GMST no tempo inicial
  var gmst = computeGMST(startTime);

  // Calcula a anomalia verdadeira inicial com base na posição de lançamento
  var initialTrueAnomaly = calculateInitialTrueAnomaly(
    semiMajorAxis,
    eccentricity,
    inclination,
    raan,
    argPeriapsis,
    launchLatitude,
    launchLongitude,
    gmst
  );

  // Propriedade de posição amostrada em referencial inercial
  var inertialPositions = new Cesium.SampledPositionProperty(Cesium.ReferenceFrame.INERTIAL);

  // Array para armazenar posições ECEF para a órbita
  var ecefPositions = [];

  for (var i = 0; i <= totalSamples; i++) {
    var time = Cesium.JulianDate.addSeconds(
      startTime,
      (i / totalSamples) * orbitalPeriod * 10, // Extende para 10 órbitas
      new Cesium.JulianDate()
    );

    var currentTrueAnomaly = initialTrueAnomaly + 2 * Math.PI * (i / totalSamples) * 10; // 10 órbitas

    // Normaliza o ângulo entre 0 e 2π
    currentTrueAnomaly = Cesium.Math.zeroToTwoPi(currentTrueAnomaly);

    // Calcula a posição ECI
    var positionECI = orbitalElementsToCartesian(
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argPeriapsis,
      currentTrueAnomaly
    );

    // Adiciona a amostra em ECI
    inertialPositions.addSample(time, positionECI);

    // Converte ECI para ECEF para a linha de órbita
    var fixedToInertialMatrix = Cesium.Transforms.computeIcrfToFixedMatrix(time);
    var positionECEF;
    if (Cesium.defined(fixedToInertialMatrix)) {
      positionECEF = Cesium.Matrix3.multiplyByVector(fixedToInertialMatrix, positionECI, new Cesium.Cartesian3());
    } else {
      positionECEF = positionECI;
    }

    // Armazena a posição ECEF
    ecefPositions.push(positionECEF);
  }

  // Define a cor do satélite
  var color = Cesium.Color.fromRandom({ alpha: 1.0 });

  // Adiciona o satélite
  var satelliteEntity = viewer.entities.add({
    id: satelliteName,
    name: satelliteName,
    position: inertialPositions,
    point: {
      pixelSize: 10,
      color: color,
    },
  });

  // Adiciona a linha de órbita
  var orbitLine = viewer.entities.add({
    name: satelliteName + ' Órbita',
    polyline: {
      positions: ecefPositions,
      width: 2,
      material: color,
      clampToGround: false,
    },
  });

  // Armazena o satélite na lista global
  satellites.push({
    name: satelliteName,
    entity: satelliteEntity,
    orbitalPeriod: orbitalPeriod,
    orbitLine: orbitLine,
  });

  // Atualiza a lista de satélites na interface
  updateSatelliteList();

  // Configura o relógio do visualizador com o multiplicador de velocidade
  viewer.clock.multiplier = satelliteSpeed;
  viewer.clock.shouldAnimate = true;

  // Mantém a Terra centralizada
  viewer.scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
  });
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

  satellites.forEach(function (sat) {
    var li = document.createElement('li');
    li.textContent = sat.name;
    li.addEventListener('click', function () {
      // Centraliza a câmera no satélite selecionado
      viewer.zoomTo([sat.entity, sat.orbitLine]);
    });
    satelliteItems.appendChild(li);
  });
}
