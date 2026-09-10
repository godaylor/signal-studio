import { validateProductionEnvironment } from './runtime-config.js';
try { validateProductionEnvironment(process.env); }
catch (error) { console.error(error.message); process.exit(1); }
