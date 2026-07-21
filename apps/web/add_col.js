const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp' });
(async () => {
  try {
    await pool.query(`ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "aadhaar_number_encrypted" text;`);
    console.log('Column added successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
