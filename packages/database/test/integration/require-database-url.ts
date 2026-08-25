const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim() === '') {
  process.stderr.write('DATABASE_URL is required for database integration tests.\n');
  process.exitCode = 1;
}

const databaseName = databaseUrl === undefined ? '' : new URL(databaseUrl).pathname.replace(/^\//, '');
if (databaseUrl !== undefined && !databaseName.endsWith('_test')) {
  process.stderr.write('DATABASE_URL must point to a database whose name ends in _test.\n');
  process.exitCode = 1;
}
