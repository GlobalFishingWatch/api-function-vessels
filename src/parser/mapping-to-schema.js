


const mappingToSchema = (properties) => {
  const schema = { ...properties };
  Object.keys(properties).forEach(key => {
    if (properties[key].type) {
      schema[key] = properties[key].type;
    }
    if (properties[key].properties) {
      schema[key] = mappingToSchema(properties[key].properties)
    }
  });
  return schema;
}


module.exports = {
  mappingToSchema,
}
