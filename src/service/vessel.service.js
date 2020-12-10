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

const transformSourceV1 = source => result => {
  const entry = result.body ? result.body : result;
  const { _index: index } = entry;

  const { id } = source.indicesMapped.find((it) => it.index === index);

  const baseFields = source.tileset
    ? { tilesetId: source.tileset }
    : { dataset: id };
  return {
    id: entry._id,
    ...entry._source,
    ...baseFields,
  };
}

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
    entries: body.docs.map(doc => {
      return source.version === 'v1'
        ?  transformSourceV1(source)(doc)
        : transformSource(source)(doc);
    }),
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
    entries: body.hits.hits.map(transformSourceV1(source)),
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
 /* const sanitizedQuery = type !== QUERY_TYPES.IDS
    ? sanitizeSqlQuery(query.query)
    : null;
*/
  const suggest = {
    text: query.query,
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
    basicQuery.body.query.match_phrase[SHIPNAME] = query.query;
  }

  if (type === QUERY_TYPES.TOKENS) {
    basicQuery.body.query = {
      query_string: {
        query: query.query,
        fields: getQueryFieldsFiltered(query),
        default_operator: 'and'
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

const addIndicesMappedToSource = async function (source) {
  const { body: aliases } = await elasticsearch.cat.aliases({
    format: 'json'
  })

  const indicesMapped = await Promise.all(source.datasets.map(async (dataset) => {
    const { index: iterationIndex } = dataset.configuration;
    const currentAlias = aliases.find(alias => alias.alias === iterationIndex);
    return {
      id: dataset.id,
      alias: currentAlias ? currentAlias.alias : null,
      index: currentAlias ? currentAlias.index : iterationIndex,
    }
  }));

  return { ...source, indicesMapped };
}

module.exports = source => {
  let index;
  if (source.datasets) {
    if (source.version === 'v1') {
      index = source.datasets.map(idx => idx.configuration.index).join(",");
    } else {
      index = source.dataset.vesselIndex;
    }
  } else {
    index = source.tileset.toLowerCase();
  }

  log.debug(`Searching in elasticsearch index ${index}`);

  return {

    async getAllVessels(query) {

      const sourceWithMappings = await addIndicesMappedToSource(source);

      const multiQueries = query.ids.map(id => {
        return {
          _index: index.split(","),
          _id: id,
        };
      })
      const elasticSearchQuery = { body: { docs: multiQueries } };

      return elasticsearch.mget(elasticSearchQuery)
        .then(response => {
          response.body.docs = response.body.docs.filter((doc) => doc.found === true);
          return response;
        })
        .then(transformGetAllVesselsResults({ query, source: sourceWithMappings }))
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

      const sourceWithMappings = await addIndicesMappedToSource(source);

      return elasticsearch
        .search(elasticSearchQuery)
        .then(transformSearchResults({ query, source: sourceWithMappings, includeMetadata: queryType !== QUERY_TYPES.IDS }))
    },

    async advanceSearch(query) {
      const sqlQuery = parseSqlToElasticSearchQuery(index, removeWhitespace(query.query))
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

      const sourceWithMappings = await addIndicesMappedToSource(source);

      return elasticsearch
        .search({
          index,
          from: query.offset,
          size: query.limit,
          body: {
            query: elasticSearchQuery,
          }
        })
        .then(transformSearchResults({ query, source: sourceWithMappings, includeMetadata: true }))
    },

    async getOneById(id) {

      const sourceWithMappings = await addIndicesMappedToSource(source);

      return elasticsearch.get({
        index,
        id,
      }).then(transformSourceV1(sourceWithMappings))

    },
  };
};
