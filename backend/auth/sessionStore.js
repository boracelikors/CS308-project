// express-session store that keeps sessions in the MySQL "sessions" table
// (migration 20261110000005_create_sessions) through our existing Knex pool.
// Sessions survive a server restart, and logout really deletes the session.
const session = require("express-session");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class KnexSessionStore extends session.Store {
  constructor({ db, tableName = "sessions", cleanupIntervalMs = 15 * 60 * 1000 }) {
    super();
    this.db = db;
    this.tableName = tableName;
    // Expired rows are ignored on read; this timer also deletes them now and then
    if (cleanupIntervalMs > 0) {
      this.timer = setInterval(() => this.clearExpired().catch(() => {}), cleanupIntervalMs);
      this.timer.unref(); // never keeps the process alive on its own
    }
  }

  table() {
    return this.db(this.tableName);
  }

  static expiresAt(sess) {
    const expires = sess?.cookie?.expires;
    return expires ? new Date(expires) : new Date(Date.now() + ONE_DAY_MS);
  }

  get(sid, callback) {
    this.table()
      .where({ sid })
      .andWhere("expires_at", ">", new Date())
      .first("data")
      .then((row) => callback(null, row ? JSON.parse(row.data) : null), callback);
  }

  set(sid, sess, callback) {
    this.table()
      .insert({ sid, data: JSON.stringify(sess), expires_at: KnexSessionStore.expiresAt(sess) })
      .onConflict("sid")
      .merge(["data", "expires_at"])
      .then(() => callback?.(null), (err) => callback?.(err));
  }

  touch(sid, sess, callback) {
    this.table()
      .where({ sid })
      .update({ expires_at: KnexSessionStore.expiresAt(sess) })
      .then(() => callback?.(null), (err) => callback?.(err));
  }

  destroy(sid, callback) {
    this.table()
      .where({ sid })
      .del()
      .then(() => callback?.(null), (err) => callback?.(err));
  }

  clearExpired() {
    return this.table().where("expires_at", "<=", new Date()).del();
  }

  close() {
    clearInterval(this.timer);
  }
}

module.exports = { KnexSessionStore };
