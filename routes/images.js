const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/dog/:dogId/images', async (req, res) => {
  try {
    const dog = await db.query('SELECT id FROM dogs WHERE id = $1 AND user_id = $2', [req.params.dogId, req.user.id]);
    if (dog.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });

    const result = await db.query(
      'SELECT id, dog_id, original_name, created_at FROM dog_images WHERE dog_id = $1 ORDER BY created_at DESC',
      [req.params.dogId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List images error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dog/:dogId/images/:imageId', async (req, res) => {
  try {
    const dog = await db.query('SELECT id FROM dogs WHERE id = $1 AND user_id = $2', [req.params.dogId, req.user.id]);
    if (dog.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });

    const result = await db.query('SELECT * FROM dog_images WHERE id = $1 AND dog_id = $2', [req.params.imageId, req.params.dogId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/dog/:dogId/images', async (req, res) => {
  try {
    const dog = await db.query('SELECT id FROM dogs WHERE id = $1 AND user_id = $2', [req.params.dogId, req.user.id]);
    if (dog.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });

    const { image_data, original_name } = req.body;
    if (!image_data) return res.status(400).json({ error: 'Image data is required' });

    const sizeBytes = Math.ceil(image_data.length * 0.75);
    if (sizeBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 5 MB)' });

    const result = await db.query(
      'INSERT INTO dog_images (dog_id, image_data, original_name) VALUES ($1, $2, $3) RETURNING id, dog_id, original_name, created_at',
      [req.params.dogId, image_data, original_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/dog/:dogId/images/:imageId', async (req, res) => {
  try {
    const dog = await db.query('SELECT id FROM dogs WHERE id = $1 AND user_id = $2', [req.params.dogId, req.user.id]);
    if (dog.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });

    const result = await db.query('DELETE FROM dog_images WHERE id = $1 AND dog_id = $2 RETURNING id', [req.params.imageId, req.params.dogId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
