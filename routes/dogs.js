const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, (SELECT image_data FROM dog_images WHERE dog_id = d.id ORDER BY created_at ASC LIMIT 1) AS thumbnail
       FROM dogs d WHERE d.user_id = $1 ORDER BY d.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List dogs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM dogs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get dog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, breed, age, size, owner1_name, owner1_phone, owner2_name, owner2_phone, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await db.query(
      `INSERT INTO dogs (user_id, name, breed, age, size, owner1_name, owner1_phone, owner2_name, owner2_phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.id, name.trim(), breed || null, age || null, size || null,
       owner1_name || null, owner1_phone || null, owner2_name || null, owner2_phone || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create dog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, breed, age, size, owner1_name, owner1_phone, owner2_name, owner2_phone, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await db.query(
      `UPDATE dogs SET name=$1, breed=$2, age=$3, size=$4, owner1_name=$5, owner1_phone=$6,
       owner2_name=$7, owner2_phone=$8, notes=$9
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [name.trim(), breed || null, age || null, size || null,
       owner1_name || null, owner1_phone || null, owner2_name || null, owner2_phone || null,
       notes || null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update dog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM dogs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete dog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
