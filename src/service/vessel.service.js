/* eslint-disable no-underscore-dangle */
const {
  errors: { UnprocessableEntityException },
} = require('auth-middleware');
const elasticsearch = require('../db/elasticsearch');
const { log } = require('gfw-api-utils').logger;
const { parseSqlToElasticSearchQuery } = require('../parser/sql-parser');
const { mappingToSchema } = require('../parser/mapping-to-schema');
const { VESSELS_CONSTANTS: { DEFAULT_PROPERTY_SUGGEST } } = require('../constant');
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

const getQueryFieldsFiltered = (query, fieldsToSearch) => {
  if (query.queryFields.length === 0) {
    return fieldsToSearch;
  }

  query.queryFields.forEach((field) => {
    if (!fieldsToSearch.includes(field)) {
      throw new UnprocessableEntityException('Invalid Query: ', {
        message: `${field} is not an allowed field to search`,
        path: ['queryFields']
      })
    }
  })

  return query.queryFields;
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

const transformSearchResults = ({ query, source }) => results => {
  const { body } = results;
  return {
    query: query.query,
    total: body.hits.total,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, body),
    entries: body.hits.hits.map(transformSource(source)),
  };
};

const transformSearchResultsV1 = ({ query, source, includeMetadata }) => results => {
  const { body } = results;
  return {
    query: query.query,
    total: body.hits.total,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, body),
    entries: body.hits.hits.map(transformSourceV1(source)),
    metadata: includeMetadata && includeMetadata === true && body.suggest ?
      { suggestion: transformSuggestResult(body.suggest.searchSuggest, query.query), field: query.suggestField || DEFAULT_PROPERTY_SUGGEST }
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

const getQueryByType = (index, query, fieldsToSearch) => {
  const sanitizedQuery = sanitizeSqlQuery(query.query);
  log.info(`Query sanitized: ${sanitizedQuery}`);

  const fieldsToSearchCleared = fieldsToSearch.filter(field => !['lastTransmissionDate', 'firstTransmissionDate'].includes(field))
  const fields = getQueryFieldsFiltered(query, fieldsToSearchCleared);
  log.info(`Fields to search: ${fields}`);

  const suggestField = query.suggestField || DEFAULT_PROPERTY_SUGGEST;
  log.info(`Result based on suggest field: ${suggestField}`);


  return {
    index,
    from: query.offset || 0,
    size: query.limit || 10,
    body: {
      query: {
        query_string: {
          query: sanitizedQuery,
          fields,
          default_operator: 'and'
        }
      },
      suggest: {
        text: sanitizedQuery,
        searchSuggest: {
          term: {
            field: suggestField,
          },
        },
      },
    }
  };
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

const indexFromSource = (source) => {
  if (source.datasets && source.version === 'v1') {
      return source.datasets.map(idx => idx.configuration.index).join(",");
  } else if (source.dataset) {
      return source.dataset.vesselIndex;
  }

  return source.tileset.toLowerCase();
}

module.exports = source => {
  const index = indexFromSource(source);
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
      const elasticSearchQuery = getQueryByType(index, query, source.fieldsToSearch)
      log.info(`The query is ${JSON.stringify(elasticSearchQuery)}`, )

      const sourceWithMappings = await addIndicesMappedToSource(source);
      return elasticsearch
        .search(elasticSearchQuery)
        .then(transformSearchResultsV1({ query, source: sourceWithMappings, includeMetadata: true }))
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
        .then(transformSearchResultsV1({ query, source: sourceWithMappings, includeMetadata: true }))
    },

    async getOneById(id) {
      if (source.version === 'v1') {
        const sourceWithMappings = await addIndicesMappedToSource(source);
        return elasticsearch.get({
          index,
          id,
        }).then(transformSourceV1(sourceWithMappings))
      }
      return elasticsearch.get({
        index,
        id,
      }).then(transformSource(source))
    },
  };
};
