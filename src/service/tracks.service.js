const groupBy = require('lodash/fp/groupBy');
const flow = require('lodash/fp/flow');
const sql = require('../db/sql');
const sqlFishing = require('../db/sql-fishing');
const sqlFishingTracks = require('../db/sql-fishing-tracks');

function toFixedDown(num, digits) {
  if (!num) {
    return 0;
  }
  return Math.floor(num * 10 ** digits);
}

const nullValue = -2147483648;

const extractCoordinates = (records, wrapLongitudes) => {
  if (wrapLongitudes === false) {
    // Hack for renderes like mapbox gl or leaflet to fix antimeridian issues
    // https://macwright.org/2016/09/26/the-180th-meridian.html
    let currentLon;
    let lonOffset = 0;
    return records.map(({ lon, lat }) => {
      if (currentLon) {
        if (lon - currentLon < -180) {
          lonOffset += 360;
        } else if (lon - currentLon > 180) {
          lonOffset -= 360;
        }
      }
      currentLon = lon;
      return [lon + lonOffset, lat];
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
    generateGeoJSONFeatures: () => [],
    property: 'fishing',
    coordinateProperty: 'fishing',
    databaseField: 'fishing',
    formatter: value => value,
    formatterValueArray: value => (value ? 1 : 0),
  },
  encounter: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'encounters',
    property: 'encounter',
    databaseField: 'encounter',
    formatter: value => value,
    formatterValueArray: value => (value ? 1 : 0),
  },
  course: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'courses',
    property: 'course',
    databaseField: 'course',
    formatter: value => value,
    formatterValueArray: value =>
      value !== undefined ? toFixedDown(value, 6) : nullValue,
  },
  elevation: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'elevations',
    property: 'elevation',
    databaseField: 'elevation_m',
    formatter: value => value,
    formatterValueArray: value =>
      value !== undefined ? toFixedDown(value, 6) : nullValue,
  },
  night: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'nights',
    property: 'night',
    databaseField: 'night',
    formatter: value => value,
    formatterValueArray: value => (value ? 1 : 0),
  },
  speed: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'speeds',
    property: 'speed',
    databaseField: 'speed',
    formatter: value => value,
    formatterValueArray: value =>
      value !== undefined ? toFixedDown(value, 6) : nullValue,
  },
  distance_from_shore: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'distance_from_shore',
    property: 'distance_from_shore',
    databaseField: 'distance_from_shore',
    formatter: value => value,
    formatterValueArray: value =>
      value !== undefined ? toFixedDown(value, 0) : nullValue,
  },
  distance_from_port: {
    generateGeoJSONFeatures: () => [],
    coordinateProperty: 'distance_from_port',
    property: 'distance_from_port',
    databaseField: 'distance_from_port',
    formatter: value => value,
    formatterValueArray: value =>
      value !== undefined ? toFixedDown(value, 0) : nullValue,
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

module.exports = ({
  dataset,
  additionalFeatures = [],
  params,
  fields,
  version = 'v0',
}) => {
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
        .from(
          version === 'v1' ? dataset.configuration.table : dataset.tracksTable,
        )
        .where('vessel_id', vesselId)
        .orderBy(['seg_id', 'timestamp']);

      return flow(...filtersFromParams(params))(baseQuery);
    },
    loadV1(vesselId) {
      const additionalSelectFields = features.map(
        feature => feature.databaseField,
      );
      const db = dataset.id === 'fishing-tracks:v20190502' ? sqlFishingTracks : sqlFishing;
      const baseQuery = db
        .select(
          'seg_id',
          'lat',
          'lon',
          ...additionalSelectFields,
        )
        .from(
          version === 'v1' ? dataset.configuration.table : dataset.tracksTable,
        )
        .where('vessel_id', vesselId)
        .orderBy(['seg_id', 'timestamp']);

      return flow(...filtersFromParams(params))(baseQuery);
    },
    loadCarriers(vesselId) {
      const additionalSelectFields = features.map(
        feature => feature.databaseField,
      );
      let startDate = new Date('2017-01-01T00:00:00.000Z');
      let endDate = new Date('2017-12-31T23:59:59.000Z');
      if (params.startDate && params.startDate > startDate) {
        startDate = params.startDate;
      }
      if (params.endDate && params.endDate < endDate) {
        endDate = params.endDate;
      }
      let baseQuery = null;
      const unions = [];
      const date = new Date(startDate.getTime());

      while (date < endDate) {
        const q = sqlFishing
          .select(
            'seg_id',
            sqlFishing.raw('lon'),
            sqlFishing.raw('lat'),
            ...additionalSelectFields,
          )
          .from(`carriers_${date.getFullYear()}`)
          .where('vessel_id', vesselId);

        if (!baseQuery) {
          q.where('timestamp', '>', startDate);
          baseQuery = q;
        } else {
          unions.push(q);
        }
        date.setFullYear(date.getFullYear() + 1);
      }
      if (!baseQuery) {
        return [];
      }
      if (unions.length > 0) {
        unions[unions.length - 1].where('timestamp', '<', endDate);
        baseQuery = baseQuery.union(unions);
      } else {
        baseQuery = baseQuery.where('timestamp', '<', endDate);
      }
      const q = sqlFishing
        .with('total', baseQuery)
        .select(
          'seg_id',
          sqlFishing.raw('lon'),
          sqlFishing.raw('lat'),
          ...additionalSelectFields,
        )
        .from('total')
        .orderBy(['seg_id', 'timestamp']);

      return q;
    },
    loadFishing(vesselId, table) {
      const additionalSelectFields = features.map(
        feature => feature.databaseField,
      );
      let startDate = new Date('2012-01-01T00:00:00.000Z');
      let endDate = new Date('2019-12-31T23:59:59.000Z');
      if (params.startDate && params.startDate > startDate) {
        startDate = params.startDate;
      }
      if (params.endDate && params.endDate < endDate) {
        endDate = params.endDate;
      }

      const q = sqlFishing
        .select(
          'seg_id',
          sqlFishing.raw('lon'),
          sqlFishing.raw('lat'),
          ...additionalSelectFields,
        )
        .from(table)
        .where('vessel_id', vesselId)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .orderBy(['seg_id', 'timestamp']);

      return q;
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

        let currentLon;
        let lonOffset = 0;

        records.forEach(record => {
          if (segId !== record.seg_id) {
            segId = record.seg_id;
            numSegments += 1;
            indexSegments.push(index);
            currentLon = 0;
            lonOffset = 0;
          }
          if (fields.indexOf('lonlat') >= 0) {
            if (params.wrapLongitudes === false) {
              if (currentLon) {
                if (record.lon - currentLon < -180) {
                  lonOffset += 360;
                } else if (record.lon - currentLon > 180) {
                  lonOffset -= 360;
                }
              }
              currentLon = record.lon;
              valueArray.push(toFixedDown(record.lon + lonOffset, 6));
            } else {
              valueArray.push(toFixedDown(record.lon, 6));
            }
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

        return [-2147483648, numSegments].concat(indexSegments, valueArray);
      },
    },
  };
};
