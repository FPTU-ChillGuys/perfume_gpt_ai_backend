import { EntityGenerator } from '@mikro-orm/entity-generator';
import { Migrator } from '@mikro-orm/migrations';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { PostgreSqlOptions } from '@mikro-orm/postgresql/PostgreSqlMikroORM.js';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { entities } from 'src/infrastructure/utils/entities';

const hostConfig = async () => {
  try {
    const host_config = await import('./host-config.js');
    return host_config.host_config;
  } catch (error) {
    console.error('Error importing host-config:', error);
    throw error;
  }
};

export default async function mikroConfig(): Promise<PostgreSqlOptions> {
  const host_config = await hostConfig();
  const host = host_config.host;
  const port = host_config.port;
  const user = host_config.user;
  const password = host_config.password;

  return {
    driver: PostgreSqlDriver,
    entities: [...entities],
    extensions: [EntityGenerator, Migrator],
    metadataProvider: TsMorphMetadataProvider,
    dbName: 'perfume_gpt_ai',
    dynamicImportProvider: (id) => import(id),
    host: host,
    port: port,
    user: user,
    password: password
  };
}
