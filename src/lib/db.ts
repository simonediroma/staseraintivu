import pg from 'pg';

// Singleton Pool condiviso da tutti i moduli. Non creare mai un nuovo Pool altrove.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export default pool;
