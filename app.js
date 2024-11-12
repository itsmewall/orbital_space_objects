// app.js

// Defina o seu token de acesso do Cesium ion aqui
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MmFjZTE5OS00NmQ3LTQ1NDctYWQyMy04MzM0MDIwZDU0MWQiLCJpZCI6MTk3NDUzLCJpYXQiOjE3MDg3MDQ4NTd9.aRZXB2zE3zwVJn8C4cNQTwkvy8keyVMkpyTHqLa-0P8';

// Inicializa o visualizador do Cesium
var viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: Cesium.createWorldTerrain(),
  animation: false,
  timeline: false,
});

// Ajusta a posição inicial da câmera
viewer.scene.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
});

// Função para criar a órbita
function createOrbit() {
  // Remove entidades existentes
  viewer.entities.removeAll();

  // Obtém os valores dos inputs
  var semiMajorAxis = parseFloat(document.getElementById('semiMajorAxis').value) * 1000; // km to meters
  var eccentricity = parseFloat(document.getElementById('eccentricity').value);
  var inclination = Cesium.Math.toRadians(parseFloat(document.getElementById('inclination').value));
  var raan = Cesium.Math.toRadians(parseFloat(document.getElementById('raan').value));
  var argPeriapsis = Cesium.Math.toRadians(parseFloat(document.getElementById('argPeriapsis').value));
  var trueAnomaly = Cesium.Math.toRadians(parseFloat(document.getElementById('trueAnomaly').value));
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
    isNaN(trueAnomaly) ||
    isNaN(satelliteSpeed) ||
    isNaN(launchLatitude) ||
    isNaN(launchLongitude)
  ) {
    alert('Por favor, insira valores numéricos válidos.');
    return;
  }

  // Constante gravitacional padrão da Terra (m³/s²)
  var mu = 3.986004418e14;

  // Gera pontos ao longo da órbita
  var positions = [];
  var numberOfPoints = 360;

  for (var i = 0; i <= numberOfPoints; i++) {
    var theta = Cesium.Math.toRadians(i);
    var r =
      (semiMajorAxis * (1 - eccentricity * eccentricity)) /
      (1 + eccentricity * Math.cos(theta));

    // Coordenadas no plano orbital
    var xOrbital = r * Math.cos(theta);
    var yOrbital = r * Math.sin(theta);
    var zOrbital = 0;

    // Matriz de rotação total
    var rotationMatrix = Cesium.Matrix3.multiply(
      Cesium.Matrix3.multiply(
        Cesium.Matrix3.fromRotationZ(raan),
        Cesium.Matrix3.fromRotationX(inclination),
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

    // Ajusta a posição de lançamento
    var launchPosition = Cesium.Cartesian3.fromDegrees(launchLongitude, launchLatitude, 0);
    positionECI = Cesium.Cartesian3.add(positionECI, launchPosition, new Cesium.Cartesian3());

    positions.push(positionECI);
  }

  // Adiciona a órbita ao visualizador
  viewer.entities.add({
    name: 'Órbita',
    polyline: {
      positions: positions,
      width: 2,
      material: Cesium.Color.BLUE,
      arcType: Cesium.ArcType.NONE,
    },
  });

  // Adiciona o satélite
  var satellite = viewer.entities.add({
    position: positions[0],
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
    },
  });

  // Animação do satélite ao longo da órbita
  var property = new Cesium.SampledPositionProperty();
  var startTime = Cesium.JulianDate.now();
  var orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);

  for (var i = 0; i <= numberOfPoints; i++) {
    var time = Cesium.JulianDate.addSeconds(
      startTime,
      (i / numberOfPoints) * orbitalPeriod,
      new Cesium.JulianDate()
    );
    property.addSample(time, positions[i]);
  }

  satellite.position = property;

  // Configura o relógio do visualizador com o multiplicador de velocidade
  viewer.clock.startTime = startTime.clone();
  viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, orbitalPeriod, new Cesium.JulianDate());
  viewer.clock.currentTime = startTime.clone();
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = satelliteSpeed; // Usa o valor fornecido pelo usuário

  // Centraliza a câmera na órbita
  viewer.zoomTo(viewer.entities);
}

// Adiciona o listener ao botão
document.getElementById('createOrbitButton').addEventListener('click', createOrbit);

// Cria a órbita inicial ao carregar a página
createOrbit();
