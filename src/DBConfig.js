export const DBConfig = {
  name: "Memories",
  version: 1,
  objectStoresMeta: [
    {
      store: "recordings",
      storeConfig: { autoIncrement: false },
      storeSchema: [
        { name: "id", options: { unique: true } },
        { name: "blob", options: { unique: false } },
        {
          name: "recordingStart",
          options: { unique: false }
        },
        {
          name: "recordingEnd",
          options: { unique: false }
        },
        {
          name: "length",
          options: { unique: false }
        },
        {
          name: "type",
          options: { unique: false }
        }
      ]
    }
  ]
};
