import { app } from './app';
import { env } from './config/env';
import { ensureDefaultUsers } from './shared/bootstrap/seedUsers';
import { logger } from './shared/utils/logger';

const port = env.appPort;

const startServer = async () => {
  try {
    await ensureDefaultUsers();

    app.listen(port, () => {
      logger.info(`Servidor monolítico escuchando en http://0.0.0.0:${port}`);
    });
  } catch (error) {
    logger.error('Error iniciando el servidor', { error });
    process.exit(1);
  }
};

startServer();
