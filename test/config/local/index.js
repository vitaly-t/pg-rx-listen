"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const db_1 = require("../../db");
(0, dotenv_1.config)({
    path: './test/config/local/.env',
    quiet: true
});
/**
 * To speed up local unit tests, comment this one out after the initial run,
 * there is no need re-creating the database structure for every test run.
 */
(async function () {
    (0, db_1.initDb)();
    await (0, db_1.createDbStructure)();
})();
