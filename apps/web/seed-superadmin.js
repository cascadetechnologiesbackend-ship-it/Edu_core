
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp' });
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const passwordHash = await bcrypt.hash('9902850039', 12);
    await pool.query(
      'INSERT INTO super_admin_users (email, password_hash, full_name, is_active) VALUES (\, \, \, \)',
      ['cascade@gmail.com', passwordHash, 'Cascade Super Admin', true]
    );
    console.log('Super Admin seeded successfully!');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
})();
