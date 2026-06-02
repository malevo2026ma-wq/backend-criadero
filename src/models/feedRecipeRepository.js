const { pool } = require('../config/db')

function q(conn) {
  return conn || pool
}

async function getRecipe(feedKey, conn = null) {
  const [recipeRows] = await q(conn).query(
    `SELECT feed_key, batch_size_kg FROM feed_recipes WHERE feed_key = ? LIMIT 1`,
    [feedKey],
  )
  const [lineRows] = await q(conn).query(
    `SELECT l.id, l.feed_key, l.ingredient_key, l.parts_per_batch, l.sort_order,
            c.label AS ingredient_label, c.short_label AS ingredient_short_label
     FROM feed_recipe_lines l
     LEFT JOIN ingredient_catalog c ON c.ingredient_key = l.ingredient_key
     WHERE l.feed_key = ?
     ORDER BY l.sort_order ASC, c.label ASC`,
    [feedKey],
  )
  if (!recipeRows[0] && lineRows.length === 0) {
    return null
  }
  const batchSizeKg = recipeRows[0] ? Number(recipeRows[0].batch_size_kg) : 1000
  return {
    feedKey,
    batchSizeKg,
    lines: lineRows.map((r) => ({
      id: r.id,
      ingredientKey: r.ingredient_key,
      ingredientLabel: r.ingredient_label,
      ingredientShortLabel: r.ingredient_short_label,
      partsPerBatch: Number(r.parts_per_batch),
      sortOrder: Number(r.sort_order),
    })),
  }
}

async function listRecipesSummary(conn = null) {
  const [rows] = await q(conn).query(
    `SELECT
      fc.feed_key,
      fc.label AS feed_label,
      fc.short_label AS feed_short_label,
      fc.is_prepared,
      fc.active,
      r.batch_size_kg,
      (SELECT COUNT(*) FROM feed_recipe_lines l WHERE l.feed_key = fc.feed_key) AS line_count
     FROM feed_catalog fc
     LEFT JOIN feed_recipes r ON r.feed_key = fc.feed_key
     ORDER BY fc.sort_order ASC, fc.label ASC`,
  )
  return rows.map((r) => ({
    feedKey: r.feed_key,
    feedLabel: r.feed_label,
    feedShortLabel: r.feed_short_label,
    isPrepared: Boolean(r.is_prepared),
    active: Boolean(r.active),
    batchSizeKg: r.batch_size_kg != null ? Number(r.batch_size_kg) : 1000,
    lineCount: Number(r.line_count) || 0,
    hasRecipe: Number(r.line_count) > 0,
  }))
}

async function upsertRecipeHeader(conn, feedKey, batchSizeKg) {
  await q(conn).query(
    `INSERT INTO feed_recipes (feed_key, batch_size_kg) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE batch_size_kg = VALUES(batch_size_kg), updated_at = CURRENT_TIMESTAMP`,
    [feedKey, batchSizeKg],
  )
}

async function deleteLinesForFeed(conn, feedKey) {
  await q(conn).query(`DELETE FROM feed_recipe_lines WHERE feed_key = ?`, [feedKey])
}

async function insertLine(conn, line) {
  await q(conn).query(
    `INSERT INTO feed_recipe_lines (id, feed_key, ingredient_key, parts_per_batch, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [line.id, line.feedKey, line.ingredientKey, line.partsPerBatch, line.sortOrder],
  )
}

module.exports = {
  getRecipe,
  listRecipesSummary,
  upsertRecipeHeader,
  deleteLinesForFeed,
  insertLine,
}
