const { bearing, point, distance } = require('@turf/turf');

function thinning(
  records,
  {
    distanceFishing,
    bearingValFishing,
    minAccuracyFishing,
    changeSpeedFishing,
    distanceEncounter,
    bearingValEncounter,
    minAccuracyEncounter,
    changeSpeedEncounter,
    distanceTransit,
    bearingValTransit,
    minAccuracyTransit,
    changeSpeedTransit,
  },
) {
  const results = [];
  let previous;
  let addNextPoint = false;
  for (let i = 0; i < records.length; i++) {
    if (i === 0 || addNextPoint) {
      results.push(records[i]);
      addNextPoint = false;
      // addSpeed++;
      continue;
    }
    const actual = records[i];
    previous = results[results.length - 1];
    if (
      actual.fishing !== previous.fishing ||
      actual.encounter !== previous.encounter
    ) {
      results.push(actual);
      continue;
    }
    const diff =
      (new Date(actual.timestamp).getTime() -
        new Date(previous.timestamp).getTime()) /
      60000;
    if (
      (actual.fishing && diff > minAccuracyFishing) ||
      (actual.encounter && diff > minAccuracyEncounter) ||
      (!actual.fishing && !actual.encounter && diff > minAccuracyTransit)
    ) {
      results.push(actual);
      continue;
    }

    if (i >= 1) {
      const actualPoint = point([actual.lon, actual.lat]);
      const previousPoint = point([previous.lon, previous.lat]);
      actual.bearing = bearing(previousPoint, actualPoint);
      actual.distance = distance(previousPoint, actualPoint);
    }
    if (
      (changeSpeedFishing !== undefined ||
        changeSpeedTransit !== undefined ||
        changeSpeedEncounter !== undefined) &&
      i < records.length - 1
    ) {
      if (
        (actual.fishing &&
          previous.fishing &&
          Math.abs((actual.speed / previous.speed) * 100 - 100) >
            changeSpeedFishing) ||
        (actual.encounter &&
          previous.encounter &&
          Math.abs((actual.speed / previous.speed) * 100 - 100) >
            changeSpeedEncounter) ||
        (!actual.fishing &&
          !actual.encounter &&
          !previous.fishing &&
          !previous.encounter &&
          Math.abs((actual.speed / previous.speed) * 100 - 100) >
            changeSpeedTransit)
      ) {
        results.push(actual);
        addNextPoint = true;
        continue;
      }
    }

    if (
      (actual.fishing &&
        previous.fishing &&
        Math.abs(actual.distance) < distanceFishing) ||
      (actual.encounter &&
        previous.encounter &&
        Math.abs(actual.distance) < distanceEncounter) ||
      (!actual.fishing &&
        !previous.fishing &&
        !actual.encounter &&
        !previous.encounter &&
        Math.abs(actual.distance) < distanceTransit)
    ) {
      if (actual.fishing) {
        console.log('Distance ', Math.abs(actual.distance));
      }
      continue;
    }

    if (
      (bearingValFishing !== undefined ||
        bearingValTransit !== undefined ||
        bearingValEncounter !== undefined) &&
      i < records.length - 1
    ) {
      const actualPoint = point([actual.lon, actual.lat]);
      const nextPoint = point([records[i + 1].lon, records[i + 1].lat]);
      const nextBearing = bearing(actualPoint, nextPoint);
      if (
        (actual.fishing &&
          previous.fishing &&
          records[i + 1].fishing &&
          Math.abs(nextBearing - actual.bearing) < bearingValFishing) ||
        (actual.encounter &&
          previous.encounter &&
          records[i + 1].encounter &&
          Math.abs(nextBearing - actual.bearing) < bearingValEncounter) ||
        (!actual.fishing &&
          !previous.fishing &&
          !records[i + 1].fishing &&
          !actual.encounter &&
          !previous.encounter &&
          !records[i + 1].encounter &&
          Math.abs(nextBearing - actual.bearing) < bearingValTransit)
      ) {
        if (actual.fishing) {
          console.log('Bearing ', Math.abs(nextBearing - actual.bearing));
        }
        continue;
      }
    }
    results.push(actual);
  }

  return results;
}

module.exports = thinning;
