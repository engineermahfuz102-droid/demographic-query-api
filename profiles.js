const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { parseQuery } = require('../utils/nlParser');

const VALID_SORT_FIELDS = ['age', 'created_at', 'gender_probability'];
const VALID_ORDERS = ['asc', 'desc'];
const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];

function buildFilterQuery(params) {
  const conditions = [];
  const values = [];
  let idx = 1;

  const {
    gender, age_group, country_id,
    min_age, max_age,
    min_gender_probability, min_country_probability,
  } = params;

  if (gender !== undefined) {
    if (!VALID_GENDERS.includes(gender)) {
      return { error: { status: 422, message: 'Invalid query parameters' } };
    }
    conditions.push(`gender = $${idx++}`);
    values.push(gender);
  }

  if (age_group !== undefined) {
    if (!VALID_AGE_GROUPS.includes(age_group)) {
      return { error: { status: 422, message: 'Invalid query parameters' } };
    }
    conditions.push(`age_group = $${idx++}`);
    values.push(age_group);
  }

  if (country_id !== undefined) {
    if (typeof country_id !== 'string' || country_id.length > 2) {
      return { error: { status: 422, message: 'Invalid query parameters' } };
    }
    conditions.push(`country_id = $${idx++}`);
    values.push(country_id.toUpperCase());
  }

  if (min_age !== undefined) {
    const val = parseInt(min_age);
    if (isNaN(val)) return { error: { status: 422, message: 'Invalid query parameters' } };
    conditions.push(`age >= $${idx++}`);
    values.push(val);
  }

  if (max_age !== undefined) {
    const val = parseInt(max_age);
    if (isNaN(val)) return { error: { status: 422, message: 'Invalid query parameters' } };
    conditions.push(`age <= $${idx++}`);
    values.push(val);
  }

  if (min_gender_probability !== undefined) {
    const val = parseFloat(min_gender_probability);
    if (isNaN(val)) return { error: { status: 422, message: 'Invalid query parameters' } };
    conditions.push(`gender_probability >= $${idx++}`);
    values.push(val);
  }

  if (min_country_probability !== undefined) {
    const val = parseFloat(min_country_probability);
    if (isNaN(val)) return { error: { status: 422, message: 'Invalid query parameters' } };
    conditions.push(`country_probability >= $${idx++}`);
    values.push(val);
  }

  return { conditions, values, idx };
}

// GET /api/profiles
router.get('/', async (req, res) => {
  try {
    const {
      gender, age_group, country_id,
      min_age, max_age,
      min_gender_probability, min_country_probability,
      sort_by = 'created_at',
      order = 'asc',
      page = '1',
      limit = '10',
    } = req.query;

    // Validate sort params
    if (!VALID_SORT_FIELDS.includes(sort_by)) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (!VALID_ORDERS.includes(order.toLowerCase())) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const pageNum = parseInt(page);
    let limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (limitNum > 50) limitNum = 50;

    const built = buildFilterQuery({
      gender, age_group, country_id,
      min_age, max_age,
      min_gender_probability, min_country_probability,
    });

    if (built.error) {
      return res.status(built.error.status).json({ status: 'error', message: built.error.message });
    }

    const { conditions, values, idx } = built;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) FROM profiles ${where}`;
    const dataQuery = `
      SELECT * FROM profiles
      ${where}
      ORDER BY ${sort_by} ${order.toUpperCase()}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limitNum, offset]),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: dataResult.rows.map(formatProfile),
    });

  } catch (err) {
    console.error('GET /api/profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// GET /api/profiles/search
router.get('/search', async (req, res) => {
  try {
    const { q, page = '1', limit = '10' } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Missing or empty parameter: q' });
    }

    const filters = parseQuery(q);
    if (!filters) {
      return res.status(200).json({ status: 'error', message: 'Unable to interpret query' });
    }

    const pageNum = parseInt(page);
    let limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (limitNum > 50) limitNum = 50;

    const built = buildFilterQuery(filters);
    if (built.error) {
      return res.status(built.error.status).json({ status: 'error', message: built.error.message });
    }

    const { conditions, values, idx } = built;
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (pageNum - 1) * limitNum;

    const countQuery = `SELECT COUNT(*) FROM profiles ${where}`;
    const dataQuery = `
      SELECT * FROM profiles
      ${where}
      ORDER BY created_at ASC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [countResult, dataResult] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, [...values, limitNum, offset]),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      data: dataResult.rows.map(formatProfile),
    });

  } catch (err) {
    console.error('GET /api/profiles/search error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

function formatProfile(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: parseFloat(row.gender_probability),
    age: row.age,
    age_group: row.age_group,
    country_id: row.country_id,
    country_name: row.country_name,
    country_probability: parseFloat(row.country_probability),
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
  };
}

module.exports = router;
