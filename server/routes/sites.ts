import { Router, Request, Response } from 'express';
import { db } from '../db/schema.js';

export const sitesRouter = Router();

// GET site references (with optional search query)
sitesRouter.get('/', (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    let rows: any[];

    if (q) {
      rows = db.prepare(`
        SELECT * FROM site_references
        WHERE LOWER(cluster_id) LIKE ?
           OR LOWER(cluster_name) LIKE ?
           OR LOWER(fdt_id) LIKE ?
           OR LOWER(olt_name) LIKE ?
        LIMIT 50
      `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as any[];
    } else {
      rows = db.prepare('SELECT * FROM site_references LIMIT 100').all() as any[];
    }

    const formatted = rows.map((r) => ({
      id: r.id,
      clusterId: r.cluster_id,
      clusterName: r.cluster_name,
      region: r.region,
      kecamatan: r.kecamatan,
      clusterInitial: r.cluster_initial,
      fdtNo: r.fdt_no,
      hpDrm: r.hp_drm,
      fdtId: r.fdt_id,
      oltName: r.olt_name,
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST bulk seed site references
sitesRouter.post('/seed', (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Array of site references expected' });
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO site_references (
        id, cluster_id, cluster_name, region, kecamatan,
        cluster_initial, fdt_no, hp_drm, fdt_id, olt_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const item of items) {
        insertStmt.run(
          item.id || `${item.clusterId}_${item.fdtId}`,
          item.clusterId || '',
          item.clusterName || '',
          item.region || '',
          item.kecamatan || '',
          item.clusterInitial || '',
          item.fdtNo || '',
          item.hpDrm || '',
          item.fdtId || '',
          item.oltName || ''
        );
      }
      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    res.json({ success: true, count: items.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
