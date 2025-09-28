"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const db_1 = require("../../db");
(0, dotenv_1.config)({
    path: './test/config/ci/.env',
    quiet: true
});
(async function () {
    (0, db_1.initDb)();
    await (0, db_1.createDbStructure)();
})();
