export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionEnvironment } = await import('../scripts/runtime-config.js');
    validateProductionEnvironment(process.env);
  }
}
