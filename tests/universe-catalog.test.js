import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { journeyStops, exoplanetStop } from '../src/universe/catalog.js';

const snapshot = JSON.parse(await readFile(new URL('../public/universe/exoplanets.json', import.meta.url), 'utf8'));
function assertScene(stop) {
  assert.ok(stop.name && stop.description && stop.voice);
  assert.equal(new Set(stop.bodies.map(body => body.id)).size, stop.bodies.length);
  for (const body of stop.bodies) {
    assert.ok(body.radius > 0 && Number.isFinite(body.radius), body.id);
    assert.equal(body.position.length, 3);
    assert.ok(body.position.every(Number.isFinite), body.id);
    assert.ok(body.description && body.detailFacts.length, body.id);
    assert.ok(['science.nasa.gov', 'exoplanetarchive.ipac.caltech.edu'].includes(new URL(body.sourceUrl).hostname));
  }
}

test('journey moves from Earth through seven nested scopes and covers all eight planets', () => {
  const names = new Set(journeyStops.map(stop => stop.id));
  assert.equal(names.size, 7);
  assert.equal(journeyStops[0].id, 'earth-launch');
  let current = journeyStops[0], seen = new Set();
  while (current) {
    assert.ok(!seen.has(current.id), 'scope hierarchy must not cycle');
    seen.add(current.id);
    assertScene(current);
    current = current.parentId ? journeyStops.find(stop => stop.id === current.parentId) : null;
  }
  assert.equal(seen.size, 7);
  const solar = journeyStops.find(stop => stop.id === 'solar');
  assert.equal(solar.bodies.filter(body => body.kind === 'planet').length, 8);
  assert.equal(solar.bodies.filter(body => body.kind === 'dwarf').length, 5);
  for (const moon of solar.bodies.filter(body => body.kind === 'moon')) {
    assert.ok(solar.bodies.some(body => body.id === moon.parentBodyId), moon.id);
  }
});

test('bundled catalogue counts match unique records and every real system can produce a finite scene', () => {
  assert.equal(snapshot.systemCount, snapshot.systems.length);
  assert.equal(snapshot.planetCount, snapshot.systems.reduce((count, system) => count + system.planets.length, 0));
  assert.equal(new Set(snapshot.systems.map(system => system.id)).size, snapshot.systemCount);
  const planetIds = snapshot.systems.flatMap(system => system.planets.map(planet => planet.id));
  assert.equal(new Set(planetIds).size, snapshot.planetCount);
  assert.ok(snapshot.systemCount > 4000 && snapshot.planetCount > 5000, 'full archive catalogue must not become a small demo sample');
  assert.equal(new URL(snapshot.sourceUrl).hostname, 'exoplanetarchive.ipac.caltech.edu');
  assert.equal(new URL(snapshot.sourceUrl).searchParams.get('query').includes('from pscomppars'), true);
  for (const system of snapshot.systems) {
    const scene = exoplanetStop(system);
    assertScene(scene);
    assert.equal(scene.bodies.filter(body => body.kind === 'planet').length, system.planets.length, system.name);
  }
});

test('unknown measurements stay unknown while the demonstration remains navigable', () => {
  const system = { id: 'unknown', name: 'Unknown sample', distanceLy: null, stars: null, temperatureK: null, starRadiusSolar: null,
    planets: [{ id: 'p', name: 'Unknown sample b', letter: 'b', radiusEarth: null, massEarth: null, orbitalPeriodDays: null, semiMajorAxisAU: null }] };
  const scene = exoplanetStop(system);
  assertScene(scene);
  assert.ok(scene.bodies[0].description.includes('距离在当前归档字段中未知'));
  assert.ok(!scene.bodies[0].description.includes('距地球离'));
  const planet = scene.bodies.find(body => body.id === 'p');
  assert.equal(planet.catalogue.radiusEarth, null);
  assert.equal(planet.catalogue.massEarth, null);
  assert.equal(planet.catalogue.orbitalPeriodDays, null);
  assert.equal(planet.catalogue.semiMajorAxisAU, null);
  assert.equal(planet.detailFacts.filter(fact => fact.includes('归档中未提供')).length, 4);
  assert.ok(!scene.voice.includes('0 光年'));
});

test('systems with more than eight planets are preserved and ordered without mixing AU with days', () => {
  const planets = Array.from({ length: 13 }, (_, index) => ({ id: 'p' + index, name: 'Large ' + index,
    radiusEarth: 1, massEarth: 1, orbitalPeriodDays: 20 - index, semiMajorAxisAU: index < 11 ? 12 - index : null }));
  const scene = exoplanetStop({ id: 'large', name: 'Large', planets, distanceLy: 20, stars: 1 });
  assertScene(scene);
  const rendered = scene.bodies.filter(body => body.kind === 'planet');
  assert.equal(rendered.length, 13);
  assert.deepEqual(rendered.slice(0, 11).map(body => body.catalogue.semiMajorAxisAU), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(rendered.slice(11).map(body => body.catalogue.orbitalPeriodDays), [8, 9]);
  assert.deepEqual(planets.map(planet => planet.id), Array.from({ length: 13 }, (_, index) => 'p' + index), 'conversion must not mutate input order');
});

test('mass provenance and archive controversy survive into educational facts', () => {
  const scene = exoplanetStop({ id: 'mass', name: 'Mass', planets: [
    { id: 'minimum', name: 'Mass b', massEarth: 3, massProvenance: 'Msini', controversial: true },
    { id: 'estimated', name: 'Mass c', massEarth: 4, massProvenance: 'M-R relationship' },
  ] });
  const minimum = scene.bodies.find(body => body.id === 'minimum');
  const estimated = scene.bodies.find(body => body.id === 'estimated');
  assert.ok(minimum.detailFacts.some(fact => fact.includes('最低质量 M sin i')));
  assert.ok(minimum.detailFacts.some(fact => fact.includes('确认状态在文献中存在争议')));
  assert.ok(estimated.detailFacts.some(fact => fact.includes('按质量半径关系估计的质量')));
});
