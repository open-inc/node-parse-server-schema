import type { CustomClassFieldType } from "../../schema/index.js";
import type { ConfigInterface } from "../index.js";

/**
 * Singleton Config class that holds the Parse Server configuration.
 */
export class Config {
  private static instance: Config | null = null;

  private _publicServerURL: string = "";
  private _appId: string = "";
  private _masterKey: string = "";
  private _customClassFieldTypes?: CustomClassFieldType[] = undefined;

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  /**
   * Gets the singleton instance of Config.
   * @returns The Config instance
   * @throws Error if the config has not been initialized
   */
  public static getInstance(): Config {
    if (!Config.instance) {
      throw new Error(
        "Config has not been initialized. Call loadConfig first."
      );
    }
    return Config.instance;
  }

  /**
   * Initializes the singleton with configuration values.
   * @param config The configuration object
   * @returns The Config instance
   */
  public static initialize(config: ConfigInterface): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    Config.instance._publicServerURL = config.publicServerURL;
    Config.instance._appId = config.appId;
    Config.instance._masterKey = config.masterKey;
    Config.instance._customClassFieldTypes = config.customClassFieldTypes;

    return Config.instance;
  }

  /**
   * Resets the singleton instance (useful for testing).
   */
  public static reset(): void {
    Config.instance = null;
  }

  // Getters
  public get publicServerURL(): string {
    return this._publicServerURL;
  }

  public get appId(): string {
    return this._appId;
  }

  public get masterKey(): string {
    return this._masterKey;
  }

  public get customClassFieldTypes(): CustomClassFieldType[] | undefined {
    return this._customClassFieldTypes;
  }

  /**
   * Returns the config as a plain object.
   */
  public toObject(): ConfigInterface {
    return {
      publicServerURL: this._publicServerURL,
      appId: this._appId,
      masterKey: this._masterKey,
      customClassFieldTypes: this._customClassFieldTypes,
    };
  }
}
