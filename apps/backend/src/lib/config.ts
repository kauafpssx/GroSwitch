import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

interface AppConfig {
  defaultModel: string;
}

const CONFIG_PATH = resolve(import.meta.dir, '../../../../config.yml');

const DEFAULT_CONFIG: AppConfig = {
  defaultModel: 'llama-3.1-8b-instant',
};

function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  const parsed = yaml.load(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<AppConfig> | undefined;
  return { ...DEFAULT_CONFIG, ...parsed };
}

function writeConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, yaml.dump(config), 'utf-8');
}

export const appConfig = {
  getAll(): AppConfig {
    return readConfig();
  },

  getDefaultModel(): string {
    return readConfig().defaultModel;
  },

  setDefaultModel(model: string): AppConfig {
    const config = readConfig();
    config.defaultModel = model;
    writeConfig(config);
    return config;
  },
};
