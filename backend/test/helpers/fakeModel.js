// Generic in-memory stand-in for a Mongoose model, used ONLY by unit tests.
// Supports dotted paths, equality / $in / $ne / $gte filters, $set / $unset /
// $inc updates applied atomically to one document, and unique keys on
// create (E11000-style error). Every call yields first so concurrent callers
// interleave. It proves service logic, not MongoDB's own atomicity.

const clone = (doc) => (doc ? structuredClone(doc) : null);
const tick = () => new Promise((resolve) => setImmediate(resolve));

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
  target[last] = value;
};
const unsetPath = (obj, path) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (target) delete target[last];
};

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => matches(doc, f));
    const value = getPath(doc, key);
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("$in" in cond) return cond.$in.includes(value);
      if ("$ne" in cond) return value !== cond.$ne;
      if ("$gte" in cond) return typeof value === "number" && value >= cond.$gte;
      if ("$exists" in cond) return cond.$exists ? value !== undefined : value === undefined;
      if ("$lte" in cond) return value !== undefined && new Date(value).getTime() <= new Date(cond.$lte).getTime();
    }
    return String(value) === String(cond);
  });

let idCounter = 0;

const createFakeModel = ({ docs: initial = [], unique = [] } = {}) => {
  const docs = initial.map((d) => structuredClone(d));

  const applyUpdate = (doc, update) => {
    for (const [k, v] of Object.entries(update.$set || {})) setPath(doc, k, v);
    for (const k of Object.keys(update.$unset || {})) unsetPath(doc, k);
    for (const [k, v] of Object.entries(update.$inc || {})) setPath(doc, k, (getPath(doc, k) || 0) + v);
  };

  return {
    docs,
    async create(data) {
      await tick();
      for (const key of unique) {
        const value = data[key];
        if (value !== undefined && docs.some((d) => d[key] === value)) {
          const error = new Error(`E11000 duplicate key ${key}`);
          error.code = 11000;
          throw error;
        }
      }
      const doc = { _id: `id${++idCounter}`, createdAt: new Date(), ...structuredClone(data) };
      docs.push(doc);
      return clone(doc);
    },
    async findOne(filter) {
      await tick();
      return clone(docs.find((d) => matches(d, filter)));
    },
    async findById(id) {
      await tick();
      return clone(docs.find((d) => String(d._id) === String(id)));
    },
    async findOneAndUpdate(filter, update) {
      await tick();
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      applyUpdate(doc, update);
      return clone(doc);
    },
    async updateOne(filter, update) {
      await tick();
      const doc = docs.find((d) => matches(d, filter));
      if (doc) applyUpdate(doc, update);
      return { matchedCount: doc ? 1 : 0 };
    },
  };
};

module.exports = { createFakeModel };
