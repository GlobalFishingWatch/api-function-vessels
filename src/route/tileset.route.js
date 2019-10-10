const vesselService = require('../service/vessel.service');
const log = require('../log');
const {
  tilesetOfVesselIdValidation,
  tilesetValidation,
} = require('../validation/tileset.validation');

module.exports = app => {
  app.get(
    '/tilesets/:tileset/vessels',
    tilesetValidation,
    async (req, res, next) => {
      try {
        const query = {
          query: req.query.query,
          limit: req.query.limit,
          offset: req.query.offset,
          queryFields: req.query.queryFields,
        };

        log.debug('Querying vessels search index');
        const results = await vesselService({
          tileset: req.params.tileset,
        }).search(query);

        log.debug(
          `Returning ${results.entries.length} / ${results.total} results`,
        );
        res.locals.cacheTags = [`tileset`, `tileset-${req.params.tileset}`];
        return res.json(results);
      } catch (err) {
        return next(err);
      }
    },
  );

  app.get(
    '/tilesets/:tileset/vessels/:vesselId',
    tilesetOfVesselIdValidation,
    async (req, res, next) => {
      try {
        const { vesselId } = req.params;

        log.debug(`Looking up vessel information for vessel ${vesselId}`);
        const result = await vesselService({
          tileset: req.params.tileset,
        }).get(vesselId);

        log.debug('Returning vessel information');
        res.locals.cacheTags = [
          `tileset`,
          'vessel',
          `tileset-${req.params.tileset}`,
          `vessel-${vesselId}`,
        ];
        return res.json(result);
      } catch (error) {
        if (error.statusCode && error.statusCode === 404) {
          return res.sendStatus(404);
        }
        return next(error);
      }
    },
  );
};
