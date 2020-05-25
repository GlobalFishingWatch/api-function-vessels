const protobuf = require('protobufjs');
const Pbf = require('pbf');
const geobuf = require('geobuf');

let proto = null;

module.exports = (ctx, type, binary = false) => {
  return async data => {
    if (binary) {
      if (!proto) {
        proto = await protobuf.load(`${__dirname}/../proto/vessels.proto`);
      }
      if (type === 'lines' || type === 'points') {
        const pbf = geobuf.encode(data, new Pbf());
        const buffer = Buffer.from(pbf);
        ctx.set('content-type', 'application/protobuf');
        ctx.body = buffer;
      } else if (type === 'valueArray') {
        ctx.set('content-type', 'application/protobuf');

        const protoType = proto.lookupType(`vessels.Track`);
        ctx.type = 'application/protobuf';
        ctx.body = protoType.encode(protoType.create({ data })).finish();
      } else {
        const protoType = proto.lookupType(`vessels.${type}`);

        ctx.type = 'application/protobuf';
        ctx.body = protoType.encode(protoType.create(data)).finish();
      }
    } else {
      ctx.set('content-type', 'application/json; charset=utf-8');
      ctx.body = data;
    }
  };
};
