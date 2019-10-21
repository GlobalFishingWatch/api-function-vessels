const axios = require('axios');
const { DatasetVesselInfo } = require('./generated/vessels_pb');
const url =
  'https://us-central1-world-fishing-827.cloudfunctions.net/vessel-api/datasets/carriers:dev/vessels/69dc42b10-0e5e-a199-90f8-a72ab3630afa?startDate=2017-01-01T00:00:00.000Z&endDate=2017-12-31T00:00:00.000Z&binary=true';

axios
  .get(url, { responseType: 'arraybuffer' })
  // .then(bin => console.log('bin', bin))
  .then(bin => DatasetVesselInfo.deserializeBinary(bin.data))
  .then(data => {
    console.log(data.toObject());
  });
