import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { ROOT_DIR } from '@/lib/paths';

interface AppConfig {
  defaultModel: string;
}

const CONFIG_PATH = resolve(ROOT_DIR, 'config.yml');

const DEFAULT_CONFIG: AppConfig = {
  defaultModel: 'openai/gpt-oss-20b',
};

const DEPRECATED_DEFAULT_REPLACEMENTS: Record<string, string> = {
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'qwen/qwen3-32b': 'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b': 'qwen/qwen3.8-27b',
};

function readConfig(): AppConfig {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  const parsed = yaml.load(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<AppConfig> | undefined;
  const config = { ...DEFAULT_CONFIG, ...parsed };
  config.defaultModel = DEPRECATED_DEFAULT_REPLACEMENTS[config.defaultModel] ?? config.defaultModel;
  return config;
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
