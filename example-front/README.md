# Example usage proto in front

## Dependencies

1. It's neccessary that you have installed protogen in your computer. 
For mac, you can install it with brew:

```

brew install protobuf 

```

For other platforms, you can get more info in [https://github.com/protocolbuffers/protobuf](https://github.com/protocolbuffers/protobuf)

2. To generate typescript definitions, you need the library `ts-protoc-gen`
You can install it with:
```

npm i --save-dev ts-protoc-gen

```

## Generate client code

Execute the script `generate.sh`. It generates the client code in javascript and the typescript definitions in `generated` folder. 

```

./generate.sh

```

## Getting started

### Decode pbf into json

Example:

```

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



```
