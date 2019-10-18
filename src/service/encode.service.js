const protobuf = require('protobufjs');
const Pbf = require('pbf');
const geobuf = require('geobuf');

let proto = null;

module.exports = (res, type, binary = false) => {
  return async data => {
    if (binary) {
      if (type === 'geojson') {
        const pbf = geobuf.encode(data, new Pbf());
        const buffer = Buffer.from(pbf);
        res.set('content-type', 'application/protobuf');
        res.send(buffer);
      } else {
        if (!proto) {
          proto = await protobuf.load(`${__dirname}/../proto/vessels.proto`);
        }
        const protoType = proto.lookupType(`vessels.${type}`);

        res.set('content-type', 'application/protobuf');
        res.send(protoType.encode(protoType.create(data)).finish());
      }
    } else {
      res.set('content-type', 'application/json; charset=utf-8');
      res.json(data);
    }
  };
};
