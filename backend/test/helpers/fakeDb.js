// A tiny in-memory stand-in for the Mongoose model methods the routes use, so route tests
// can run whole flows (book -> pay -> receipt -> refund) without MongoDB.
// Supports filters with plain values, $in, $ne, $lt, $gt and $type, and updates with $set.

let seq = 1000;
const newId = () => String(++seq).padStart(24, "0");
const same = (a, b) => (a instanceof Date || b instanceof Date ? +a === +b : String(a) === String(b));

function matchValue(actual, cond) {
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond).every(([op, v]) => {
      if (op === "$in") return v.some((x) => same(actual, x));
      if (op === "$ne") return !same(actual, v);
      if (op === "$lt") return actual != null && actual < v;
      if (op === "$gt") return actual != null && actual > v;
      if (op === "$type") return typeof actual === (v === "string" ? "string" : v);
      throw new Error(`fakeDb: unsupported operator ${op}`);
    });
  }
  return actual === undefined ? cond === undefined || cond === null : same(actual, cond);
}

const matches = (doc, filter = {}) => Object.entries(filter).every(([k, v]) => matchValue(k.split(".").reduce((o, p) => o?.[p], doc), v));

function query(value) {
  const q = {
    lean: () => q, sort: () => q, limit: () => q, select: () => q, populate: () => q,
    then: (a, b) => Promise.resolve(value).then(a, b),
  };
  return q;
}

// Installs fake statics on `Model` backed by `rows` (an array). Returns the rows array.
function install(Model, rows = []) {
  const plain = (doc) => {
    const copy = { ...doc };
    delete copy.save;
    delete copy.toObject;
    delete copy.set;
    return copy;
  };
  const wrap = (doc) => {
    doc.save = async () => {
      if (Model.schema.options.strict === "throw") {
        for (const key of Object.keys(plain(doc))) {
          if (!Model.schema.path(key) && !Model.schema.nested[key] && key !== "_id" && key !== "createdAt" && key !== "updatedAt") {
            throw new Error(`fakeDb: field ${key} is not in the ${Model.modelName} schema`);
          }
        }
      }
      return doc;
    };
    doc.toObject = () => plain(doc);
    doc.set = (data) => Object.assign(doc, data);
    return doc;
  };
  const defaults = () => {
    const out = {};
    Model.schema.eachPath((path, type) => {
      if (path.includes(".") || type.defaultValue === undefined) return;
      out[path] = typeof type.defaultValue === "function" ? type.defaultValue() : type.defaultValue;
    });
    return out;
  };

  Model.findById = (id) => query(rows.find((r) => same(r._id, id)) ?? null);
  Model.findOne = (filter) => query(rows.find((r) => matches(r, filter)) ?? null);
  Model.find = (filter) => query(rows.filter((r) => matches(r, filter)));
  Model.exists = async (filter) => (rows.some((r) => matches(r, filter)) ? { _id: 1 } : null);
  Model.countDocuments = async (filter) => rows.filter((r) => matches(r, filter)).length;
  Model.create = async (data) => {
    const doc = wrap({ _id: newId(), createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data });
    await doc.save();
    rows.push(doc);
    return doc;
  };
  Model.insertMany = async (list) => Promise.all(list.map((d) => Model.create(d)));
  const update = (doc, u) => Object.assign(doc, u.$set || {});
  Model.updateOne = async (filter, u) => {
    const doc = rows.find((r) => matches(r, filter));
    if (doc) update(doc, u);
    return { matchedCount: doc ? 1 : 0 };
  };
  Model.updateMany = async (filter, u) => {
    const hit = rows.filter((r) => matches(r, filter));
    hit.forEach((d) => update(d, u));
    return { matchedCount: hit.length };
  };
  Model.deleteOne = async (filter) => {
    const i = rows.findIndex((r) => matches(r, filter));
    if (i >= 0) rows.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  };
  Model.aggregate = async () => [];
  rows.forEach(wrap);
  return rows;
}

module.exports = { install, newId };
