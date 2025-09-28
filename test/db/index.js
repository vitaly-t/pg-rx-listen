"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.createDbStructure = createDbStructure;
const pg_1 = require("pg");
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("fs");
let pool;
function initDb() {
    pool ||= new pg_1.Pool({
        host: process.env.PG_HOST || 'localhost',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'postgres',
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
        allowExitOnIdle: true
    });
    return { pool };
}
function createDbStructure() {
    const file = node_path_1.default.join(__dirname, 'create.sql');
    const sql = (0, fs_1.readFileSync)(file, 'utf8');
    return pool.query(sql);
}
