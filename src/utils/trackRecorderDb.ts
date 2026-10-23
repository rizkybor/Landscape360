import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RecordedTrack, TrackPoint } from '../types/trackRecorder';

// On-device storage for the Track Recorder. Every accepted GPS point is written here
// immediately, so a recording survives no signal, page reloads, and app restarts.

interface StoredPoint extends TrackPoint {
  trackId: string;
  seq: number;
}

interface TrackRecorderDB extends DBSchema {
  tracks: {
    key: string;
    value: RecordedTrack;
    indexes: { by_user: string };
  };
  points: {
    key: [string, number];
    value: StoredPoint;
  };
}

let dbPromise: Promise<IDBPDatabase<TrackRecorderDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<TrackRecorderDB>('track-recorder-db', 1, {
      upgrade(db) {
        const tracks = db.createObjectStore('tracks', { keyPath: 'id' });
        tracks.createIndex('by_user', 'userId');
        db.createObjectStore('points', { keyPath: ['trackId', 'seq'] });
      },
    });
  }
  return dbPromise;
};

const pointRange = (trackId: string) => IDBKeyRange.bound([trackId, 0], [trackId, Infinity]);

export const saveTrack = async (track: RecordedTrack) => {
  const db = await getDb();
  await db.put('tracks', track);
};

export const getTrack = async (id: string) => {
  const db = await getDb();
  return db.get('tracks', id);
};

export const listTracks = async (userId: string) => {
  const db = await getDb();
  const tracks = await db.getAllFromIndex('tracks', 'by_user', userId);
  return tracks.sort((a, b) => b.startedAt - a.startedAt);
};

export const findUnfinishedTrack = async (userId: string) => {
  const tracks = await listTracks(userId);
  return tracks.find((t) => t.status !== 'completed') ?? null;
};

export const addPoint = async (trackId: string, seq: number, point: TrackPoint) => {
  const db = await getDb();
  await db.put('points', { ...point, trackId, seq });
};

export const replacePoints = async (trackId: string, points: TrackPoint[]) => {
  const db = await getDb();
  const tx = db.transaction('points', 'readwrite');
  await tx.store.delete(pointRange(trackId));
  await Promise.all(points.map((p, seq) => tx.store.put({ ...p, trackId, seq })));
  await tx.done;
};

export const getPoints = async (trackId: string): Promise<TrackPoint[]> => {
  const db = await getDb();
  const stored = await db.getAll('points', pointRange(trackId));
  return stored.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    accuracy: p.accuracy,
    speed: p.speed,
    timestamp: p.timestamp,
    segment: p.segment,
  }));
};

export const deleteTrack = async (trackId: string) => {
  const db = await getDb();
  const tx = db.transaction(['tracks', 'points'], 'readwrite');
  await tx.objectStore('tracks').delete(trackId);
  await tx.objectStore('points').delete(pointRange(trackId));
  await tx.done;
};
