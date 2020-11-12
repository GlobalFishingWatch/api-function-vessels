/* eslint-disable no-underscore-dangle */
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const elasticsearch = require('../db/elasticsearch');
const { log } = require('gfw-api-utils').logger;
const { parseSqlToElasticSearchQuery } = require('../parser/sql-parser');
const { mappingToSchema } = require('../parser/mapping-to-schema');
const { VESSELS_CONSTANTS: { IMO, MMSI, SHIPNAME, FLAG, VESSEL_ID, QUERY_TYPES } } = require('../constant');
const { removeWhitespace } = require('../utils/remove-whitespace');
const { sanitizeSqlQuery } = require('../utils/sanitize-sql');

const transformSource = source => result => {
  const entry = result.body ? result.body : result;
  const baseFields = source.tileset
    ? { tilesetId: source.tileset }
    : { dataset: source.dataset.name };
  const {
    firstTimestamp: firstTransmissionDate,
    lastTimestamp: lastTransmissionDate,
    ...entrySource
  } = entry._source;

  return {
    id: entry._id,
    ...entrySource,
    ...baseFields,
    firstTransmissionDate,
    lastTransmissionDate,
  };
};

const transformSuggestResult = (suggests, query) => {
  const suggestion = suggests
    .map(it => it.options.length ? it.options[0].text : it.text)
    .join(" ")
    .toUpperCase();
  return query.toUpperCase() !== suggestion ? suggestion : null;
}

const getQueryFieldsFiltered = (query) => {
  if (query.queryFields.length > 0) {
    return query.queryFields
  }

  if (/^\d{7}$/.test(query.query.trim())) {
    return [IMO]
  }

  if (/^\d{9}$/.test(query.query.trim())) {
    return [MMSI]
  }

  return [SHIPNAME, FLAG, VESSEL_ID, IMO, MMSI]
}

const calculateNextOffset = (query, results) =>
  query.offset + query.limit <= results.hits.total.value
    ? query.offset + query.limit
    : null;


const transformGetAllVesselsResults = ({ query, source }) => results => {
  const { body } = results;
  return {
    total: body.docs.length,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, { hits: { total: { value: body.docs.length } } }),
    entries: body.docs.map(transformSource(source)),
  };
};

const transformGetVesselSchemaResults = () => results => {
  const { body } = results;
  const indexNameFromES = Object.keys(body)[0];
  const { mappings: { properties } } = body[indexNameFromES];
  return mappingToSchema(properties);
};

const transformSearchResults = ({ query, source, includeMetadata }) => results => {
  const { body } = results;
  return {
    query: query.query,
    total: body.hits.total,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, body),
    entries: body.hits.hits.map(transformSource(source)),
    metadata: includeMetadata && includeMetadata === true && body.suggest ?
      { suggestion: transformSuggestResult(body.suggest.searchSuggest, query.query) }
      : undefined,
  };
};

const transformSuggestionsResults = ({
                                       results,
                                       source,
                                     }) => suggestionResults => {
  const suggestionResultsTransformed = suggestionResults.body.hits.hits.map(
    transformSource(source),
  );
  if (!results.length) return suggestionResultsTransformed;

  // Remove possible duplicates
  return suggestionResultsTransformed.filter(
    result =>
      !results.some(suggestedResult => suggestedResult.id === result.id),
  );
};

const getQueryByType = (type, index, query) => {
  const sanitizedQuery = type !== QUERY_TYPES.IDS
    ? sanitizeSqlQuery(query.query)
    : null;

  const suggest = {
    text: sanitizedQuery,
    searchSuggest: {
      term: {
        field: query.suggestField,
      },
    },
  };

  const basicQuery = {
    index,
    from: query.offset || 0,
    size: query.limit || 10,
    body: {
      query: {},
      suggest,
    },
  };

  if (type === QUERY_TYPES.PHRASE) {
    basicQuery.body.query = {
      match_phrase: {}
    }
    basicQuery.body.query.match_phrase[SHIPNAME] = sanitizedQuery;
  }

  if (type === QUERY_TYPES.TOKENS) {
    basicQuery.body.query = {
      query_string: {
        query: sanitizedQuery,
        fields: getQueryFieldsFiltered(query),
      },
    }
  }

  return basicQuery;
}

