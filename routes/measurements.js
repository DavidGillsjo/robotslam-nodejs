const express = require('express');
const yaml = require('js-yaml');
const models = require('../models');
const Transformer = require('../modules/transformer');
const exportCsv = require('../modules/wifi/export2');
const ros = require('../modules/ros');

const router = express.Router();

router.get('/', async function (req, res) {
  //noinspection JSUnresolvedVariable,JSUnresolvedFunction
  const measurements = await models.measurement.findAll({
    attributes: ['id', 'created_at'],
    include: [{
      model: models.map,
      include: [models.building],
      required: false,
    }],
    order: [['id', 'asc']],
  });

  res.render('measurements/index', {
    title: 'Measurements',
    active: ros.active,
    measurements: measurements.map((m) => m.get()),
  });
});

router.get('/:id', async function (req, res) {
  const measurement = await models.measurement.find({
    where: {
      id: req.params.id,
    },
    include: [
      models.map,
      {
        model: models.measurementPoint,
        include: [{
          model: models.measurementPointWifi
        }]
      }
    ],
    order: [[models.measurementPoint, 'time', 'asc']],
  });

  const map = measurement.map;

  const description = {
    origin: [map.origin_x, map.origin_y, map.origin_yaw],
    gps_references: [
      {
        x: 0,
        y: map.height * map.resolution,
        lat: map.ref_topleft.coordinates[0],
        lng: map.ref_topleft.coordinates[1],
      },
      {
        x: map.width * map.resolution,
        y: map.height * map.resolution,
        lat: map.ref_topright.coordinates[0],
        lng: map.ref_topright.coordinates[1],
      },
      {
        x: 0,
        y: 0,
        lat: map.ref_bottomleft.coordinates[0],
        lng: map.ref_bottomleft.coordinates[1],
      }
    ]
  };

  const transformer = new Transformer(description);
  const coords = [];

  measurement.measurementPoints.forEach((point) => {
    transformedPoint = transformer.transformPoint(point.x, point.y);
    coords.push([transformedPoint.x, transformedPoint.y]);
  });

  res.render('measurements/view', {
    title: 'Measurements',
    measurement: measurement,
    coords: JSON.stringify(coords)
  });
});

router.get('/:id/export', async function (req, res) {
  // duplicate code, maybe fix this when we add Oscars improved gps_references ref_topleft stuff.
  const measurement = await models.measurement.find({
    where: {
      id: req.params.id,
    },
    // attributes: [
    //   '*',
    //   [models.sequelize.fn('extract', models.sequelize.query('epoch from time')), 'stamp']
    // ],
    include: [
      models.map,
      {
        model: models.measurementPoint,
        include: [{
          model: models.measurementPointWifi
        }]
      }
    ],
    order: [[models.measurementPoint, 'time', 'asc']],
  });

  const points = measurement.measurementPoints;
  const map = measurement.map;

  const description = {
    origin: [map.origin_x, map.origin_y, map.origin_yaw],
    gps_references: [
      {
        x: 0,
        y: map.height * map.resolution,
        lat: map.ref_topleft.coordinates[0],
        lng: map.ref_topleft.coordinates[1],
      },
      {
        x: map.width * map.resolution,
        y: map.height * map.resolution,
        lat: map.ref_topright.coordinates[0],
        lng: map.ref_topright.coordinates[1],
      },
      {
        x: 0,
        y: 0,
        lat: map.ref_bottomleft.coordinates[0],
        lng: map.ref_bottomleft.coordinates[1],
      }
    ]
  };

  const transformer = new Transformer(description);
  const output = await exportCsv(points, transformer);

  //res.setHeader('Content-Disposition', 'attachment; filename=' + newFilename);
  res.setHeader('Content-Disposition', `inline; filename=measurement_${req.params.id}.csv`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(output);
});

router.post('/:id/export/visualize', async(req, res) => {

  const points = await models.measurementPoint.findAll({
    include: [models.measurementPointWifi]
  });

  const description = yaml.load(req.files.map_description.data);
  const transformer = new Transformer(description);
  const coords = [];

  points.forEach((point) => {
    transformedPoint = transformer.transformPoint(point.x, point.y);
    coords.push([transformedPoint.x, transformedPoint.y]);
  });

  res.render('export_visualize', {
    title: 'Export',
    coords: JSON.stringify(coords)
  });
});

module.exports = router;
