// In-memory stand-in for the Transaction model, used ONLY by unit tests of
// the order lifecycle. It implements the subset of MongoDB semantics the
// lifecycle relies on: equality / $in / $ne filters and $set / $unset / $inc
// updates applied atomically to one document. Every call yields to the event
// loop first, so concurrent callers genuinely interleave.
//
// This proves the lifecycle's state-machine logic. It does NOT prove MongoDB's
// own atomicity — the integration tests against a real MongoDB cover that.

const clone = (doc) => (doc ? structuredClone(doc) : null);
const tick = () => new Promise((resolve) => setImmediate(resolve));

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("$in" in cond) return cond.$in.includes(value);
      if ("$ne" in cond) return value !== cond.$ne;
    }
    return String(value) === String(cond);
  });

const createFakeTransactionModel = (initialDocs = []) => {
  const docs = initialDocs.map((d) => ({ ...d }));

  const applyUpdate = (doc, update) => {
    for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
    for (const k of Object.keys(update.$unset || {})) delete doc[k];
    for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
  };

  return {
    docs,
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
      // Match + update happen with no await in between (atomic per document).
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      applyUpdate(doc, update);
      return clone(doc);
    },
  };
};

module.exports = { createFakeTransactionModel };
