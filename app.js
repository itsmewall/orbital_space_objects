// app.js

// Inicializa o visualizador do Cesium
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain(),
    animation: false,
    timeline: false,
  });
  
  // Ajusta a posição inicial da câmera
  viewer.scene.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
  });
  

// app.js

// Função para criar a órbita
function createOrbit() {
    // Remove entidades existentes
    viewer.entities.removeAll();
  
    // Obtém os valores dos inputs
    const semiMajorAxis = parseFloat(document.getElementById('semiMajorAxis').value) * 1000; // km to meters
    const eccentricity = parseFloat(document.getElementById('eccentricity').value);
    const inclination = Cesium.Math.toRadians(parseFloat(document.getElementById('inclination').value));
    const raan = Cesium.Math.toRadians(parseFloat(document.getElementById('raan').value));
    const argPeriapsis = Cesium.Math.toRadians(parseFloat(document.getElementById('argPeriapsis').value));
    const trueAnomaly = Cesium.Math.toRadians(parseFloat(document.getElementById('trueAnomaly').value));
  
    // Validação dos valores
    if (
      isNaN(semiMajorAxis) ||
      isNaN(eccentricity) ||
      isNaN(inclination) ||
      isNaN(raan) ||
      isNaN(argPeriapsis) ||
      isNaN(trueAnomaly)
    ) {
      alert('Por favor, insira valores numéricos válidos.');
      return;
    }
  
    // Constante gravitacional padrão da Terra (m³/s²)
    const mu = 3.986004418e14;
  
    // Gera pontos ao longo da órbita
    const positions = [];
    const numberOfPoints = 360;
  
    for (let i = 0; i <= numberOfPoints; i++) {
      const theta = Cesium.Math.toRadians(i);
      const r =
        (semiMajorAxis * (1 - eccentricity * eccentricity)) /
        (1 + eccentricity * Math.cos(theta));
  
      // Coordenadas no plano orbital
      const xOrbital = r * Math.cos(theta);
      const yOrbital = r * Math.sin(theta);
      const zOrbital = 0;
  
      // Matriz de rotação total
      const rotationMatrix = Cesium.Matrix3.multiply(
        Cesium.Matrix3.multiply(
          Cesium.Matrix3.fromRotationZ(raan),
          Cesium.Matrix3.fromRotationX(inclination),
          new Cesium.Matrix3()
        ),
        Cesium.Matrix3.fromRotationZ(argPeriapsis),
        new Cesium.Matrix3()
      );
  
      // Aplica as rotações
      const positionECI = Cesium.Matrix3.multiplyByVector(
        rotationMatrix,
        new Cesium.Cartesian3(xOrbital, yOrbital, zOrbital),
        new Cesium.Cartesian3()
      );
  
      // Converte de ECI para ECEF (simplificação)
      const gmst = 0; // Tempo sideral médio de Greenwich
      const rotationEarth = Cesium.Matrix3.fromRotationZ(-gmst);
      const positionECEF = Cesium.Matrix3.multiplyByVector(
        rotationEarth,
        positionECI,
        new Cesium.Cartesian3()
      );
  
      positions.push(positionECEF);
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
    const satellite = viewer.entities.add({
      position: positions[0],
      point: {
        pixelSize: 10,
        color: Cesium.Color.RED,
      },
    });
  
    // Animação do satélite ao longo da órbita
    const property = new Cesium.SampledPositionProperty();
    const startTime = Cesium.JulianDate.now();
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
  
    for (let i = 0; i <= numberOfPoints; i++) {
      const time = Cesium.JulianDate.addSeconds(
        startTime,
        (i / numberOfPoints) * orbitalPeriod,
        new Cesium.JulianDate()
      );
      property.addSample(time, positions[i]);
    }
  
    satellite.position = property;
  
    // Configura o relógio do visualizador
    viewer.clock.startTime = startTime.clone();
    viewer.clock.stopTime = Cesium.JulianDate.addSeconds(startTime, orbitalPeriod, new Cesium.JulianDate());
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 10;
  
    // Centraliza a câmera na órbita
    viewer.zoomTo(viewer.entities);
  }
  
  // Adiciona o listener ao botão
  document.getElementById('createOrbitButton').addEventListener('click', createOrbit);
  