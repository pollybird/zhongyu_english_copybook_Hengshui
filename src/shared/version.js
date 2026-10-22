/** 应用版本号单一来源：直接读取 package.json，避免界面文案里再手写一遍 */
import { version } from '../../package.json'

export const APP_VERSION = version
