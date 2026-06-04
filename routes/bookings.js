const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/search', async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req);
    const where = conditions.join(' AND ');

    const result = await db.query(
      `SELECT b.*, COALESCE(json_agg(bd.dog_id) FILTER (WHERE bd.dog_id IS NOT NULL), '[]') AS dog_ids,
        COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name)) FILTER (WHERE d.id IS NOT NULL), '[]') AS dogs
       FROM bookings b
       LEFT JOIN booking_dogs bd ON b.id = bd.booking_id
       LEFT JOIN dogs d ON bd.dog_id = d.id
       WHERE ${where}
       GROUP BY b.id
       ORDER BY b.start_date DESC LIMIT 100`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/calendar', async (req, res) => {
  try {
    const month = req.query.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month required (YYYY-MM)' });
    }

    const [year, m] = month.split('-').map(Number);
    const firstDay = `${month}-01`;
    const lastDay = new Date(year, m, 0).toISOString().substring(0, 10);

    const result = await db.query(
      `SELECT b.*, COALESCE(json_agg(bd.dog_id) FILTER (WHERE bd.dog_id IS NOT NULL), '[]') AS dog_ids,
        COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name)) FILTER (WHERE d.id IS NOT NULL), '[]') AS dogs
       FROM bookings b
       LEFT JOIN booking_dogs bd ON b.id = bd.booking_id
       LEFT JOIN dogs d ON bd.dog_id = d.id
       WHERE b.user_id = $1 AND b.end_date >= $2 AND b.start_date <= $3
       GROUP BY b.id ORDER BY b.start_date`,
      [req.user.id, firstDay, lastDay]
    );
    res.json({ month: firstDay, bookings: result.rows });
  } catch (err) {
    console.error('Calendar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const { conditions, params } = buildFilters(req);
    const where = conditions.join(' AND ');

    const result = await db.query(
      `SELECT b.*, COALESCE(string_agg(d.name, ', '), '') AS dog_names
       FROM bookings b
       LEFT JOIN booking_dogs bd ON b.id = bd.booking_id
       LEFT JOIN dogs d ON bd.dog_id = d.id
       WHERE ${where}
       GROUP BY b.id ORDER BY b.start_date DESC LIMIT 500`,
      params
    );

    const rows = result.rows;

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="bookings.pdf"');
      doc.pipe(res);

      doc.fontSize(14).text('Bookings Export', { align: 'center' });
      doc.moveDown(0.5);

      const colW = [160, 72, 72, 52, 52, 48, 52, 64, 160];
      const startX = doc.page.margins.left;
      const endX = 802 - doc.page.margins.right;
      const cellPad = 4;
      const rowH = 22;
      const headerVals = ['Dog(s)', 'Start', 'End', 'Drop', 'Pickup', 'Rate', 'Total', 'Status', 'Notes'];

      function drawRow(y, isHeader) {
        doc.rect(startX, y, endX - startX, rowH).fill(isHeader ? '#334155' : '#ffffff').stroke();
        doc.fill(isHeader ? '#ffffff' : '#1e293b');
        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 8 : 7.5);
        let x = startX;
        colW.forEach(w => { doc.lineWidth(0.5).rect(x, y, w, rowH).stroke(); x += w; });
      }

      let y = doc.y + 8;
      drawRow(y, true);
      headerVals.forEach((v, i) => { doc.text(v, startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + cellPad, y + cellPad, { width: colW[i] - cellPad * 2, height: rowH - cellPad * 2 }); });
      doc.fill('#1e293b');
      y += rowH;

      rows.forEach((r, ri) => {
        if (y + rowH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage(); y = 50;
          drawRow(y, true);
          headerVals.forEach((v, i) => { doc.text(v, startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + cellPad, y + cellPad, { width: colW[i] - cellPad * 2, height: rowH - cellPad * 2 }); });
          doc.fill('#1e293b'); y += rowH;
        }
        if (ri % 2 === 0) {
          doc.rect(startX, y, endX - startX, rowH).fill('#f1f5f9');
          doc.fill('#1e293b');
        }
        drawRow(y, false);
        const vals = [r.dog_names, r.start_date, r.end_date, r.drop_off_time || '', r.pick_up_time || '', '$' + r.rate, '$' + r.total_cost, r.status, r.notes || ''];
        vals.forEach((v, i) => { doc.text(v || '', startX + colW.slice(0, i).reduce((a, b) => a + b, 0) + cellPad, y + cellPad, { width: colW[i] - cellPad * 2, height: rowH - cellPad * 2 }); });
        y += rowH;
      });

      doc.end();
      return;
    }

    const escapeCsv = v => v != null ? `"${String(v).replace(/"/g, '""')}"` : '';
    const header = ['Dog(s)', 'Start Date', 'End Date', 'Drop-off Time', 'Pick-up Time', 'Rate', 'Total Cost', 'Status', 'Notes'];
    const csvRows = rows.map(r => [r.dog_names, r.start_date, r.end_date, r.drop_off_time, r.pick_up_time, r.rate, r.total_cost, r.status, r.notes].map(escapeCsv).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dog/:dogId', async (req, res) => {
  try {
    const dog = await db.query('SELECT id FROM dogs WHERE id = $1 AND user_id = $2', [req.params.dogId, req.user.id]);
    if (dog.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });

    const result = await db.query(
      `SELECT b.*, COALESCE(json_agg(bd.dog_id) FILTER (WHERE bd.dog_id IS NOT NULL), '[]') AS dog_ids
       FROM bookings b
       JOIN booking_dogs bd ON b.id = bd.booking_id
       WHERE b.id IN (SELECT booking_id FROM booking_dogs WHERE dog_id = $1) AND b.user_id = $2
       GROUP BY b.id ORDER BY b.start_date DESC`,
      [req.params.dogId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, COALESCE(json_agg(bd.dog_id) FILTER (WHERE bd.dog_id IS NOT NULL), '[]') AS dog_ids
       FROM bookings b
       LEFT JOIN booking_dogs bd ON b.id = bd.booking_id
       WHERE b.id = $1 AND b.user_id = $2
       GROUP BY b.id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { dog_ids, start_date, end_date, drop_off_time, pick_up_time, rate, total_cost, status, notes } = req.body;
    if (!dog_ids || !Array.isArray(dog_ids) || dog_ids.length === 0) {
      return res.status(400).json({ error: 'At least one dog is required' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    const dogCheck = await db.query('SELECT id FROM dogs WHERE id = ANY($1) AND user_id = $2', [dog_ids, req.user.id]);
    if (dogCheck.rows.length !== dog_ids.length) {
      return res.status(404).json({ error: 'One or more dogs not found' });
    }

    const result = await db.query(
      `INSERT INTO bookings (user_id, start_date, end_date, drop_off_time, pick_up_time, rate, total_cost, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, start_date, end_date, drop_off_time || null, pick_up_time || null, rate || 0, total_cost || 0, status || 'confirmed', notes || null]
    );
    const booking = result.rows[0];

    for (const dogId of dog_ids) {
      await db.query('INSERT INTO booking_dogs (booking_id, dog_id) VALUES ($1, $2)', [booking.id, dogId]);
    }
    booking.dog_ids = dog_ids;
    res.status(201).json(booking);
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { dog_ids, start_date, end_date, drop_off_time, pick_up_time, rate, total_cost, status, notes } = req.body;
    if (!start_date || !end_date) return res.status(400).json({ error: 'Start date and end date are required' });
    if (end_date < start_date) return res.status(400).json({ error: 'End date must be on or after start date' });

    const existing = await db.query('SELECT id FROM bookings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });

    const result = await db.query(
      `UPDATE bookings SET start_date=$1, end_date=$2, drop_off_time=$3, pick_up_time=$4, rate=$5, total_cost=$6, status=$7, notes=$8
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [start_date, end_date, drop_off_time || null, pick_up_time || null, rate || 0, total_cost || 0, status || 'confirmed', notes || null, req.params.id, req.user.id]
    );

    if (dog_ids && Array.isArray(dog_ids) && dog_ids.length > 0) {
      const dogCheck = await db.query('SELECT id FROM dogs WHERE id = ANY($1) AND user_id = $2', [dog_ids, req.user.id]);
      if (dogCheck.rows.length === dog_ids.length) {
        await db.query('DELETE FROM booking_dogs WHERE booking_id = $1', [req.params.id]);
        for (const dogId of dog_ids) {
          await db.query('INSERT INTO booking_dogs (booking_id, dog_id) VALUES ($1, $2)', [req.params.id, dogId]);
        }
      }
    }

    const booking = result.rows[0];
    booking.dog_ids = dog_ids || [];
    res.json(booking);
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM bookings WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function buildFilters(req) {
  const { dog_id, start_date, end_date, cost_min, cost_max, status } = req.query;
  const params = [req.user.id];
  const conditions = ['b.user_id = $1'];

  if (dog_id) {
    params.push(dog_id);
    conditions.push(`EXISTS (SELECT 1 FROM booking_dogs WHERE booking_id = b.id AND dog_id = $${params.length})`);
  }
  if (start_date && end_date) {
    params.push(end_date);
    conditions.push(`b.start_date <= $${params.length}`);
    params.push(start_date);
    conditions.push(`b.end_date >= $${params.length}`);
  } else if (start_date) {
    params.push(start_date);
    conditions.push(`b.end_date >= $${params.length}`);
  } else if (end_date) {
    params.push(end_date);
    conditions.push(`b.start_date <= $${params.length}`);
  }
  if (cost_min) {
    params.push(cost_min);
    conditions.push(`b.total_cost >= $${params.length}`);
  }
  if (cost_max) {
    params.push(cost_max);
    conditions.push(`b.total_cost <= $${params.length}`);
  }
  if (status) {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      params.push(statuses);
      conditions.push(`b.status = ANY($${params.length})`);
    }
  }
  return { conditions, params };
}

module.exports = router;
