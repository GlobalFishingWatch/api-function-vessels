/* eslint-disable no-underscore-dangle */
const elasticsearch = require('../db/elasticsearch');
const log = require('../log');

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

const calculateNextOffset = (query, results) =>
  query.offset + query.limit <= results.hits.total
    ? query.offset + query.limit
    : null;

const transformSearchResults = ({ query, source }) => results => {
  return {
    query: query.query,
    total: results.hits.total,
    limit: query.limit,
    offset: query.offset,
    nextOffset: calculateNextOffset(query, results),
    entries: results.hits.hits.map(transformSearchResult(source)),
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

    get(vesselId) {
      const identity = {
        index,
        // type: 'vessel',
        id: vesselId,
      };
      return elasticsearch.get(identity).then(transformSearchResult(source));
    },
  };
};
