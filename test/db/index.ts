import {Pool} from 'pg';
import path from 'node:path';
import {readFileSync} from 'fs';

let pool: Pool;

export function initDb() {
    pool ||= new Pool({
        host: process.env.PG_HOST || 'localhost',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'postgres',
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
        allowExitOnIdle: true
    });
    return {pool};
}

export function createDbStructure() {
    const file = path.join(__dirname, 'create.sql');
    const sql = readFileSync(file, 'utf8');
    return pool.query(sql);
}
