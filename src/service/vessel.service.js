/* eslint-disable no-underscore-dangle */
const elasticsearch = require('../db/elasticsearch');
const log = require('../log');
const { parseSqlToElasticSearchQuery } = require('../parser/sql-parser');
const { VESSELS_CONSTANTS: { IMO, MMSI, SHIPNAME, FLAG, VESSEL_ID, QUERY_TYPES } } = require('../constant');
const { sanitizeSQL } = require('../utils/sanitize-sql');
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');

const transformSearchResult = source => entry => {
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

const sanitizeQuery = query => {
  /*eslint-disable */
  return query
    .replace(/[*\+\-=~><\"\?^\${}\(\)\:\!\/[\]\\\s]/g, '\\$&')
    .replace(/\|\|/g, '\\||') // replace ||
    .replace(/\&\&/g, '\\&&')
    .replace(/AND/g, '\\A\\N\\D')
    .replace(/OR/g, '\\O\\R')
    .replace(/NOT/g, '\\N\\O\\T');
  /* eslint-enable */
};


const calculateNextOffset = (query, results) =>
  query.offset + query.limit <= results.hits.total.value
    ? query.offset + query.limit
    : null;

const transformSearchResults = ({ query, source, includeMetadata }) => results => {
  const { body } = results;
  return {
    query: query.query,
    total: body.hits.total,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, body),
    entries: body.hits.hits.map(transformSearchResult(source)),
    metadata: includeMetadata && includeMetadata === true && body.suggest ?
      { suggestion: transformSuggestResult(body.suggest.searchSuggest, query.query) }
      : undefined,
  };
};

const transformSuggestionsResults = ({
                                       results,
                                       source,
                                     }) => suggestionResults => {
  const suggestionResultsTransformed = suggestionResults.hits.hits.map(
    transformSearchResult(source),
  );
  if (!results.length) return suggestionResultsTransformed;

  // Remove possible duplicates
  return suggestionResultsTransformed.filter(
    result =>
      !results.some(suggestedResult => suggestedResult.id === result.id),
  );
};

const getQueryByType = (type, index, query) => {
  const sanitizedQuery = sanitizeQuery(query.query);

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
      const queryType = /^".*"$/.test(query.query)
        ? QUERY_TYPES.PHRASE
        : QUERY_TYPES.TOKENS;
      log.info(`The query type is ${queryType}`, )
      const elasticSearchQuery = getQueryByType(queryType, index, query)
      log.info(`The query is ${JSON.stringify(elasticSearchQuery)}`, )
      return elasticsearch
        .search(elasticSearchQuery)
        .then(transformSearchResults({ query, source, includeMetadata: true }));
    },

    async advanceSearch(query) {
      const { dataset: { configuration: { index: table } } } = source;
      const sqlQuery = parseSqlToElasticSearchQuery(table, sanitizeSQL(query.query))
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

    async get(vesselId) {
      const query = {
        index,
        size: 1,
        body: {
          query: {
            query_string: {
              query: vesselId,
              fields: [VESSEL_ID]
            }
          }
        }
      }
      const { body: { hits: { hits: vessels } } } = await elasticsearch.search(query);
      if (!vessels[0]) {
        return null;
      }
      const { _source: vesselInfo } = vessels[0];
      if (vesselInfo.id !== vesselId){
        return null;
      }

      return (transformSearchResult(source)(vessels[0]))
    },
  };
};