function getQueryType(query) {
  return /^".*"$/.test(query.query)
    ? QUERY_TYPES.PHRASE
    : QUERY_TYPES.TOKENS;
}

module.exports = source => {
  let index;
  if (source.dataset) {
    if (source.version === 'v1') {
      index = source.dataset.configuration.index;
    } else {
      index = source.dataset.vesselIndex;
    }
  } else {
    index = source.tileset.toLowerCase();
  }

  log.debug(`Searching in elasticsearch index ${index}`);

  return {

    async getAllVessels(query) {
      const multiQueries = query.ids.map(id => {
        return {
          _index: index,
          _id: id,
        };
      })
      const elasticSearchQuery = { body: { docs: multiQueries } };
      return elasticsearch.mget(elasticSearchQuery)
        .then(transformGetAllVesselsResults({ query, source }))
    },

    async getVesselsSchema() {
      log.info(`Getting mapping for index ${ index }`);
      return elasticsearch.indices.getMapping({ index })
        .then(transformGetVesselSchemaResults({ source }));
    },

    async search(query) {
      const elasticSearchQuery = {
        index,
        from: query.offset || 0,
        size: query.limit || 10,
        body: {
          query: {
            query_string: {
              query: `*${query.query}*`,
              allow_leading_wildcard: true,
              ...(query.queryFields && { fields: query.queryFields }),
            },
          },
        },
      };

      const results = await elasticsearch
        .search(elasticSearchQuery)
        .then(transformSearchResults({ query, source }));

      if (query.querySuggestions) {
        const elasticSearchQueryFuzzy = {
          ...elasticSearchQuery,
          body: {
            query: {
              query_string: {
                ...elasticSearchQuery.body.query.query_string,
                query: `${query.query}~`,
              },
            },
          },
        };

        const suggestions = await elasticsearch
          .search(elasticSearchQueryFuzzy)
          .then(
            transformSuggestionsResults({
              query,
              source,
              results: results.entries,
            }),
          );
        results.suggestions = suggestions;
      }

      return results;
    },

    async searchWithSuggest(query) {
      const queryType = getQueryType(query.query);
      log.info(`The query type is ${queryType}`, )
      const elasticSearchQuery = getQueryByType(queryType, index, query)
      log.info(`The query is ${JSON.stringify(elasticSearchQuery)}`, )
      return elasticsearch
        .search(elasticSearchQuery)
        .then(transformSearchResults({ query, source, includeMetadata: queryType !== QUERY_TYPES.IDS }));
    },

    async advanceSearch(query) {
      const { dataset: { configuration: { index: table } } } = source;
      const sqlQuery = parseSqlToElasticSearchQuery(table, removeWhitespace(query.query))
      log.info(`SQL Query > ${sqlQuery}`)
      const { body: { query: elasticSearchQuery } } = await elasticsearch.sql.translate({
        body: {
          query: sqlQuery
        }
      }).catch(err => {
        const message = err.meta && err.meta.body && err.meta.body.error && err.meta.body.error.reason
          ? `Invalid Query: ${ err.meta.body.error.reason.replace(/line \d{0,}:\d{0,}: /, '').replace('double ', '').replace('\n', ', ') }`
          : 'Invalid Query';
        throw new UnprocessableEntityException('Invalid Query: ', {
          message,
          path: ['query']
        })
      })
      return elasticsearch
        .search({
          body: {
            from: query.offset,
            size: query.limit,
            query: elasticSearchQuery
          }
        })
        .then(transformSearchResults({ query, source, includeMetadata: true }))
    },

    async getOneById(id) {
      return elasticsearch.get({
        index,
        id,
      }).then(transformSource(source))

    },
  };
};
