const groupBy = require('lodash/fp/groupBy');
const flow = require('lodash/fp/flow');
const sql = require('../db/sql');

function toFixedDown(num, digits) {
  if (!num) {
    return 0;
  }
  return Math.floor(num * 10 ** digits);
}

function toFixedDecimal(num, digits) {
  const re = new RegExp(`(\\d+\\.\\d{${digits}})(\\d)`);
  const m = num.toString().match(re);
  return m ? parseFloat(m[1]) : num;
}

const extractCoordinates = (records, wrapLongitudes) => {
  if (wrapLongitudes === false) {
    // Hack for renderes like mapbox gl or leaflet to fix antimeridian issues
    // https://macwright.org/2016/09/26/the-180th-meridian.html
    let currentLng;
    let lngOffset = 0;
    return records.map(({ lon, lat }) => {
      if (currentLng) {
        if (lon - currentLng < -180) {
          lngOffset += 360;
        } else if (lon - currentLng > 180) {
          lngOffset -= 360;
        }
      }
      currentLng = lon;
      return [lon + lngOffset, lat];
    });
  }
  return records.map(({ lon, lat }) => [lon, lat]);
};

const extractCoordinateProperties = (features, records) => {
  return features.reduce((result, feature) => {
    if (!feature.coordinateProperty) {
      return result;
    }
    const value = records.map(record =>
      feature.formatter(record[feature.databaseField]),
    );
    return {
      ...result,
      [feature.coordinateProperty]: value,
    };
  }, {});
};

const featureSettings = {
  times: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'times',
    property: 'timestamp',
    databaseField: 'timestamp',
    formatter: value => new Date(value).getTime(),
    formatterValueArray: value => Math.floor(new Date(value).getTime() / 1000),
  },
  fishing: {
    generateGeoJSONFeatures: (features, records, params = {}) => {
      const fishingRecords = records.filter(record => record.score > 0);
      const coordinates = extractCoordinates(
        fishingRecords,
        params.wrapLongitudes,
      );
      const coordinateProperties = extractCoordinateProperties(
        features,
        fishingRecords,
      );

      return [
        {
          type: 'Feature',
          properties: {
            type: 'fishing',
            coordinateProperties,
          },
          geometry: {
            type: 'MultiPoint',
            coordinates,
          },
        },
      ];
    },
    property: 'fishing',
    databaseField: 'score',
    formatter: value => value > 0,
    formatterValueArray: value => (value > 0 ? 1 : 0),
  },
  course: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'courses',
    property: 'course',
    databaseField: 'course',
    formatter: value => value,
    formatterValueArray: value => toFixedDown(value, 6),
  },
  speed: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'speeds',
    property: 'speed',
    databaseField: 'speed',
    formatter: value => value,
    formatterValueArray: value => toFixedDown(value, 6),
  },
};

const optionalFilter = (value, filter) => (value ? filter : query => query);

const filtersFromParams = params => [
  optionalFilter(params.startDate, query =>
    query.where('timestamp', '>', params.startDate),
  ),
  optionalFilter(params.endDate, query =>
    query.where('timestamp', '<', params.endDate),
  ),
];

module.exports = ({ dataset, additionalFeatures = [], params, fields }) => {
  let featureNames;
  if (additionalFeatures.indexOf('timestamp') >= 0) {
    featureNames = additionalFeatures.map(f => {
      if (f === 'timestamp') {
        return 'times';
      }
      return f;
    });
  } else {
    featureNames = ['times', ...additionalFeatures];
  }
  const features = featureNames.map(name => featureSettings[name]);

  return {
    load(vesselId) {
      const additionalSelectFields = features.map(
        feature => feature.databaseField,
      );
      const baseQuery = sql
        .select(
          'seg_id',
          sql.raw('ST_X("position"::geometry) AS "lon"'),
          sql.raw('ST_Y("position"::geometry) AS "lat"'),
          ...additionalSelectFields,
        )
        .from(dataset.tracksTable)
        .where('vessel_id', vesselId)
        .orderBy(['seg_id', 'timestamp']);

      return flow(...filtersFromParams(params))(baseQuery);
    },

    formatters: {
      lines(records) {
        const segments = groupBy(record => record.seg_id)(records);

        const trackGeoJSONFeatures = Object.entries(segments).map(
          ([segment, segmentRecords]) => {
            const coordinates = extractCoordinates(
              segmentRecords,
              params.wrapLongitudes,
            );
            const coordinateProperties = extractCoordinateProperties(
              features,
              segmentRecords,
            );

            return {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates,
              },
              properties: {
                type: 'track',
                segId: segment,
                coordinateProperties,
              },
            };
          },
        );

        const additioanlGeoJSONFeatures = features.reduce((result, feature) => {
          return result.concat(
            feature.generateGeoJSONFeatures(features, records),
          );
        }, []);

        return {
          type: 'FeatureCollection',
          features: [...trackGeoJSONFeatures, ...additioanlGeoJSONFeatures],
        };
      },

      points(records) {
        const geoJSONFeatures = records.map(record => {
          const properties = features.reduce((result, feature) => {
            const value = feature.formatter(record[feature.databaseField]);
            return {
              ...result,
              [feature.property]: value,
            };
          }, {});

          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [record.lon, record.lat],
            },
            properties: {
              segId: record.seg_id,
              ...properties,
            },
          };
        });

        return {
          type: 'FeatureCollection',
          features: geoJSONFeatures,
        };
      },
      valueArray(records) {
        let segId = null;
        const valueArray = [];
        let numSegments = 0;
        const indexSegments = [];
        let index = 0;
        records.forEach(record => {
          if (segId !== record.seg_id) {
            segId = record.seg_id;
            numSegments += 1;
            indexSegments.push(index);
          }
          if (fields.indexOf('lonlat') >= 0) {
            valueArray.push(toFixedDown(record.lon, 6));
            valueArray.push(toFixedDown(record.lat, 6));
            index += 2;
          }
          features.forEach(f => {
            if (fields.indexOf(f.property) >= 0) {
              valueArray.push(f.formatterValueArray(record[f.databaseField]));
              index += 1;
            }
          });
        });
        if (numSegments === 0) {
          return [];
        }

        return [numSegments].concat(indexSegments, valueArray);
      },
    },
  };
};
