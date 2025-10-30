import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
    if (!db) {
      db = await SQLite.openDatabaseAsync('driving.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS samples (
          session_id TEXT, ts INTEGER,
          speed REAL, ax REAL, ay REAL, az REAL
        );
        CREATE TABLE IF NOT EXISTS events (
          session_id TEXT,
          ts INTEGER,
          type TEXT,
          value REAL,
          lat REAL,
          lng REAL
        );
        CREATE INDEX IF NOT EXISTS idx_samples ON samples(session_id, ts);

        CREATE TABLE IF NOT EXISTS track (
          session_id TEXT,
          ts INTEGER,
          lat REAL,
          lng REAL
        );
        CREATE INDEX IF NOT EXISTS idx_track ON track(session_id, ts);

      `);
    }
    return db;
  
};